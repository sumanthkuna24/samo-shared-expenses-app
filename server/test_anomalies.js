const { db } = require('./database');
const { importCSV } = require('./csvParser');
const { runAnomalyScan, resolveAnomaly } = require('./anomalyDetector');
const path = require('path');

const csvPath = path.resolve(__dirname, '../expenses_export.csv');

console.log('--- STARTING ANOMALY SCAN & RESOLUTION VERIFICATION TEST ---');

db.serialize(() => {
  // Clear tables
  db.run('DELETE FROM expense_splits');
  db.run('DELETE FROM data_anomalies');
  db.run('DELETE FROM decision_log');
  db.run('DELETE FROM settlements');
  db.run('DELETE FROM expenses', (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    // Ingest CSV
    importCSV(csvPath, (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      // Run anomaly scan
      runAnomalyScan((err, count) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }

        console.log('\n--- VERIFYING ALL DETECTED ANOMALIES ---');
        db.all(`
          SELECT da.id, da.category, da.severity, da.status, e.description as expense, da.description 
          FROM data_anomalies da
          LEFT JOIN expenses e ON da.expense_id = e.id
        `, [], (err, rows) => {
          if (err) console.error(err);
          console.table(rows);

          // Find the duplicate anomaly to simulate resolution
          const duplicateAnomaly = rows.find(r => r.category === 'duplicate');
          if (!duplicateAnomaly) {
            console.error('No duplicate anomaly found for test!');
            db.close();
            return;
          }

          console.log(`\n--- SIMULATING RESOLUTION FOR ANOMALY ID: ${duplicateAnomaly.id} (Duplicate) ---`);
          
          // Look up matching duplicate expenses in SQLite
          db.all("SELECT id, description, anomaly_status FROM expenses WHERE description LIKE '%Marina Bites%'", [], (err, expRows) => {
            if (err) console.error(err);
            console.log('Marina Bites rows before resolution:');
            console.table(expRows);

            const keepId = expRows[0].id;
            const discardId = expRows[1].id;

            const resolutionDetails = {
              keep_expense_id: keepId,
              discard_expense_id: discardId,
              notes: 'Keep first, ignore second'
            };

            resolveAnomaly(duplicateAnomaly.id, 'merge_duplicate', resolutionDetails, (err) => {
              if (err) {
                console.error('Resolution failed:', err);
                db.close();
                return;
              }

              console.log('\n--- VERIFYING ANOMALY STATUS AFTER RESOLUTION ---');
              db.all('SELECT id, category, severity, status, decision_log_id FROM data_anomalies WHERE id = ?', [duplicateAnomaly.id], (err, rows) => {
                if (err) console.error(err);
                console.table(rows);

                console.log('\n--- VERIFYING EXPENSES STATE AFTER RESOLUTION ---');
                db.all("SELECT id, description, anomaly_status FROM expenses WHERE description LIKE '%Marina Bites%'", [], (err, expRows) => {
                  if (err) console.error(err);
                  console.table(expRows);

                  console.log('\n--- VERIFYING DECISION LOG ENTRY ---');
                  db.all('SELECT * FROM decision_log', [], (err, logRows) => {
                    if (err) console.error(err);
                    console.table(logRows);

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
