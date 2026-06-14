const path = require('path');
const { db } = require('./database');
const { importCSV } = require('./csvParser');

const csvPath = path.resolve(__dirname, '../expenses_export.csv');

console.log('--- STARTING CSV PARSER VERIFICATION TEST ---');

db.serialize(() => {
  // Clear existing entries
  db.run('DELETE FROM expense_splits');
  db.run('DELETE FROM data_anomalies');
  db.run('DELETE FROM decision_log');
  db.run('DELETE FROM settlements');
  db.run('DELETE FROM expenses', (err) => {
    if (err) {
      console.error('Failed to clear tables:', err);
      process.exit(1);
    }

    importCSV(csvPath, (err) => {
      if (err) {
        console.error('Import failed:', err);
        process.exit(1);
      }

      console.log('\n--- VERIFYING HIGH-CONFIDENCE SETTLEMENTS ---');
      db.all('SELECT s.id, r1.name as sender, r2.name as receiver, s.amount, s.currency, s.raw_date, s.parsed_date, s.notes FROM settlements s JOIN roommates r1 ON s.sender_id = r1.id JOIN roommates r2 ON s.receiver_id = r2.id', [], (err, rows) => {
        if (err) console.error(err);
        console.table(rows);

        console.log('\n--- VERIFYING EXPENSES & PARSED VALUES ---');
        db.all('SELECT e.id, e.description, e.amount, e.currency, r.name as paid_by, e.split_type, e.raw_date, e.parsed_date, e.anomaly_status FROM expenses e LEFT JOIN roommates r ON e.paid_by_id = r.id LIMIT 10', [], (err, rows) => {
          if (err) console.error(err);
          console.table(rows);

          console.log('\n--- VERIFYING SPLITS FROM JOIN TABLE ---');
          db.all(`
            SELECT es.id, e.description, r.name as roommate, es.share_amount, es.share_proportion 
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            JOIN roommates r ON es.roommate_id = r.id
            LIMIT 10
          `, [], (err, rows) => {
            if (err) console.error(err);
            console.table(rows);

            console.log('\n--- VERIFYING RAW ROW BACKUPS (AUDITABILITY) ---');
            db.all('SELECT id, description, raw_csv_row FROM expenses LIMIT 3', [], (err, rows) => {
              if (err) console.error(err);
              rows.forEach(r => {
                console.log(`Expense ID ${r.id}: "${r.description}"`);
                console.log(`  Raw CSV Row: [${r.raw_csv_row}]`);
              });

              console.log('\n--- TEST COMPLETE ---');
              db.close();
            });
          });
        });
      });
    });
  });
});
