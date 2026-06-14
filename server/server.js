const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { initDb, seedDb, db } = require('./database');
const { importCSV } = require('./csvParser');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize and Seed Database on boot
initDb((err) => {
  if (err) {
    console.error('Failed to initialize database tables:', err);
  } else {
    seedDb((err) => {
      if (err) {
        console.error('Failed to seed database:', err);
      }
    });
  }
});

// --- Express API Routes ---

// CSV Import Route
app.post('/api/import', (req, res) => {
  console.log('Received request to import expenses CSV...');

  db.serialize(() => {
    // 1. Truncate transaction-related tables for fresh testing
    db.run('DELETE FROM expense_splits');
    db.run('DELETE FROM data_anomalies');
    db.run('DELETE FROM decision_log');
    db.run('DELETE FROM settlements');
    db.run('DELETE FROM expenses', (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to clear tables: ' + err.message });
      }

      // 2. Trigger parsing of the local CSV file
      const csvPath = path.resolve(__dirname, '../expenses_export.csv');
      importCSV(csvPath, (err) => {
        if (err) {
          return res.status(500).json({ error: 'CSV Import failed: ' + err.message });
        }
        
        // 3. Chain runAnomalyScan immediately on import completion
        const { runAnomalyScan } = require('./anomalyDetector');
        runAnomalyScan((err, unresolvedCount) => {
          if (err) {
            return res.status(500).json({ error: 'Post-import anomaly scan failed: ' + err.message });
          }
          res.json({ 
            message: 'CSV imported successfully. Post-import anomaly scan completed.',
            unresolvedAnomalies: unresolvedCount
          });
        });
      });
    });
  });
});

// Trigger Anomaly Scan Route
app.post('/api/anomalies/scan', (req, res) => {
  const { runAnomalyScan } = require('./anomalyDetector');
  runAnomalyScan((err, unresolvedCount) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Anomaly scan completed.', unresolvedAnomaliesCount: unresolvedCount });
  });
});

// Retrieve Unresolved Anomalies
app.get('/api/anomalies', (req, res) => {
  db.all(`
    SELECT da.id, da.category, da.description, da.severity, da.status,
           e.id as expense_id, e.description as expense_description, e.amount, e.currency, e.raw_date
    FROM data_anomalies da
    LEFT JOIN expenses e ON da.expense_id = e.id
    WHERE da.status = 'unresolved'
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Resolve Anomaly Route
app.post('/api/anomalies/resolve', (req, res) => {
  const { anomalyId, actionType, details } = req.body;

  if (!anomalyId || !actionType || !details) {
    return res.status(400).json({ error: 'anomalyId, actionType, and details parameters are required.' });
  }

  const { resolveAnomaly, runAnomalyScan } = require('./anomalyDetector');
  resolveAnomaly(anomalyId, actionType, details, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // After resolving, re-run scan to update status of timeline overlaps/duplicates
    runAnomalyScan((err, unresolvedCount) => {
      res.json({ message: 'Anomaly resolved successfully.', unresolvedAnomaliesCount: unresolvedCount });
    });
  });
});

// Retrieve Net Balances and Settlement Recommendations
app.get('/api/balances', (req, res) => {
  const { getNetBalances, calculateSettlements } = require('./balanceEngine');

  getNetBalances((err, balances, excludedCount) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const settlements = calculateSettlements(balances);
      
      // Query database counts for the Import Summary Card statistics
      db.get('SELECT COUNT(*) as expCount FROM expenses', (err, r1) => {
        if (err) return res.status(500).json({ error: 'Stats query error: ' + err.message });
        
        db.get('SELECT COUNT(*) as setCount FROM settlements', (err, r2) => {
          if (err) return res.status(500).json({ error: 'Stats query error: ' + err.message });
          
          db.get('SELECT COUNT(*) as anomCount FROM data_anomalies', (err, r3) => {
            if (err) return res.status(500).json({ error: 'Stats query error: ' + err.message });
            
            db.get('SELECT COUNT(*) as warnCount FROM data_anomalies WHERE severity = "warning"', (err, r4) => {
              if (err) return res.status(500).json({ error: 'Stats query error: ' + err.message });
              
              db.get('SELECT COUNT(*) as errCount FROM data_anomalies WHERE severity = "error"', (err, r5) => {
                if (err) return res.status(500).json({ error: 'Stats query error: ' + err.message });
                
                res.json({
                  status: excludedCount > 0 ? 'provisional' : 'clean',
                  unresolvedAnomaliesCount: excludedCount,
                  balances,
                  settlements,
                  stats: {
                    totalExpenses: r1.expCount,
                    totalSettlements: r2.setCount,
                    totalAnomalies: r3.anomCount,
                    warningAnomalies: r4.warnCount,
                    errorAnomalies: r5.errCount
                  }
                });
              });
            });
          });
        });
      });
    } catch (calcErr) {
      res.status(500).json({ error: calcErr.message });
    }
  });
});

// Retrieve Chronological Ledger Statement for Roommate
app.get('/api/roommates/:name/ledger', (req, res) => {
  const roommateName = req.params.name;
  const { getRoommateLedger } = require('./balanceEngine');

  getRoommateLedger(roommateName, (err, ledger) => {
    if (err) {
      return res.status(404).json({ error: err.message });
    }
    res.json(ledger);
  });
});

// Retrieve Decision Resolution Audit Log
app.get('/api/decision-log', (req, res) => {
  db.all(`
    SELECT id, action_type, resolution_details, timestamp 
    FROM decision_log 
    ORDER BY timestamp DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Parse details string to JSON objects for cleaner API consumption
    const parsedLogs = rows.map(r => ({
      ...r,
      resolution_details: JSON.parse(r.resolution_details)
    }));
    res.json(parsedLogs);
  });
});

