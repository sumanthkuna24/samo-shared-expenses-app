import React, { useState, useEffect, useCallback } from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Ledger from './pages/Ledger';
import AnomalyResolver from './pages/AnomalyResolver';
import api from './services/api';

export default function App() {
  // Global Session State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('samo_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Landing / Login toggle state for unauthenticated users
  const [showLogin, setShowLogin] = useState(false);

  // Navigation & Page State
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // App Data States
  const [balancesData, setBalancesData] = useState({
    status: 'clean',
    balances: [],
    settlements: [],
    unresolvedAnomaliesCount: 0
  });
  const [anomalies, setAnomalies] = useState([]);
  const [roommates, setRoommates] = useState([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [criticalError, setCriticalError] = useState(null);
  const [appError, setAppError] = useState(null);

  // Synchronized Data Fetching
  const refreshData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setAppError(null);
    try {
      const [balRes, anomRes, roomRes] = await Promise.all([
        api.getBalances(user.roommate_id),
        api.getAnomalies(user.roommate_id),
        api.getRoommates(user.roommate_id)
      ]);


      setBalancesData(balRes);
      setAnomalies(anomRes);
      setRoommates(roomRes);
      setCriticalError(null);
    } catch (err) {
      console.error('Data Sync Error:', err);
      if (err.message && (err.message.includes('invariant') || err.message.includes('sum') || err.message.includes('equal zero'))) {
        setCriticalError(err.message);
      } else {
        setAppError(err.message || 'Failed to sync application state.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Sync state on login or reload
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  // Auth Handlers
  const handleLoginSuccess = (userData) => {
    localStorage.setItem('samo_user', JSON.stringify(userData));
    setUser(userData);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('samo_user');
    setUser(null);
    setShowLogin(false);
    setActiveTab('dashboard');
    setCriticalError(null);
  };

  // 1. Unauthenticated Routing Shell
  if (!user) {
    if (showLogin) {
      return (
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowLogin(false)} 
            style={styles.backToHomeBtn}
            className="btn-secondary"
          >
            ← Back to Home
          </button>
          <Login onLoginSuccess={handleLoginSuccess} />
        </div>
      );
    }
    return (
      <Landing 
        onStartLogin={() => setShowLogin(true)} 
        onImportDemo={handleLoginSuccess} 
      />
    );
  }

  // Critical Mathematical Integrity Lock Shield (Consumer friendly reword)
  if (criticalError) {
    return (
      <div style={styles.criticalContainer}>
        <div className="glass-card" style={styles.criticalCard}>
          <h1 style={styles.criticalHeader}>❌ System Calculation Status Compromised</h1>
          <p style={styles.criticalSubheader}>
            Math invariants failed. The sum of all net balances does not equal zero. Please resolve splits in the Import Review tab to recover balance.
          </p>
          <div style={styles.criticalDetailsBox}>
            <strong>Verification Details:</strong>
            <pre style={styles.preError}>{criticalError}</pre>
          </div>
          <div style={styles.criticalActions}>
            <button 
              className="btn-primary" 
              onClick={() => {
                setCriticalError(null);
                setActiveTab('resolver');
                refreshData();
              }}
            >
              Go to Import Review
            </button>
            <button 
              className="btn-secondary" 
              style={{ marginLeft: '12px' }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Anomaly Counts for Badges
  const unresolvedErrorsCount = anomalies.filter(a => a.severity === 'error').length;
  const totalUnresolvedCount = anomalies.length;

  return (
    <div style={styles.appContainer}>
      {/* Top Navbar */}
      <header className="glass-card" style={styles.navbar}>
        <div style={styles.brand}>
          <div style={styles.miniLogo}>$</div>
          <span style={styles.brandName}>SAMO</span>
        </div>

        {/* Tab Selection (Terminology Simplification applied) */}
        <nav style={styles.navMenu}>
          <button
            style={activeTab === 'dashboard' ? styles.activeNavLink : styles.navLink}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            style={activeTab === 'resolver' ? styles.activeNavLink : styles.navLink}
            onClick={() => setActiveTab('resolver')}
          >
            Import Review
            {totalUnresolvedCount > 0 && (
              <span 
                style={{
                  ...styles.badge, 
                  backgroundColor: unresolvedErrorsCount > 0 ? 'var(--debtor-red)' : '#f59e0b'
                }}
              >
                {totalUnresolvedCount}
              </span>
            )}
          </button>
          <button
            style={activeTab === 'ledger' ? styles.activeNavLink : styles.navLink}
            onClick={() => setActiveTab('ledger')}
          >
            Expense History
          </button>
        </nav>

        {/* User Session Info */}
        <div style={styles.userInfo}>
          <span style={styles.userProfile}>
            <span style={styles.statusDot}></span>
            {user.roommate_name}
          </span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={styles.content}>
        {appError && (
          <div style={styles.errorBanner}>
            <span>⚠️ {appError}</span>
            <button style={styles.dismissBtn} onClick={() => setAppError(null)}>×</button>
          </div>
        )}

        {/* Conditional Tab Rendering */}
        <div style={styles.pageContainer}>
          {activeTab === 'dashboard' && (
            <Dashboard 
              balancesData={balancesData}
              user={user}
              onRefresh={refreshData}
              loading={loading}
              roommates={roommates}
            />
          )}
          {activeTab === 'resolver' && (
            <AnomalyResolver 
              anomalies={anomalies}
              onRefresh={refreshData}
              roommates={roommates}
              user={user}
            />
          )}
          {activeTab === 'ledger' && (
            <Ledger 
              roommates={roommates}
              user={user}
            />
          )}
        </div>
      </main>
    </div>
  );
}

const styles = {
  appContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
  },
  backToHomeBtn: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: 10,
    padding: '8px 16px',
    fontSize: '13px',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    margin: '16px 24px 0 24px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  miniLogo: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'var(--primary)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    color: '#fff',
    fontSize: '16px',
  },
  brandName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1d1d1f',
    letterSpacing: '0.02em',
  },
  navMenu: {
    display: 'flex',
    gap: '4px',
  },
  navLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  activeNavLink: {
    background: 'rgba(79, 70, 229, 0.08)',
    border: 'none',
    color: 'var(--primary)',
    fontSize: '14px',
    fontWeight: '600',
    padding: '8px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  badge: {
    padding: '1px 6px',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 'bold',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1d1d1f',
    background: '#f3f4f6',
    padding: '6px 12px',
    borderRadius: '20px',
    border: '1px solid #e5e7eb',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-teal)',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.15s ease',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 24px 24px 24px',
  },
  errorBanner: {
    background: 'rgba(220, 38, 38, 0.05)',
    border: '1px solid var(--debtor-red)',
    color: 'var(--debtor-red)',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--debtor-red)',
    fontSize: '20px',
    cursor: 'pointer',
  },
  pageContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  criticalContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100vw',
    padding: '20px',
    backgroundColor: '#f5f5f7',
  },
  criticalCard: {
    width: '100%',
    maxWidth: '560px',
    padding: '40px',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid var(--debtor-red)',
    boxShadow: '0 10px 30px rgba(220, 38, 38, 0.05)',
  },
  criticalHeader: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1d1d1f',
    marginBottom: '16px',
  },
  criticalSubheader: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  criticalDetailsBox: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'left',
    marginBottom: '24px',
  },
  preError: {
    margin: '8px 0 0 0',
    color: 'var(--debtor-red)',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  criticalActions: {
    display: 'flex',
    justifyContent: 'center',
  },
};
