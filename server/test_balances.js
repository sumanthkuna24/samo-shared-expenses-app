const { db } = require('./database');
const { importCSV } = require('./csvParser');
const { runAnomalyScan, resolveAnomaly } = require('./anomalyDetector');
const { getNetBalances, getRoommateLedger, calculateSettlements } = require('./balanceEngine');
const path = require('path');

const csvPath = path.resolve(__dirname, '../expenses_export.csv');

console.log('--- STARTING CALCULATIONS & TRACE ENGINE VERIFICATION TEST ---');

db.serialize(() => {
  // Clear and Re-ingest CSV
  db.run('DELETE FROM expense_splits');
  db.run('DELETE FROM data_anomalies');
  db.run('DELETE FROM decision_log');
  db.run('DELETE FROM settlements');
  db.run('DELETE FROM expenses', (err) => {
    if (err) process.exit(1);

    importCSV(csvPath, (err) => {
      if (err) process.exit(1);

      runAnomalyScan((err, count) => {
        if (err) process.exit(1);

        console.log('\n--- 1. VERIFYING PROVISIONAL BALANCES (EXCLUDES DIRTY DATA) ---');
        getNetBalances((err, balances, excludedCount) => {
          if (err) {
            console.error('Provisional Balances failed:', err);
            db.close();
            return;
          }
          console.log(`Ledger Status: PROVISIONAL | Excluded Expenses: ${excludedCount}`);
          console.table(balances);

          console.log('\n--- 2. VERIFYING CHRONOLOGICAL LEDGER STATEMENT (ROHAN) ---');
          getRoommateLedger('Rohan', (err, ledger) => {
            if (err) console.error(err);
            console.table(ledger);

            // Fetch anomalies to resolve them dynamically
            db.all('SELECT id, category, expense_id FROM data_anomalies WHERE status = "unresolved"', [], (err, anomalies) => {
              if (err) console.error(err);

              // Find key anomalies
              const payerAnomaly = anomalies.find(a => a.category === 'missing_payer' && a.expense_id === 5); // Cleaning supplies
              const currencyAnomaly = anomalies.find(a => a.category === 'missing_currency');
              const dateAnomaly = anomalies.find(a => a.category === 'ambiguous_date' && a.expense_id === 19); // Deep cleaning
              const duplicateAnomaly = anomalies.find(a => a.category === 'duplicate');

              console.log('\n--- 3. RESOLVING BLOCKING ANOMALIES FOR FULL BALANCES ---');
              
              db.serialize(() => {
                // Resolve missing payer (assign Rohan for cleaning supplies)
                if (payerAnomaly) {
                  resolveAnomaly(payerAnomaly.id, 'assign_payer', { roommate_id: 2 }, () => {});
                }

                // Resolve missing currency (DMart -> INR)
                if (currencyAnomaly) {
                  resolveAnomaly(currencyAnomaly.id, 'resolve_currency', { currency: 'INR' }, () => {});
                }

                // Resolve ambiguous date (Deep cleaning -> 2026-04-05)
                if (dateAnomaly) {
                  resolveAnomaly(dateAnomaly.id, 'resolve_date', { parsed_date: '2026-04-05' }, () => {});
                }

                // Resolve duplicate (Marina Bites -> keep first, ignore second)
                if (duplicateAnomaly) {
                  // Duplicate Marina Bites has keep=2, discard=22
                  resolveAnomaly(duplicateAnomaly.id, 'merge_duplicate', { keep_expense_id: 2, discard_expense_id: 22 }, () => {});
                }

                // Run final calculations scan to trigger clean balances
                runAnomalyScan((err, count) => {
                  console.log('\n--- 4. VERIFYING CLEAN BALANCES (INVARIANT CHECK) ---');
                  
                  getNetBalances((err, cleanBalances, cleanExcludesCount) => {
                    if (err) {
                      console.error('Clean balances failed:', err.message);
                      db.close();
                      return;
                    }
                    console.log(`Ledger Status: CLEAN | Excluded Expenses: ${cleanExcludesCount}`);
                    console.table(cleanBalances);

                    console.log('\n--- 5. VERIFYING MINIMIZED SETTLEMENT PATHS ---');
                    const paths = calculateSettlements(cleanBalances);
                    console.table(paths);

                    console.log('\n--- TEST COMPLETE ---');
                    db.close();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
