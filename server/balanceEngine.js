const { db } = require('./database');

// Retrieve all roommate balances, applying strict anomaly exclusions
// Retrieve all roommate balances, applying strict anomaly exclusions for a specific group
function getNetBalances(groupId, callback) {
  let finalGroupId = groupId;
  let finalCallback = callback;
  if (typeof groupId === 'function') {
    finalCallback = groupId;
    finalGroupId = 1;
  }
  return getNetBalancesInternal(finalGroupId, finalCallback);
}

function getNetBalancesInternal(groupId, callback) {
  if (!groupId) {
    // If the user belongs to no groups, return empty datasets
    return callback(null, [], 0);
  }

  // Query to find all critical unresolved anomalies that must exclude their expenses
  const excludeQuery = `
    SELECT DISTINCT da.expense_id 
    FROM data_anomalies da
    JOIN expenses e ON da.expense_id = e.id
    WHERE da.status = 'unresolved' 
      AND da.category IN ('missing_payer', 'missing_currency', 'split_sum_error', 'ambiguous_date', 'unregistered_participant')
      AND e.group_id = ?
  `;

  db.all(excludeQuery, [groupId], (err, excludedRows) => {
    if (err) return callback(err);

    const excludedIds = new Set(excludedRows.map(r => r.expense_id).filter(Boolean));

    // Fetch roommates belonging to this group
    db.all(`
      SELECT r.id, r.name 
      FROM roommates r
      JOIN group_memberships gm ON r.id = gm.roommate_id
      WHERE gm.group_id = ?
    `, [groupId], (err, roommates) => {
      if (err) return callback(err);

      // Fetch active expenses in this group
      db.all(`
        SELECT id, paid_by_id, amount, currency, exchange_rate 
        FROM expenses 
        WHERE anomaly_status != 'ignored' AND group_id = ?
      `, [groupId], (err, expenses) => {
        if (err) return callback(err);

        // Fetch active splits in this group
        db.all(`
          SELECT es.expense_id, es.roommate_id, es.share_amount 
          FROM expense_splits es
          JOIN expenses e ON es.expense_id = e.id
          WHERE e.anomaly_status != 'ignored' AND e.group_id = ?
        `, [groupId], (err, splits) => {
          if (err) return callback(err);

          // Fetch settlements in this group
          db.all(`
            SELECT sender_id, receiver_id, amount, currency, exchange_rate 
            FROM settlements
            WHERE group_id = ?
          `, [groupId], (err, settlements) => {
            if (err) return callback(err);

            // Initialize balance map
            const balances = {};
            roommates.forEach(r => {
              balances[r.id] = {
                id: r.id,
                name: r.name,
                paid: 0.0,
                share: 0.0,
                sent: 0.0,
                received: 0.0,
                net: 0.0
              };
            });

            // 1. Sum paid expenses (excluding bad ones)
            expenses.forEach(e => {
              if (excludedIds.has(e.id)) return; // Exclude blocked anomalies
              if (e.paid_by_id && balances[e.paid_by_id]) {
                balances[e.paid_by_id].paid += e.amount * e.exchange_rate;
              }
            });

            // 2. Sum split shares (excluding bad ones)
            splits.forEach(s => {
              if (excludedIds.has(s.expense_id)) return; // Exclude blocked anomalies
              if (balances[s.roommate_id]) {
                balances[s.roommate_id].share += s.share_amount; // share_amount is already computed in original currency
              }
            });

            // 3. Sum settlements sent and received
            settlements.forEach(s => {
              const rate = s.exchange_rate || 1.0;
              if (balances[s.sender_id]) {
                balances[s.sender_id].sent += s.amount * rate;
              }
              if (balances[s.receiver_id]) {
                balances[s.receiver_id].received += s.amount * rate;
              }
            });

            // 4. Calculate Net Balances & Verify Invariant
            let totalSum = 0.0;
            const roommateBalances = Object.values(balances).map(b => {
              // Net balance formula: paid - share + sent - received
              b.net = Math.round((b.paid - b.share + b.sent - b.received) * 100) / 100;
              totalSum += b.net;
              return b;
            });

            // Math Invariant Check
            if (Math.abs(totalSum) >= 0.05) {
              return callback(new Error(`Ledger Integrity Exception: Sum of balances does not equal 0 (Sum = ${totalSum} INR).`));
            }

            callback(null, roommateBalances, excludedIds.size);
          });
        });
      });
    });
  });
}


