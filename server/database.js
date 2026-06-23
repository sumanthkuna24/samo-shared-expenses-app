const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Tests and deployments can point at an isolated database without touching the
// checked-in demo data. Local development keeps the existing default.
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../expenses.db');
const db = new sqlite3.Database(dbPath);

// Enable foreign key constraints in SQLite
db.run('PRAGMA foreign_keys = ON');

function initDb(callback) {
  console.log('Initializing SQLite Database...');

  db.serialize(() => {
    // 1. Roommates Table (needed first as a reference)
    db.run(`
      CREATE TABLE IF NOT EXISTS roommates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // 2. Users Table (for login credentials)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        roommate_id INTEGER,
        FOREIGN KEY (roommate_id) REFERENCES roommates(id)
      )
    `);

    // 3. Groups Table
    db.run(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        base_currency TEXT DEFAULT 'INR'
      )
    `);

    // 4. Group Memberships Timeline
    db.run(`
      CREATE TABLE IF NOT EXISTS group_memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        roommate_id INTEGER,
        joined_at TEXT NOT NULL,
        left_at TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (roommate_id) REFERENCES roommates(id),
        CONSTRAINT check_dates CHECK (left_at IS NULL OR joined_at <= left_at)
      )
    `);

    // 5. Expenses Table
    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        exchange_rate REAL DEFAULT 1.0,
        paid_by_id INTEGER,
        split_type TEXT NOT NULL,
        raw_date TEXT NOT NULL,
        parsed_date TEXT,
        notes TEXT,
        raw_csv_row TEXT,
        anomaly_status TEXT DEFAULT 'clean',
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (paid_by_id) REFERENCES roommates(id)
      )
    `);

    // 6. Expense Splits Table (Relational Splits)
    db.run(`
      CREATE TABLE IF NOT EXISTS expense_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER,
        roommate_id INTEGER,
        share_amount REAL NOT NULL,
        share_proportion REAL NOT NULL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (roommate_id) REFERENCES roommates(id)
      )
    `);

    // 7. Settlements Table (Repayments & Deposits)
    db.run(`
      CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        sender_id INTEGER,
        receiver_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        exchange_rate REAL DEFAULT 1.0,
        raw_date TEXT NOT NULL,
        parsed_date TEXT,
        notes TEXT,
        is_manual INTEGER DEFAULT 0,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (sender_id) REFERENCES roommates(id),
        FOREIGN KEY (receiver_id) REFERENCES roommates(id)
      )
    `);

    // 8. Decision Log Table
    db.run(`
      CREATE TABLE IF NOT EXISTS decision_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        resolution_details TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. Data Anomalies Table
    db.run(`
      CREATE TABLE IF NOT EXISTS data_anomalies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER,
        settlement_id INTEGER,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT,
        status TEXT DEFAULT 'unresolved',
        decision_log_id INTEGER,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE,
        FOREIGN KEY (decision_log_id) REFERENCES decision_log(id)
      )
    `);

    // Create unique indices to guarantee idempotency (prevents duplicate warnings for same category)
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_anomaly_expense 
      ON data_anomalies (expense_id, category)
    `);

    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_anomaly_settlement 
      ON data_anomalies (settlement_id, category)
    `, (err) => {
      if (err) {
        console.error('Error creating tables and indices:', err);
        if (callback) callback(err);
      } else {
        console.log('Database tables and indices verified/created successfully.');
        if (callback) callback(null);
      }
    });
  });
}

function seedDb(callback) {
  console.log('Seeding Database...');

  // Check if group already seeded
  db.get('SELECT id FROM groups LIMIT 1', (err, row) => {
    if (err) {
      console.error('Error checking groups table:', err);
      if (callback) callback(err);
      return;
    }

    if (row) {
      console.log('Database already seeded. Skipping.');
      if (callback) callback(null);
      return;
    }

    db.serialize(() => {
      // 1. Seed Group
      db.run('INSERT INTO groups (name, base_currency) VALUES (?, ?)', ['Apartment Roommates', 'INR'], function(err) {
        if (err) {
          console.error('Error seeding groups:', err);
          if (callback) callback(err);
          return;
        }

        const groupId = this.lastID;

        // 2. Seed Roommates
        const roommates = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam'];
        const roommateIds = {};
        let insertedCount = 0;

        roommates.forEach(name => {
          db.run('INSERT INTO roommates (name) VALUES (?)', [name], function(err) {
            if (err) {
              console.error(`Error seeding roommate ${name}:`, err);
              return;
            }

            roommateIds[name] = this.lastID;
            insertedCount++;

            // Once all roommates are seeded, proceed with memberships and user login accounts
            if (insertedCount === roommates.length) {
              db.serialize(() => {
                // 3. Seed Memberships History
                const insertMembership = `
                  INSERT INTO group_memberships (group_id, roommate_id, joined_at, left_at)
                  VALUES (?, ?, ?, ?)
                `;

                // Aisha, Rohan, Priya joined Feb 1, 2026, active
                db.run(insertMembership, [groupId, roommateIds['Aisha'], '2026-02-01', null]);
                db.run(insertMembership, [groupId, roommateIds['Rohan'], '2026-02-01', null]);
                db.run(insertMembership, [groupId, roommateIds['Priya'], '2026-02-01', null]);

                // Meera joined Feb 1, 2026, left March 29, 2026
                db.run(insertMembership, [groupId, roommateIds['Meera'], '2026-02-01', '2026-03-29']);

                // Sam joined April 8, 2026, active
                db.run(insertMembership, [groupId, roommateIds['Sam'], '2026-04-08', null]);

                // 4. Seed Users for Login
                const insertUser = `
                  INSERT INTO users (username, password_hash, roommate_id)
                  VALUES (?, ?, ?)
                `;

                const defaultPassword = 'password123';
                const salt = bcrypt.genSaltSync(10);
                const hash = bcrypt.hashSync(defaultPassword, salt);

                Object.keys(roommateIds).forEach(name => {
                  const username = name.toLowerCase();
                  db.run(insertUser, [username, hash, roommateIds[name]], (err) => {
                    if (err) {
                      console.error(`Error seeding user ${username}:`, err);
                    } else {
                      console.log(`Seeded User: ${username} | Password: ${defaultPassword}`);
                    }
                  });
                });

                console.log('Seeding completed successfully.');
                if (callback) callback(null);
              });
            }
          });
        });
      });
    });
  });
}

// Run DB setup if called directly
if (require.main === module) {
  initDb((err) => {
    if (!err) {
      seedDb();
    }
  });
}

module.exports = {
  db,
  initDb,
  seedDb
};
