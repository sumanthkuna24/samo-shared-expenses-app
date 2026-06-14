import React, { useState } from 'react';
import api from '../services/api';

export default function Landing({ onStartLogin, onImportDemo }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleImportDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const loginRes = await api.login('rohan', 'password123');
      await api.importCSV();
      onImportDemo(loginRes.user);
    } catch (err) {
      setError(err.message || 'Failed to import sample dataset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. Header Navbar */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logoCircleSmall}>$</div>
          <span style={styles.brandName}>SAMO</span>
        </div>
        <div style={styles.headerNav}>
          <a href="#usecases" style={styles.headerNavLink}>Use Cases</a>
          <a href="#howitworks" style={styles.headerNavLink}>How it Works</a>
          <a href="#import" style={styles.headerNavLink}>Smart Import</a>
          <button className="btn-primary" style={styles.signInBtn} onClick={onStartLogin}>
            Sign In
          </button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section style={styles.heroSection}>
        <h1 style={styles.heroTitle}>
          Share Experiences.<br />
          <span style={styles.heroGradient}>Settle Expenses Naturally.</span>
        </h1>
        <p style={styles.heroSubtitle}>
          Samo is a premium, math-verified expense ledger for roommates, travelers, and groups.
          Ditch manual spreadsheets and attribute debts accurately.
        </p>

        {error && (
          <div style={styles.errorAlert}>
            <span>⚠️ {error}</span>
          </div>
        )}

        <div style={styles.heroActions}>
          <button 
            className="btn-primary" 
            style={styles.heroBtnPrimary} 
            onClick={onStartLogin}
            disabled={loading}
          >
            Get Started
          </button>
          <button 
            className="btn-secondary" 
            style={styles.heroBtnSecondary} 
            onClick={handleImportDemo}
            disabled={loading}
          >
            {loading ? 'Loading Demo...' : 'Load Sample Data'}
          </button>
        </div>
      </section>

      {/* 3. Use Cases Section */}
      <section id="usecases" style={styles.sectionGray}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Built for Shared Living</h2>
          <p style={styles.sectionSubtitle}>
            Simple splits or complex group dynamics – resolved naturally.
          </p>
        </div>
        <div style={styles.useCaseGrid}>
          <div className="glass-card" style={styles.useCaseCard}>
            <span style={styles.cardIcon}>🏠</span>
            <h3 style={styles.cardTitle}>Roommates</h3>
            <p style={styles.cardDesc}>
              Track rents, utility bills, and shared groceries chronologically, honoring roommate check-in/check-out timelines.
            </p>
          </div>
          <div className="glass-card" style={styles.useCaseCard}>
            <span style={styles.cardIcon}>✈️</span>
            <h3 style={styles.cardTitle}>Trips</h3>
            <p style={styles.cardDesc}>
              Split cabin rentals, dining, and activities equally or by percentages. Handle multiple currencies with ease.
            </p>
          </div>
          <div className="glass-card" style={styles.useCaseCard}>
            <span style={styles.cardIcon}>🍿</span>
            <h3 style={styles.cardTitle}>Friends</h3>
            <p style={styles.cardDesc}>
              Manage recurring digital subscriptions, streaming memberships, and shared dinners transparently.
            </p>
          </div>
          <div className="glass-card" style={styles.useCaseCard}>
            <span style={styles.cardIcon}>🎓</span>
            <h3 style={styles.cardTitle}>College Events</h3>
            <p style={styles.cardDesc}>
              Organize campus parties, projects, and club activities with reliable math audits and clear settlements.
            </p>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="howitworks" style={styles.sectionWhite}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Settle Up in Three Steps</h2>
          <p style={styles.sectionSubtitle}>
            Our minimized cash flow algorithm eliminates redundant transfers.
          </p>
        </div>
        <div style={styles.processGrid}>
          <div style={styles.processStep}>
            <div style={styles.stepNumber}>1</div>
            <h3 style={styles.stepTitle}>Create Group</h3>
            <p style={styles.stepDesc}>Add your roommates or trip friends and choose your base currency.</p>
          </div>
          <div style={styles.processStep}>
            <div style={styles.stepNumber}>2</div>
            <h3 style={styles.stepTitle}>Add Expenses</h3>
            <p style={styles.stepDesc}>Enter who paid, specify custom split percentages or equal portions, and save instantly.</p>
          </div>
          <div style={styles.processStep}>
            <div style={styles.stepNumber}>3</div>
            <h3 style={styles.stepTitle}>Settle Up</h3>
            <p style={styles.stepDesc}>Our greedy cash flow minimization matches debtors with creditors, reducing payments.</p>
          </div>
        </div>
      </section>

      {/* 5. Smart Import Feature Section */}
      <section id="import" style={styles.sectionGray}>
        <div className="glass-card" style={styles.importShowcase}>
          <div style={styles.importShowcaseText}>
            <span style={styles.featureBadge}>ONBOARDING</span>
            <h2 style={styles.showcaseTitle}>Smart CSV Import</h2>
            <p style={styles.showcaseDesc}>
              Have a messy CSV export from other platforms? Upload it to populate your group records.
              Our database scanner detects duplicates, currency gaps, split percentage errors, and ambiguous dates. You review and repair them interactively.
            </p>
            <div style={styles.showcasePills}>
              <span style={styles.showcasePill}>✓ Ambiguous Date Resolution</span>
              <span style={styles.showcasePill}>✓ Auto-Ignore Zero Values</span>
              <span style={styles.showcasePill}>✓ Dynamic Payer Mapping</span>
            </div>
          </div>
          <div style={styles.importShowcaseVisual}>
            <pre style={styles.mockTerminal}>
{`$ npm run scan:anomalies
Scanning database...
[ANOMALY] Line 12: Missing Currency (Warning)
[ANOMALY] Line 19: Ambiguous Date (Error)
[AUTO-IGNORE] Line 24: Zero-Value Swiggy order
Scans completed. 2 items needing review.`}
            </pre>
          </div>
        </div>
      </section>

      {/* 6. Final CTA Section */}
      <section style={styles.ctaSection}>
        <div className="glass-card" style={styles.ctaCard}>
          <h2 style={styles.ctaTitle}>Experience Samo Today</h2>
          <p style={styles.ctaSubtitle}>
            Settle group debts naturally. Sign in or initialize the demo dataset in one click.
          </p>
          <button className="btn-primary" style={styles.ctaBtn} onClick={onStartLogin}>
            Launch Application
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>© 2026 SAMO Expenses. Built for premium shared finance.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    backgroundColor: '#ffffff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    zIndex: 10,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoCircleSmall: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    background: 'var(--primary)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    color: '#fff',
    fontSize: '13px',
  },
  brandName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1d1d1f',
    letterSpacing: '0.05em',
  },
  headerNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  headerNavLink: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'color 0.15s ease',
    ':hover': {
      color: '#1d1d1f',
    }
  },
  signInBtn: {
    padding: '6px 14px',
    fontSize: '13px',
  },
  // Hero Section
  heroSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '100px 20px',
    maxWidth: '800px',
    width: '100%',
    margin: '0 auto',
  },
  heroTitle: {
    fontSize: '52px',
    fontWeight: '800',
    color: '#1d1d1f',
    lineHeight: '1.15',
    letterSpacing: '-0.02em',
    marginBottom: '24px',
  },
  heroGradient: {
    color: 'var(--primary)',
  },
  heroSubtitle: {
    fontSize: '18px',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    marginBottom: '40px',
    maxWidth: '620px',
  },
  errorAlert: {
    background: 'rgba(220, 38, 38, 0.08)',
    border: '1px solid var(--debtor-red)',
    color: 'var(--debtor-red)',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '24px',
  },
  heroActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    width: '100%',
    flexWrap: 'wrap',
  },
  heroBtnPrimary: {
    padding: '12px 28px',
    fontSize: '15px',
    minWidth: '150px',
  },
  heroBtnSecondary: {
    padding: '12px 28px',
    fontSize: '15px',
    minWidth: '150px',
  },
  // Sections
  sectionWhite: {
    padding: '80px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    width: '100%',
    backgroundColor: '#ffffff',
  },
  sectionGray: {
    padding: '80px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    width: '100%',
    backgroundColor: '#f5f5f7',
  },
  sectionHeader: {
    marginBottom: '48px',
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1d1d1f',
    marginBottom: '12px',
  },
  sectionSubtitle: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    maxWidth: '500px',
    margin: '0 auto',
  },
  // Use Case Grid
  useCaseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px',
    maxWidth: '1100px',
    width: '100%',
  },
  useCaseCard: {
    padding: '32px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
  },
  cardIcon: {
    fontSize: '28px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  cardDesc: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
  },
  // Process step mapping
  processGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '40px',
    maxWidth: '1000px',
    width: '100%',
  },
  processStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  stepNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(79, 70, 229, 0.08)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: '700',
    fontSize: '16px',
  },
  stepTitle: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  stepDesc: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    maxWidth: '240px',
  },
  // Showcase
  importShowcase: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '40px',
    maxWidth: '1000px',
    width: '100%',
    padding: '40px',
    textAlign: 'left',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
  },
  importShowcaseText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  featureBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'var(--primary)',
    background: 'rgba(79, 70, 229, 0.08)',
    border: '1px solid rgba(79, 70, 229, 0.15)',
    padding: '2px 8px',
    borderRadius: '20px',
    width: 'fit-content',
    letterSpacing: '0.05em',
  },
  showcaseTitle: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  showcaseDesc: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
  },
  showcasePills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },
  showcasePill: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#1d1d1f',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  importShowcaseVisual: {
    width: '100%',
  },
  mockTerminal: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#374151',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    overflowX: 'auto',
    margin: 0,
    lineHeight: '1.5',
    textAlign: 'left',
  },
  // CTA Section
  ctaSection: {
    padding: '60px 20px',
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  ctaCard: {
    maxWidth: '800px',
    width: '100%',
    padding: '48px 32px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
  },
  ctaTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  ctaSubtitle: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    maxWidth: '400px',
    lineHeight: '1.5',
  },
  ctaBtn: {
    padding: '12px 28px',
    fontSize: '15px',
    marginTop: '10px',
  },
  // Footer
  footer: {
    padding: '32px 20px',
    textAlign: 'center',
    borderTop: '1px solid #e5e7eb',
    color: 'var(--text-dim)',
    fontSize: '12px',
  },
};
