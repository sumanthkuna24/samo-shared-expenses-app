import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function Ledger({ roommates, user }) {
  const [selectedRoommateName, setSelectedRoommateName] = useState('');
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Default to the logged-in roommate's profile
  useEffect(() => {
    if (user && user.roommate_name) {
      setSelectedRoommateName(user.roommate_name);
    } else if (roommates && roommates.length > 0) {
      setSelectedRoommateName(roommates[0].name);
    }
  }, [user, roommates]);

  const fetchLedger = useCallback(async () => {
    if (!selectedRoommateName || !user?.roommate_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLedger(selectedRoommateName, user.roommate_id);
      setLedger(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve roommate ledger statements.');
      setLedger([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRoommateName, user?.roommate_id]);

  // Fetch ledger whenever the selected roommate changes
  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);


  const toggleRowExpand = (id) => {
    if (expandedRowId === id) {
      setExpandedRowId(null);
    } else {
      setExpandedRowId(id);
    }
  };

  // Math aggregates logic
  let totalPaid = 0;
  let totalShare = 0;
  let settlementsSent = 0;
  let settlementsReceived = 0;

  ledger.forEach((item) => {
    if (item.status !== 'active') return;
    const rate = item.exchange_rate || 1.0;

    if (item.type === 'expense') {
      totalPaid += item.paid_amount * rate;
      totalShare += item.share_amount * rate;
    } else if (item.type === 'settlement') {
      if (item.description.toLowerCase().includes('sent')) {
        settlementsSent += item.amount * rate;
      } else {
        settlementsReceived += item.amount * rate;
      }
    }
  });

  const finalNet = totalPaid - totalShare + settlementsSent - settlementsReceived;

  if (!roommates || roommates.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.topSection}>
          <div className="glass-card" style={styles.selectorCard}>
            <label style={styles.selectLabel}>Select Roommate Ledger</label>
            <select className="form-input" disabled style={styles.select}>
              <option>No roommates available</option>
            </select>
          </div>
        </div>

        <div className="glass-card" style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>Chronological Balance Breakdown</h3>
            <span style={styles.tableSubtitle}>Select any row to view raw CSV details, currency exchange, and split participants.</span>
          </div>
          <div style={styles.emptyBox}>No transactions available</div>
        </div>
      </div>
    );
  }

  return (

    <div style={styles.container}>
      {/* Selector & Summary */}
      <div style={styles.topSection}>
        <div className="glass-card" style={styles.selectorCard}>
          <label style={styles.selectLabel}>Select Roommate Ledger</label>
          <select
            className="form-input"
            value={selectedRoommateName}
            onChange={(e) => setSelectedRoommateName(e.target.value)}
            style={styles.select}
            disabled={loading}
          >
            {roommates.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name} {user && user.roommate_name === r.name ? '(You)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Aggregates Card */}
        <div className="glass-card" style={styles.summaryCard}>
          <div style={styles.sumCol}>
            <span style={styles.sumLabel}>Total Paid</span>
            <span style={styles.sumValue}>₹{Math.round(totalPaid).toLocaleString()}</span>
          </div>
          <div style={styles.sumDivider} />
          <div style={styles.sumCol}>
            <span style={styles.sumLabel}>Total Share</span>
            <span style={styles.sumValue}>₹{Math.round(totalShare).toLocaleString()}</span>
          </div>
          <div style={styles.sumDivider} />
          <div style={styles.sumCol}>
            <span style={styles.sumLabel}>Sent Repayments</span>
            <span style={styles.sumValue}>₹{Math.round(settlementsSent).toLocaleString()}</span>
          </div>
          <div style={styles.sumDivider} />
          <div style={styles.sumCol}>
            <span style={styles.sumLabel}>Received Repayments</span>
            <span style={styles.sumValue}>₹{Math.round(settlementsReceived).toLocaleString()}</span>
          </div>
          <div style={styles.sumDivider} />
          <div style={styles.sumCol}>
            <span style={styles.sumLabel}>Calculated Net</span>
            <span 
              style={{
                ...styles.sumValue,
                color: finalNet > 0.01 ? 'var(--creditor-green)' : finalNet < -0.01 ? 'var(--debtor-red)' : 'var(--text-main)'
              }}
            >
              {finalNet > 0.01 ? '+' : ''}₹{Math.round(finalNet).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

      {/* Main Ledger Table */}
      <div className="glass-card" style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>Chronological Balance Breakdown</h3>
          <span style={styles.tableSubtitle}>Select any row to view raw CSV details, currency exchange, and split participants.</span>
        </div>

        <div style={styles.tableWrapper}>
          {loading ? (
            <div style={styles.loadingBox}>
              <span style={styles.spinner}></span>
              <span>Loading roommate ledger records...</span>
            </div>
          ) : ledger.length === 0 ? (
            <div style={styles.emptyBox}>No transactions available</div>
          ) : (

            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.thAlignRight}>Paid Contrib</th>
                  <th style={styles.thAlignRight}>Share Amt</th>
                  <th style={styles.thAlignRight}>Net Impact</th>
                  <th style={styles.thAlignRight}>Running Balance</th>
                  <th style={styles.thCenter}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((item, index) => {
                  const id = `${item.type}-${item.id || index}`;
                  const isExpanded = expandedRowId === id;
                  const isExcluded = item.status === 'excluded';
                  const rate = item.exchange_rate || 1.0;

                  return (
                    <React.Fragment key={id}>
                      <tr
                        onClick={() => toggleRowExpand(id)}
                        style={{
                          ...styles.tr,
                          backgroundColor: isExpanded ? 'rgba(243, 244, 264, 0.2)' : 'transparent',
                          opacity: isExcluded ? 0.6 : 1,
                        }}
                      >
                        <td style={styles.tdDate}>{item.date}</td>
                        <td style={styles.tdDesc}>
                          <div style={styles.descFlex}>
                            <span>{item.description}</span>
                            <span 
                              style={{
                                ...styles.typeTag,
                                color: item.type === 'expense' ? 'var(--primary)' : 'var(--accent-teal)',
                                background: item.type === 'expense' ? 'rgba(79, 70, 229, 0.08)' : 'rgba(13, 148, 136, 0.08)'
                              }}
                            >
                              {item.type}
                            </span>
                          </div>
                        </td>
                        <td style={styles.tdAlignRight}>₹{Math.round(item.paid_amount * rate).toLocaleString()}</td>
                        <td style={styles.tdAlignRight}>₹{Math.round(item.share_amount * rate).toLocaleString()}</td>
                        <td 
                          style={{ 
                            ...styles.tdAlignRight, 
                            fontWeight: '600',
                            color: item.net_impact > 0.01 ? 'var(--creditor-green)' : item.net_impact < -0.01 ? 'var(--debtor-red)' : 'var(--text-dim)' 
                          }}
                        >
                          {item.net_impact > 0.01 ? '+' : ''}₹{item.net_impact.toLocaleString()}
                        </td>
                        <td style={{ ...styles.tdAlignRight, fontWeight: '600' }}>
                          ₹{item.running_balance.toLocaleString()}
                        </td>
                        <td style={styles.tdCenter}>
                          <span 
                            style={{
                              ...styles.statusLabel,
                              color: isExcluded ? '#b45309' : 'var(--creditor-green)',
                              borderColor: isExcluded ? '#fde68a' : 'rgba(22, 163, 74, 0.2)',
                              backgroundColor: isExcluded ? '#fef3c7' : 'rgba(22, 163, 74, 0.05)'
                            }}
                          >
                            {isExcluded ? 'Needs Review' : 'Final'}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Trace details panel (Houses accounting complexity) */}
                      {isExpanded && (
                        <tr style={styles.expandRow}>
                          <td colSpan="7" style={styles.expandTd}>
                            <div style={styles.expandContent}>
                              <div style={styles.detailsGrid}>
                                <div style={styles.detailBlock}>
                                  <span style={styles.detailLabel}>Raw Data Log</span>
                                  <pre style={styles.csvPre}>{item.raw_csv_row || 'No log registered.'}</pre>
                                </div>
                                <div style={styles.detailBlock}>
                                  <span style={styles.detailLabel}>Transaction Details</span>
                                  <div style={styles.metaBox}>
                                    <div><strong>Split Type:</strong> {(item.split_type || 'repayment').replace(/_/g, ' ')}</div>
                                    <div>
                                      <strong>Original Currency Details:</strong> {item.amount} {item.currency} 
                                      {item.currency !== 'INR' && ` (Converted using rate ${rate.toFixed(2)})`}
                                    </div>
                                    <div>
                                      <strong>People Involved:</strong> {item.split_members && item.split_members.length > 0 ? item.split_members.join(', ') : 'Direct Repayment'}
                                    </div>
                                    {item.notes && <div><strong>Notes:</strong> {item.notes}</div>}
                                  </div>
                                </div>
                              </div>

                              {isExcluded && item.anomalies && item.anomalies.length > 0 && (
                                <div style={styles.exclusionAlert}>
                                  <span style={styles.exclusionTitle}>⚠️ Timeline Blockers:</span>
                                  <ul style={styles.exclusionList}>
                                    {item.anomalies.map((anom, aIdx) => (
                                      <li key={aIdx}>
                                        <strong>{anom.category.toUpperCase()}:</strong> {anom.description}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. BALANCE ARITHMETIC EXPLANATION PANEL */}
      <div className="glass-card" style={styles.explanationCard}>
        <h3 style={styles.explanationTitle}>Balance Verification</h3>
        <p style={styles.explanationSubtitle}>
          The net roommate balance is derived from: Paid Contribution - Shared Splits + Sent Repayments - Received Repayments.
        </p>

        <div style={styles.mathBlock}>
          <div style={styles.mathEquation}>
            <span style={styles.mathValue}>₹{Math.round(totalPaid).toLocaleString()}</span>
            <span style={styles.mathOp}>-</span>
            <span style={styles.mathValue}>₹{Math.round(totalShare).toLocaleString()}</span>
            <span style={styles.mathOp}>+</span>
            <span style={styles.mathValue}>₹{Math.round(settlementsSent).toLocaleString()}</span>
            <span style={styles.mathOp}>-</span>
            <span style={styles.mathValue}>₹{Math.round(settlementsReceived).toLocaleString()}</span>
            <span style={styles.mathEquals}>=</span>
            <span 
              style={{
                ...styles.mathResult,
                color: finalNet > 0.01 ? 'var(--creditor-green)' : finalNet < -0.01 ? 'var(--debtor-red)' : 'var(--text-main)'
              }}
            >
              ₹{Math.round(finalNet).toLocaleString()}
            </span>
          </div>

          <div style={styles.mathLegends}>
            <span style={styles.legend}>Paid Contribution</span>
            <span style={styles.legendOp} />
            <span style={styles.legend}>Shared Splits</span>
            <span style={styles.legendOp} />
            <span style={styles.legend}>Sent Payments</span>
            <span style={styles.legendOp} />
            <span style={styles.legend}>Received Payments</span>
            <span style={styles.legendOp} />
            <span style={styles.legend}>Net Balance</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    width: '100%',
  },
  topSection: {
    display: 'flex',
    gap: '20px',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  selectorCard: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '8px',
    width: '300px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  selectLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  select: {
    width: '100%',
  },
  summaryCard: {
    flex: 1,
    padding: '20px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  sumCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sumLabel: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  sumValue: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  sumDivider: {
    width: '1px',
    height: '40px',
    backgroundColor: '#e5e7eb',
    '@media (max-width: 768px)': {
      display: 'none',
    }
  },
  errorAlert: {
    padding: '12px 20px',
    borderRadius: '8px',
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    border: '1px solid var(--debtor-red)',
    color: 'var(--debtor-red)',
    fontSize: '14px',
  },
  tableCard: {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  tableHeader: {
    marginBottom: '20px',
  },
  tableTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1d1d1f',
    marginBottom: '4px',
  },
  tableSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  thRow: {
    borderBottom: '1px solid #e5e7eb',
  },
  th: {
    padding: '12px 16px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  thAlignRight: {
    padding: '12px 16px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'right',
  },
  thCenter: {
    padding: '12px 16px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'center',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  tdDate: {
    padding: '16px',
    fontSize: '14px',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  tdDesc: {
    padding: '16px',
    fontSize: '14px',
    color: '#1d1d1f',
    fontWeight: '500',
  },
  descFlex: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  typeTag: {
    fontSize: '9px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.05em',
  },
  tdAlignRight: {
    padding: '16px',
    textAlign: 'right',
    fontSize: '14px',
    color: '#1d1d1f',
  },
  tdCenter: {
    padding: '16px',
    textAlign: 'center',
  },
  statusLabel: {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 'bold',
    border: '1px solid',
  },
  expandRow: {
    background: '#f9fafb',
  },
  expandTd: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
  },
  expandContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    }
  },
  detailBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  csvPre: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#374151',
    background: '#ffffff',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    margin: 0,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  metaBox: {
    fontSize: '13px',
    color: '#374151',
    background: '#ffffff',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  exclusionAlert: {
    background: 'rgba(220, 38, 38, 0.05)',
    border: '1px solid var(--debtor-red)',
    padding: '12px 16px',
    borderRadius: '8px',
  },
  exclusionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--debtor-red)',
    display: 'block',
    marginBottom: '6px',
  },
  exclusionList: {
    margin: '0 0 0 16px',
    padding: 0,
    fontSize: '12px',
    color: '#374151',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  explanationCard: {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  explanationTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1d1d1f',
    marginBottom: '4px',
  },
  explanationSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '20px',
  },
  mathBlock: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  mathEquation: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  mathValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1d1d1f',
    background: '#ffffff',
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  mathOp: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-muted)',
  },
  mathEquals: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1d1d1f',
  },
  mathResult: {
    fontSize: '22px',
    fontWeight: '800',
    background: 'rgba(79, 70, 229, 0.08)',
    padding: '8px 18px',
    borderRadius: '8px',
    border: '1px solid var(--primary)',
  },
  mathLegends: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    width: '100%',
    maxWidth: '800px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  legend: {
    textAlign: 'center',
    width: '110px',
  },
  legendOp: {
    width: '15px',
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '60px',
    color: 'var(--text-muted)',
  },
  emptyBox: {
    padding: '60px',
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(0, 0, 0, 0.1)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }
};
