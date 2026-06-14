const { db } = require('./database');

// Main function to scan the database and register data anomalies using declarative SQL
function runAnomalyScan(callback) {
  console.log('Running anomaly detection scan...');

  db.serialize(() => {
    // 1. Rule: Missing Payer (AN-07) - Error
    console.log('runAnomalyScan: Scanning missing_payer...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT id, 'missing_payer', 'Payer is missing or unrecognized in roommate profile.', 'error', 'unresolved'
      FROM expenses
      WHERE paid_by_id IS NULL AND anomaly_status != 'ignored'
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 1 missing_payer error:', err);
      else console.log('runAnomalyScan Rule 1 missing_payer scan complete.');
    });

    // 2. Rule: Missing Currency (AN-08) - Warning
    console.log('runAnomalyScan: Scanning missing_currency...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT id, 'missing_currency', 'Currency field is empty.', 'warning', 'unresolved'
      FROM expenses
      WHERE (currency IS NULL OR currency = '') AND anomaly_status != 'ignored'
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 2 missing_currency error:', err);
      else console.log('runAnomalyScan Rule 2 missing_currency scan complete.');
    });

    // 3. Rule: Ambiguous Date (AN-14) - Error
    console.log('runAnomalyScan: Scanning ambiguous_date...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT id, 'ambiguous_date', 'Transaction date is ambiguous (day/month conflict or text-based).', 'error', 'unresolved'
      FROM expenses
      WHERE parsed_date IS NULL AND anomaly_status != 'ignored'
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 3 ambiguous_date error:', err);
      else console.log('runAnomalyScan Rule 3 ambiguous_date scan complete.');
    });

    // 4. Rule: Split Percentage Sum Error (AN-09) - Error
    console.log('runAnomalyScan: Scanning split_sum_error...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT es.expense_id, 'split_sum_error', 'Percentage splits do not sum to 100% (sums to ' || SUM(es.share_proportion) || '%).', 'error', 'unresolved'
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      WHERE e.split_type = 'percentage' AND e.anomaly_status != 'ignored'
      GROUP BY es.expense_id
      HAVING ABS(SUM(es.share_proportion) - 100.0) > 0.01
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 4 split_sum_error error:', err);
      else console.log('runAnomalyScan Rule 4 split_sum_error scan complete.');
    });

    // 5. Rule: Temporal Membership Conflict (AN-15) - Warning
    console.log('runAnomalyScan: Scanning temporal_violation...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT es.expense_id, 'temporal_violation', 'Split roommate ' || r.name || ' was inactive on transaction date ' || e.parsed_date, 'warning', 'unresolved'
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      JOIN roommates r ON es.roommate_id = r.id
      JOIN group_memberships gm ON es.roommate_id = gm.roommate_id AND gm.group_id = e.group_id
      WHERE e.parsed_date IS NOT NULL AND e.anomaly_status != 'ignored'
        AND (e.parsed_date < gm.joined_at OR (gm.left_at IS NOT NULL AND e.parsed_date > gm.left_at))
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 5 temporal_violation error:', err);
      else console.log('runAnomalyScan Rule 5 temporal_violation scan complete.');
    });

    // 6. Rule: Potential Duplicates (AN-01) - Warning
    console.log('runAnomalyScan: Scanning duplicate...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT e2.id, 'duplicate', 'Potential duplicate transaction of ID: ' || e1.id || ' ("' || e1.description || '")', 'warning', 'unresolved'
      FROM expenses e1
      JOIN expenses e2 ON e1.raw_date = e2.raw_date 
        AND e1.group_id = e2.group_id
        AND (e1.paid_by_id = e2.paid_by_id OR (e1.paid_by_id IS NULL AND e2.paid_by_id IS NULL))
        AND e1.amount = e2.amount 
        AND e1.id < e2.id
        AND e1.anomaly_status != 'ignored'
        AND e2.anomaly_status != 'ignored'
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 6 duplicate error:', err);
      else console.log('runAnomalyScan Rule 6 duplicate scan complete.');
    });

    // 7. Rule: Ingestion Classification Ambiguity (AN-16) - Warning
    console.log('runAnomalyScan: Scanning classification_ambiguity...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT id, 'classification_ambiguity', 'Transaction classification is uncertain (potential settlement logged as split expense).', 'warning', 'unresolved'
      FROM expenses
      WHERE anomaly_status = 'pending_resolution' AND description LIKE '%deposit%'
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 7 classification_ambiguity error:', err);
      else console.log('runAnomalyScan Rule 7 classification_ambiguity scan complete.');
    });

    // 9. Rule: Unregistered Split Participant - Error
    console.log('runAnomalyScan: Scanning unregistered_participant...');
    db.run(`
      INSERT INTO data_anomalies (expense_id, category, description, severity, status)
      SELECT DISTINCT expense_id, 'unregistered_participant', 'Split contains unrecognized roommate profile.', 'error', 'unresolved'
      FROM expense_splits
      WHERE roommate_id IS NULL
      ON CONFLICT(expense_id, category) DO UPDATE SET description = excluded.description
    `, (err) => {
      if (err) console.error('runAnomalyScan Rule 9 unregistered_participant error:', err);
      else console.log('runAnomalyScan Rule 9 unregistered_participant scan complete.');
    });

    // 8. Rule: Zero Value Expense (AN-06) - Auto-Ignore & Log in callback, then get count
    console.log('runAnomalyScan: Scanning zero_value...');
    db.all("SELECT id, description FROM expenses WHERE amount = 0.0 AND anomaly_status != 'ignored'", [], (err, rows) => {
      if (err) {
        console.error('runAnomalyScan Rule 8 zero_value select error:', err);
        if (callback) callback(err);
        return;
      }
      console.log('runAnomalyScan Rule 8 zero_value select complete. Rows:', rows.length);

      if (rows.length === 0) {
        // No zero-value rows to process, query final count directly
        db.get('SELECT COUNT(*) as c FROM data_anomalies WHERE status = "unresolved"', [], (err, row) => {
          if (err) {
            console.error('runAnomalyScan final count error:', err);
            if (callback) callback(err);
          } else {
            console.log(`Scan finished. Total unresolved anomalies in database: ${row ? row.c : 0}`);
            if (callback) callback(null, row ? row.c : 0);
          }
        });
        return;
      }

      // Process zero-value auto-ignore writes
      let processedCount = 0;
      rows.forEach(r => {
        db.serialize(() => {
          // Log auto-ignore in decision_log
          db.run(`
            INSERT INTO decision_log (action_type, resolution_details)
            VALUES ('auto_ignore_zero_value', ?)
          `, [JSON.stringify({ expense_id: r.id, description: r.description, note: 'Zero-value expense automatically ignored' })], function(err) {
            if (err) return console.error(err);

            const decisionLogId = this.lastID;

            // Set expense to ignored
            db.run("UPDATE expenses SET anomaly_status = 'ignored' WHERE id = ?", [r.id]);

            // Insert resolved anomaly record
            db.run(`
              INSERT INTO data_anomalies (expense_id, category, description, severity, status, decision_log_id)
              VALUES (?, 'zero_value', 'Zero-value expense automatically ignored.', 'warning', 'resolved', ?)
              ON CONFLICT(expense_id, category) DO UPDATE SET status = 'resolved', decision_log_id = excluded.decision_log_id
            `, [r.id, decisionLogId], () => {
              console.log(`Auto-ignored zero-value expense: "${r.description}" (ID: ${r.id})`);
              processedCount++;

              if (processedCount === rows.length) {
                // Done processing all zero-value writes, query final count
                db.get('SELECT COUNT(*) as c FROM data_anomalies WHERE status = "unresolved"', [], (err, row) => {
                  if (err) {
                    if (callback) callback(err);
                  } else {
                    console.log(`Scan finished. Total unresolved anomalies: ${row ? row.c : 0}`);
                    if (callback) callback(null, row ? row.c : 0);
                  }
                });
              }
            });
          });
        });
      });
    });
  });
}

