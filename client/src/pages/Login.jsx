import React, { useState } from 'react';
import api from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.login(username, password);
      if (response && response.user) {
        onLoginSuccess(response.user);
      } else {
        setError('Login returned unexpected response schema.');
      }
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  // Helper helper to quickly autofill test credentials
  const fillCredentials = (user) => {
    setUsername(user);
    setPassword('password123');
    setError(null);
  };

  return (
    <div style={styles.container}>
      <div className="glass-card" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoCircle}>
            <span style={styles.logoText}>$</span>
          </div>
          <h1 style={styles.title}>Samo Expenses</h1>
          <p style={styles.subtitle}>Ledger Trace & Roommate Settlement Engine</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.errorAlert}>
              <span style={styles.errorDot}></span>
              {error}
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Roommate Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rohan"
              disabled={loading}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={styles.button}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.testerSection}>
          <h3 style={styles.testerTitle}>Demo Roommate Accounts</h3>
          <p style={styles.testerSubtitle}>Click a roommate to autofill (password: <code>password123</code>)</p>
          <div style={styles.pillContainer}>
            {['aisha', 'rohan', 'priya', 'meera', 'sam'].map((u) => (
              <button
                key={u}
                onClick={() => fillCredentials(u)}
                style={styles.pill}
                type="button"
                disabled={loading}
              >
                {u.charAt(0).toUpperCase() + u.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '90vh',
    width: '100vw',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '32px',
    textAlign: 'center',
  },
  logoCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'var(--primary)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '16px',
  },
  logoText: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1d1d1f',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  errorAlert: {
    background: 'rgba(220, 38, 38, 0.05)',
    border: '1px solid var(--debtor-red)',
    color: 'var(--debtor-red)',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--debtor-red)',
    display: 'inline-block',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
  },
  button: {
    marginTop: '10px',
    fontSize: '15px',
    fontWeight: '600',
  },
  testerSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  testerTitle: {
    fontSize: '13px',
    color: '#1d1d1f',
    fontWeight: '600',
    marginBottom: '6px',
  },
  testerSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '14px',
  },
  pillContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
  },
  pill: {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: '#1d1d1f',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