// Health Check Status
app.get('/api/status', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM groups', [], (err, row) => {
    if (err) {
      return res.status(500).json({ status: 'ERROR', error: err.message });
    }
    res.json({
      status: 'OK',
      message: 'Server is running and SQLite database is connected.',
      database: {
        groups: row ? row.count : 0
      }
    });
  });
});

// User Login Route
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUsername = username.toLowerCase().trim();

  // Lookup user in DB
  db.get(`
    SELECT u.*, r.name as roommate_name 
    FROM users u
    LEFT JOIN roommates r ON u.roommate_id = r.id
    WHERE u.username = ?
  `, [cleanUsername], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Compare passwords using bcryptjs
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      // Success response (session information)
      res.json({
        message: 'Login successful.',
        user: {
          id: user.id,
          username: user.username,
          roommate_id: user.roommate_id,
          roommate_name: user.roommate_name
        }
      });
    });
  });
});

// Retrieve Roommates Registry & Memberships
app.get('/api/roommates', (req, res) => {
  db.all(`
    SELECT r.id, r.name, gm.joined_at, gm.left_at
    FROM roommates r
    JOIN group_memberships gm ON r.id = gm.roommate_id
    ORDER BY gm.joined_at ASC
  `, [], (err, roommatesList) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(roommatesList);
  });
});

// Create New Roommate and Membership Timeline
app.post('/api/roommates', (req, res) => {
  const { name, joined_at } = req.body;

  if (!name || !joined_at) {
    return res.status(400).json({ error: 'Name and joined_at parameters are required.' });
  }

  db.serialize(() => {
    // 1. Insert into roommates
    db.run('INSERT INTO roommates (name) VALUES (?)', [name], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create roommate: ' + err.message });
      }
      
      const roommateId = this.lastID;

      // 2. Add group membership (defaulting to group_id = 1)
      db.run(`
        INSERT INTO group_memberships (group_id, roommate_id, joined_at)
        VALUES (1, ?, ?)
      `, [roommateId, joined_at], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to create group membership: ' + err.message });
        }
        
        res.json({
          id: roommateId,
          name,
          joined_at,
          left_at: null
        });
      });
    });
  });
});

// Create New Expense Group
app.post('/api/groups', (req, res) => {
  const { name, base_currency } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  db.run('INSERT INTO groups (name, base_currency) VALUES (?, ?)', [name, base_currency || 'INR'], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create group: ' + err.message });
    }
    res.json({
      id: this.lastID,
      name,
      base_currency: base_currency || 'INR'
    });
  });
});

// Record Manual Shared Expense & Compute Splits
app.post('/api/expenses', (req, res) => {
  const { group_id, description, amount, currency, paid_by_id, split_type, raw_date, splits } = req.body;

  if (!description || !amount || !currency || !raw_date || !splits || splits.length === 0) {
    return res.status(400).json({ error: 'Missing required expense parameters (description, amount, currency, raw_date, splits).' });
  }

  const rate = currency.toUpperCase() === 'USD' ? 83.0 : 1.0;
  const numAmount = parseFloat(amount);
  const payerId = paid_by_id ? parseInt(paid_by_id) : null;

  db.serialize(() => {
    // 1. Insert expense record
    db.run(`
      INSERT INTO expenses (group_id, description, amount, currency, exchange_rate, paid_by_id, split_type, raw_date, parsed_date, anomaly_status, raw_csv_row)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'clean', ?)
    `, [
      group_id || 1,
      description,
      numAmount,
      currency.toUpperCase(),
      rate,
      payerId,
      split_type,
      raw_date,
      raw_date,
      `Manual: ${description} | Paid by: ${paid_by_id} | Amount: ${amount} ${currency}`
    ], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to insert expense record: ' + err.message });
      }

      const expenseId = this.lastID;

      // 2. Insert roommate split allocations
      let splitError = null;
      db.serialize(() => {
        splits.forEach(s => {
          const roommateId = parseInt(s.roommate_id);
          const prop = parseFloat(s.proportion);
          const shareAmt = split_type === 'equal' 
            ? (numAmount / splits.length) 
            : (numAmount * (prop / 100));

          db.run(`
            INSERT INTO expense_splits (expense_id, roommate_id, share_amount, share_proportion)
            VALUES (?, ?, ?, ?)
          `, [expenseId, roommateId, shareAmt, prop], (err) => {
            if (err) splitError = err;
          });
        });

        // 3. Re-run scan to check for warnings on the newly created record
        const { runAnomalyScan } = require('./anomalyDetector');
        runAnomalyScan((err, unresolvedCount) => {
          if (splitError || err) {
            return res.status(500).json({ error: 'Split write or post-write scan failed: ' + (splitError?.message || err?.message) });
          }
          res.json({
            message: 'Expense and split shares recorded successfully.',
            expenseId,
            unresolvedAnomalies: unresolvedCount
          });
        });
      });
    });
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Shared Expenses Server running on http://localhost:${PORT}`);
  console.log(`==================================================`);
});