// Resolution engine - transactional logic to resolve an anomaly and log the action
function resolveAnomaly(anomalyId, actionType, details, callback) {
  console.log(`Resolving anomaly ID: ${anomalyId} | Action: ${actionType}`);

  db.serialize(() => {
    // 1. Start transaction by logging decision
    db.run(`
      INSERT INTO decision_log (action_type, resolution_details)
      VALUES (?, ?)
    `, [actionType, JSON.stringify(details)], function(err) {
      if (err) {
        if (callback) callback(err);
        return;
      }

      const decisionLogId = this.lastID;

      // 2. Retrieve related transaction
      db.get('SELECT expense_id, settlement_id, category FROM data_anomalies WHERE id = ?', [anomalyId], (err, anomaly) => {
        if (err || !anomaly) {
          if (callback) callback(err || new Error('Anomaly not found.'));
          return;
        }

        const expenseId = anomaly.expense_id;
        const category = anomaly.category;

        // 3. Apply changes based on anomaly category and action
        if (category === 'duplicate' && actionType === 'merge_duplicate') {
          const keepId = details.keep_expense_id;
          const discardId = details.discard_expense_id;
          
          db.run("UPDATE expenses SET anomaly_status = 'ignored' WHERE id = ?", [discardId]);
          db.run("UPDATE expenses SET anomaly_status = 'clean' WHERE id = ?", [keepId]);

        } else if (category === 'missing_payer' && actionType === 'assign_payer') {
          const roommateId = details.roommate_id;
          db.run("UPDATE expenses SET paid_by_id = ?, anomaly_status = 'clean' WHERE id = ?", [roommateId, expenseId]);

        } else if (category === 'ambiguous_date' && actionType === 'resolve_date') {
          const selectedDate = details.parsed_date;
          db.run("UPDATE expenses SET parsed_date = ?, anomaly_status = 'clean' WHERE id = ?", [selectedDate, expenseId]);

        } else if (category === 'missing_currency' && actionType === 'resolve_currency') {
          const selectedCurrency = details.currency;
          db.run("UPDATE expenses SET currency = ?, anomaly_status = 'clean' WHERE id = ?", [selectedCurrency, expenseId]);

        } else if (category === 'split_sum_error' && actionType === 'adjust_splits') {
          const splits = details.splits; // Array of { roommate_id, proportion, share_amount }
          
          splits.forEach(s => {
            db.run(`
              UPDATE expense_splits 
              SET share_proportion = ?, share_amount = ? 
              WHERE expense_id = ? AND roommate_id = ?
            `, [s.proportion, s.share_amount, expenseId, s.roommate_id]);
          });
          db.run("UPDATE expenses SET anomaly_status = 'clean' WHERE id = ?", [expenseId]);

        } else if (category === 'temporal_violation' && actionType === 'remove_roommate_split') {
          const roommateId = details.roommate_id;
          
          db.run("DELETE FROM expense_splits WHERE expense_id = ? AND roommate_id = ?", [expenseId, roommateId], (err) => {
            if (err) return console.error(err);
            
            db.all("SELECT id, share_proportion FROM expense_splits WHERE expense_id = ?", [expenseId], (err, splits) => {
              if (err || splits.length === 0) return;
              
              db.get("SELECT amount FROM expenses WHERE id = ?", [expenseId], (err, exp) => {
                if (err || !exp) return;
                
                const newShare = exp.amount / splits.length;
                splits.forEach(sp => {
                  db.run("UPDATE expense_splits SET share_amount = ? WHERE id = ?", [newShare, sp.id]);
                });
              });
            });
          });
          db.run("UPDATE expenses SET anomaly_status = 'clean' WHERE id = ?", [expenseId]);

        } else if (category === 'classification_ambiguity' && actionType === 'convert_to_settlement') {
          db.get("SELECT * FROM expenses WHERE id = ?", [expenseId], (err, exp) => {
            if (err || !exp) return;
            
            db.get("SELECT roommate_id FROM expense_splits WHERE expense_id = ? LIMIT 1", [expenseId], (err, split) => {
              if (err || !split) return;
              
              db.run(`
                INSERT INTO settlements (group_id, sender_id, receiver_id, amount, currency, exchange_rate, raw_date, parsed_date, notes, is_manual)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
              `, [exp.group_id, exp.paid_by_id, split.roommate_id, exp.amount, exp.currency, exp.exchange_rate, exp.raw_date, exp.parsed_date, exp.notes], function(err) {
                if (err) return console.error(err);
                
                db.run("DELETE FROM expenses WHERE id = ?", [expenseId]);
              });
            });
          });
        }

        // 4. Update Anomaly Status to resolved
        db.run(`
          UPDATE data_anomalies 
          SET status = 'resolved', decision_log_id = ? 
          WHERE id = ?
        `, [decisionLogId, anomalyId], (err) => {
          if (err) {
            if (callback) callback(err);
          } else {
            console.log(`Anomaly ${anomalyId} successfully resolved.`);
            if (callback) callback(null);
          }
        });
      });
    });
  });
}

module.exports = {
  runAnomalyScan,
  resolveAnomaly
};
