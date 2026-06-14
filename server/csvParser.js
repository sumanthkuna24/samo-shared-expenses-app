const fs = require('fs');
const path = require('path');
const { db } = require('./database');

// Helper to parse a single RFC 4180 CSV line, preserving commas inside quotes
function parseCSVLine(line) {
  const result = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  result.push(cell.trim());
  return result;
}

// Clean and normalize names (e.g. 'rohan ' -> 'Rohan', 'priya' -> 'Priya')
function normalizeName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (trimmed === '') return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Clean and parse numbers (e.g. '"1,200"' -> 1200.0)
function parseAmount(amountStr) {
  if (!amountStr) return 0;
  // Remove commas, quotes, and whitespace
  const clean = amountStr.replace(/[\",\s]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Parse dates strictly. Returns YYYY-MM-DD if clear, otherwise returns null.
function parseDateStrictly(rawDate) {
  if (!rawDate) return null;
  const trimmed = rawDate.trim();

  // 1. Matches YYYY-MM-DD (e.g. 2026-02-01) - Clear
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Matches DD/MM/YYYY or MM/DD/YYYY (e.g. 15/03/2026)
  const matchSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchSlash) {
    const first = parseInt(matchSlash[1], 10);
    const second = parseInt(matchSlash[2], 10);
    const year = parseInt(matchSlash[3], 10);

    // If both numbers are <= 12, it is ambiguous (e.g. 04/05/2026).
    // Store as NULL until user resolves it.
    if (first <= 12 && second <= 12) {
      return null;
    }

    // If day is clearly first (first > 12, second <= 12), e.g. 15/03/2026 -> 2026-03-15
    if (first > 12 && second <= 12) {
      return `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;
    }

    // If month is clearly first (second > 12, first <= 12), e.g. 03/15/2026 -> 2026-03-15
    if (second > 12 && first <= 12) {
      return `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
    }
  }

  // 3. Textual formats (e.g. 'Mar 14') are ambiguous because the year is missing.
  return null;
}

// Confidence-based classification
function classifyTransaction(row) {
  const splitType = row.split_type ? row.split_type.trim().toLowerCase() : '';
  const splitWith = row.split_with ? row.split_with.trim() : '';
  const desc = row.description ? row.description.toLowerCase() : '';
  const notes = row.notes ? row.notes.toLowerCase() : '';

  const isRepaymentWord = desc.includes('paid') || desc.includes('back') || desc.includes('settlement') ||
                           notes.includes('paid') || notes.includes('back') || notes.includes('settlement') ||
                           notes.includes('deposit');

  const hasSingleRecipient = splitWith.split(';').length === 1 && splitWith !== '';

  // 1. High Confidence Settlement
  if (splitType === '' && hasSingleRecipient && isRepaymentWord) {
    return 'settlement';
  }

  // 2. High Confidence Expense
  if (splitType !== '' && !hasSingleRecipient) {
    return 'expense';
  }

  // 3. Uncertain Classification (e.g., Sam deposit share has split_type='equal' but split_with='Aisha')
  return 'uncertain';
}

function importCSV(filePath, groupId, callback) {
  console.log(`Reading CSV file from: ${filePath}`);
  
  let finalGroupId = groupId;
  let finalCallback = callback;
  if (typeof groupId === 'function') {
    finalCallback = groupId;
    finalGroupId = null;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error('Error reading CSV file:', err);
    if (finalCallback) finalCallback(err);
    return;
  }

  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    if (finalCallback) finalCallback(new Error('CSV file is empty or missing data rows.'));
    return;
  }

  // Parse Headers
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const dateIdx = headers.indexOf('date');
  const descIdx = headers.indexOf('description');
  const paidByIdx = headers.indexOf('paid_by');
  const amountIdx = headers.indexOf('amount');
  const currIdx = headers.indexOf('currency');
  const typeIdx = headers.indexOf('split_type');
  const withIdx = headers.indexOf('split_with');
  const detailsIdx = headers.indexOf('split_details');
  const notesIdx = headers.indexOf('notes');

  db.serialize(() => {
    // Fetch all roommate names and IDs to map names dynamically
    console.log('csvParser: querying roommates...');
    db.all('SELECT id, name FROM roommates', [], (err, roommateRows) => {
      console.log('csvParser: roommates queried, count:', roommateRows ? roommateRows.length : 0, 'err:', err);
      if (err) {
        if (finalCallback) finalCallback(err);
        return;
      }

      // Map names for quick case-insensitive lookups
      const roommateMap = {};
      roommateRows.forEach(r => {
        roommateMap[r.name.toLowerCase()] = r.id;
      });

      const resolveGroupId = (cb) => {
        if (finalGroupId) return cb(null, finalGroupId);
        console.log('csvParser: resolveGroupId querying groups...');
        db.get('SELECT id FROM groups LIMIT 1', [], (err, row) => {
          console.log('csvParser: groups queried, row:', row, 'err:', err);
          if (err) return cb(err);
          cb(null, row ? row.id : null);
        });
      };

      resolveGroupId((err, resolvedGroupId) => {
        console.log('csvParser: resolveGroupId callback fired, resolvedGroupId:', resolvedGroupId, 'err:', err);
        if (err || !resolvedGroupId) {
          if (finalCallback) finalCallback(err || new Error('No group ID resolved for CSV import.'));
          return;
        }

        const groupId = resolvedGroupId;

        let pendingWrites = 0;
        let fileParsed = false;

        const checkFinished = () => {
          if (fileParsed && pendingWrites === 0) {
            console.log(`Ingested ${lines.length - 1} rows into database.`);
            if (finalCallback) finalCallback(null);
          }
        };

        // Loop and parse each data row
        for (let i = 1; i < lines.length; i++) {
          const rawRow = lines[i];
          const cells = parseCSVLine(rawRow);

          // Extract columns using indices
          const csvDate = cells[dateIdx] || '';
          const csvDesc = cells[descIdx] || '';
          const csvPaidBy = cells[paidByIdx] || '';
          const csvAmount = cells[amountIdx] || '';
          const csvCurrency = cells[currIdx] || '';
          const csvSplitType = cells[typeIdx] || '';
          const csvSplitWith = cells[withIdx] || '';
          const csvSplitDetails = cells[detailsIdx] || '';
          const csvNotes = cells[notesIdx] || '';

          const rowData = {
            date: csvDate,
            description: csvDesc,
            paid_by: csvPaidBy,
            amount: csvAmount,
            currency: csvCurrency,
            split_type: csvSplitType,
            split_with: csvSplitWith,
            split_details: csvSplitDetails,
            notes: csvNotes
          };

          const classification = classifyTransaction(rowData);

          // Standardize fields
          const cleanPayerName = normalizeName(csvPaidBy);
          const payerId = cleanPayerName ? roommateMap[cleanPayerName.toLowerCase()] : null;
          const cleanAmount = parseAmount(csvAmount);
          const cleanCurrency = csvCurrency.trim() !== '' ? csvCurrency.trim().toUpperCase() : null; // NULL if empty
          const parsedDate = parseDateStrictly(csvDate);

          // Flag initial anomalies state
          let isAnomaly = false;
          let anomalyDesc = '';

          if (!payerId && csvPaidBy.trim() !== '') {
            isAnomaly = true;
            anomalyDesc += `Unrecognized payer '${csvPaidBy}'. `;
          }
          if (csvPaidBy.trim() === '') {
            isAnomaly = true;
            anomalyDesc += 'Missing payer. ';
          }
          if (!cleanCurrency) {
            isAnomaly = true;
            anomalyDesc += 'Missing currency. ';
          }
          if (!parsedDate) {
            isAnomaly = true;
            anomalyDesc += `Ambiguous or unparseable date format '${csvDate}'. `;
          }
          if (classification === 'uncertain') {
            isAnomaly = true;
            anomalyDesc += `Uncertain transaction classification (split type vs split participants). `;
          }

          const anomalyStatus = isAnomaly ? 'pending_resolution' : 'clean';

          if (classification === 'settlement' && !isAnomaly) {
            // High Confidence Settlement Path
            const cleanRecipientName = normalizeName(csvSplitWith);
            const recipientId = cleanRecipientName ? roommateMap[cleanRecipientName.toLowerCase()] : null;

            pendingWrites++;
            db.run(`
              INSERT INTO settlements (group_id, sender_id, receiver_id, amount, currency, exchange_rate, raw_date, parsed_date, notes, is_manual)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
              groupId,
              payerId,
              recipientId,
              cleanAmount,
              cleanCurrency || 'INR', // fallback for database integrity, but flagged if missing
              cleanCurrency === 'USD' ? 83.0 : 1.0, // default rate placeholder
              csvDate,
              parsedDate,
              csvNotes
            ], () => {
              pendingWrites--;
              checkFinished();
            });

          } else {
            // Expense Path (or Uncertain rows matching Expense schema)
            pendingWrites++;
            db.run(`
              INSERT INTO expenses (group_id, description, amount, currency, exchange_rate, paid_by_id, split_type, raw_date, parsed_date, notes, raw_csv_row, anomaly_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              groupId,
              csvDesc,
              cleanAmount,
              cleanCurrency || '', // empty if null
              cleanCurrency === 'USD' ? 83.0 : 1.0,
              payerId,
              csvSplitType,
              csvDate,
              parsedDate,
              csvNotes,
              rawRow,
              anomalyStatus
            ], function(err) {
              if (err) {
                console.error('Error inserting expense:', err);
                pendingWrites--;
                checkFinished();
                return;
              }

              const expenseId = this.lastID;

              // Insert Splits
              const participants = csvSplitWith.split(';').map(normalizeName).filter(Boolean);
              if (participants.length > 0) {
                // Parse split details if available
                const detailsMap = {};
                if (csvSplitDetails.trim() !== '') {
                  csvSplitDetails.split(';').forEach(d => {
                    const parts = d.trim().split(/\s+/);
                    if (parts.length >= 2) {
                      const name = normalizeName(parts[0]);
                      // Extract number from details (e.g. "700" or "30%")
                      const numStr = parts[1].replace(/%/g, '');
                      detailsMap[name] = parseFloat(numStr);
                    }
                  });
                }

                participants.forEach(pName => {
                  const pId = roommateMap[pName.toLowerCase()];
                  
                  // Calculate share amount/proportion placeholder
                  let proportion = 1.0; // Default share proportion
                  if (csvSplitType === 'percentage' && detailsMap[pName]) {
                    proportion = detailsMap[pName];
                  } else if (csvSplitType === 'share' && detailsMap[pName]) {
                    proportion = detailsMap[pName];
                  } else if (csvSplitType === 'unequal' && detailsMap[pName]) {
                    proportion = detailsMap[pName];
                  }

                  let shareAmount = 0.0;
                  if (csvSplitType === 'equal') {
                    shareAmount = cleanAmount / participants.length;
                  } else if (csvSplitType === 'percentage') {
                    shareAmount = cleanAmount * (proportion / 100.0);
                  } else if (csvSplitType === 'share') {
                    const totalShares = Object.values(detailsMap).reduce((a, b) => a + b, 0);
                    shareAmount = totalShares > 0 ? cleanAmount * (proportion / totalShares) : 0;
                  } else if (csvSplitType === 'unequal') {
                    shareAmount = proportion;
                  }

                  pendingWrites++;
                  db.run(`
                    INSERT INTO expense_splits (expense_id, roommate_id, share_amount, share_proportion)
                    VALUES (?, ?, ?, ?)
                  `, [expenseId, pId, shareAmount, proportion], () => {
                    pendingWrites--;
                    checkFinished();
                  });
                });
              }
              pendingWrites--;
              checkFinished();
            });
          }
        }
        fileParsed = true;
        checkFinished();
      });
    });
  });
}

module.exports = {
  importCSV,
  parseCSVLine
};