// Generate a chronological statement for a single roommate within a specific group
function getRoommateLedger(roommateName, groupId, callback) {
  let finalGroupId = groupId;
  let finalCallback = callback;
  if (typeof groupId === 'function') {
    finalCallback = groupId;
    finalGroupId = 1;
  }
  return getRoommateLedgerInternal(roommateName, finalGroupId, finalCallback);
}

function getRoommateLedgerInternal(roommateName, groupId, callback) {
  if (!groupId) {
    return callback(null, []);
  }

  // Find roommate ID first
  db.get('SELECT id, name FROM roommates WHERE name = ? COLLATE NOCASE', [roommateName], (err, roommate) => {
    if (err || !roommate) {
      return callback(err || new Error(`Roommate '${roommateName}' not found.`));
    }

    const rId = roommate.id;

    // Fetch all active expenses and splits involving the roommate in this group
    const expensesQuery = `
      SELECT e.id, e.description, e.amount, e.currency, e.exchange_rate, 
             e.raw_date, e.parsed_date, r.name as paid_by_name, es.share_amount, e.anomaly_status,
             e.raw_csv_row, e.split_type, e.notes
      FROM expenses e
      LEFT JOIN roommates r ON e.paid_by_id = r.id
      JOIN expense_splits es ON e.id = es.expense_id
      WHERE es.roommate_id = ? AND e.anomaly_status != 'ignored' AND e.group_id = ?
    `;

    // Fetch all settlements involving the roommate in this group
    const settlementsQuery = `
      SELECT s.id, 'Repayment' as description, s.amount, s.currency, s.exchange_rate, 
             s.raw_date, s.parsed_date, r1.name as sender_name, r2.name as receiver_name, s.notes
      FROM settlements s
      JOIN roommates r1 ON s.sender_id = r1.id
      JOIN roommates r2 ON s.receiver_id = r2.id
      WHERE (s.sender_id = ? OR s.receiver_id = ?) AND s.group_id = ?
    `;

    db.all(expensesQuery, [rId, groupId], (err, expenseRows) => {
      if (err) return callback(err);

      db.all(settlementsQuery, [rId, rId, groupId], (err, settlementRows) => {
        if (err) return callback(err);

        // Fetch all expense splits for this group
        db.all(`
          SELECT es.expense_id, r.name as roommate_name
          FROM expense_splits es
          JOIN roommates r ON es.roommate_id = r.id
          JOIN expenses e ON es.expense_id = e.id
          WHERE e.group_id = ?
        `, [groupId], (err, splitRows) => {
          if (err) return callback(err);

          const splitsMap = {};
          splitRows.forEach(sr => {
            if (!splitsMap[sr.expense_id]) splitsMap[sr.expense_id] = [];
            splitsMap[sr.expense_id].push(sr.roommate_name);
          });

          // Fetch all anomalies for this group
          db.all(`
            SELECT da.expense_id, da.category, da.description, da.severity, da.status 
            FROM data_anomalies da
            JOIN expenses e ON da.expense_id = e.id
            WHERE e.group_id = ?
          `, [groupId], (err, anomalyRows) => {
            if (err) return callback(err);

            const anomaliesMap = {};
            anomalyRows.forEach(ar => {
              if (ar.expense_id) {
                if (!anomaliesMap[ar.expense_id]) anomaliesMap[ar.expense_id] = [];
                anomaliesMap[ar.expense_id].push({
                  category: ar.category,
                  description: ar.description,
                  severity: ar.severity,
                  status: ar.status
                });
              }
            });

            // Fetch excluded expenses list for this group
            db.all(`
              SELECT DISTINCT da.expense_id 
              FROM data_anomalies da
              JOIN expenses e ON da.expense_id = e.id
              WHERE da.status = 'unresolved' 
                AND da.category IN ('missing_payer', 'missing_currency', 'split_sum_error', 'ambiguous_date', 'unregistered_participant')
                AND e.group_id = ?
            `, [groupId], (err, excludedRows) => {
              if (err) return callback(err);

              const excludedIds = new Set(excludedRows.map(row => row.expense_id));
              const ledgerItems = [];

              // Process Expense Rows
              expenseRows.forEach(e => {
                const isExcluded = excludedIds.has(e.id);
                const rate = e.exchange_rate || 1.0;
                const originalShare = e.share_amount;
                const convertedShare = originalShare * rate;
                const isPayer = e.paid_by_name && e.paid_by_name.toLowerCase() === roommate.name.toLowerCase();
                const originalPaid = isPayer ? e.amount : 0.0;
                const convertedPaid = originalPaid * rate;

                // Net impact: Paid - Share (INR)
                const netImpact = isExcluded ? 0.0 : (convertedPaid - convertedShare);

                ledgerItems.push({
                  id: e.id,
                  date: e.parsed_date || e.raw_date,
                  description: e.description,
                  total: `${e.amount} ${e.currency || 'INR'}`,
                  amount: e.amount,
                  currency: e.currency || 'INR',
                  exchange_rate: rate,
                  share: `${originalShare.toFixed(2)} ${e.currency || 'INR'} (${Math.round(convertedShare)} INR)`,
                  paid: `${originalPaid.toFixed(2)} ${e.currency || 'INR'} (${Math.round(convertedPaid)} INR)`,
                  paid_amount: originalPaid,
                  share_amount: originalShare,
                  net_impact: Math.round(netImpact * 100) / 100,
                  status: isExcluded ? 'excluded' : 'active',
                  type: 'expense',
                  raw_csv_row: e.raw_csv_row,
                  split_type: e.split_type,
                  notes: e.notes,
                  split_members: splitsMap[e.id] || [],
                  anomalies: anomaliesMap[e.id] || []
                });
              });

              // Process Settlement Rows
              settlementRows.forEach(s => {
                const isSender = s.sender_name.toLowerCase() === roommate.name.toLowerCase();
                const rate = s.exchange_rate || 1.0;
                const convertedAmount = s.amount * rate;
                
                // Net impact: Sent (+) or Received (-)
                const netImpact = isSender ? convertedAmount : -convertedAmount;

                ledgerItems.push({
                  id: s.id,
                  date: s.parsed_date || s.raw_date,
                  description: isSender ? `Sent to ${s.receiver_name}` : `Received from ${s.sender_name}`,
                  total: `${s.amount} ${s.currency}`,
                  amount: s.amount,
                  currency: s.currency,
                  exchange_rate: rate,
                  share: '0.00',
                  paid: isSender ? `${s.amount} ${s.currency} (${Math.round(convertedAmount)} INR)` : '0.00',
                  paid_amount: isSender ? s.amount : 0.0,
                  share_amount: 0.0,
                  net_impact: Math.round(netImpact * 100) / 100,
                  status: 'active',
                  type: 'settlement',
                  raw_csv_row: `Settlement: ${s.sender_name} -> ${s.receiver_name} | Amount: ${s.amount} | Notes: ${s.notes || ''}`,
                  split_type: 'direct_repayment',
                  notes: s.notes,
                  split_members: [s.sender_name, s.receiver_name],
                  anomalies: []
                });
              });

              // Sort ledger items chronologically
              ledgerItems.sort((a, b) => new Date(a.date) - new Date(b.date));

              // Compute running balance
              let runningBalance = 0.0;
              const finalLedger = ledgerItems.map(item => {
                runningBalance += item.net_impact;
                return {
                  ...item,
                  running_balance: Math.round(runningBalance * 100) / 100
                };
              });


              callback(null, finalLedger);
            });
          });
        });
      });
    });
  });
}

// Greedy cash flow minimization algorithm
function calculateSettlements(balances) {
  const creditors = [];
  const debtors = [];

  balances.forEach(b => {
    if (b.net > 0.01) {
      creditors.push({ name: b.name, val: b.net });
    } else if (b.net < -0.01) {
      debtors.push({ name: b.name, val: Math.abs(b.net) });
    }
  });

  // Sort creditors descending, debtors descending (by debt magnitude)
  creditors.sort((a, b) => b.val - a.val);
  debtors.sort((a, b) => b.val - a.val);

  const settlementPaths = [];

  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = creditors[0];
    const debtor = debtors[0];

    const amount = Math.min(creditor.val, debtor.val);
    settlementPaths.push({
      sender: debtor.name,
      receiver: creditor.name,
      amount: Math.round(amount * 100) / 100,
      currency: 'INR'
    });

    creditor.val -= amount;
    debtor.val -= amount;

    // Remove if fully settled
    if (creditor.val < 0.01) {
      creditors.shift();
    } else {
      creditors.sort((a, b) => b.val - a.val);
    }

    if (debtor.val < 0.01) {
      debtors.shift();
    } else {
      debtors.sort((a, b) => b.val - a.val);
    }
  }

  return settlementPaths;
}

module.exports = {
  getNetBalances,
  getRoommateLedger,
  calculateSettlements
};
