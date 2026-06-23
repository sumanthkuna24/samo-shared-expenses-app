import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function AnomalyResolver({ anomalies, roommates, onRefresh, user }) {
  const [decisionLogs, setDecisionLogs] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // States for inline forms (keyed by anomaly ID)
  const [payerSelections, setPayerSelections] = useState({});
  const [currencySelections, setCurrencySelections] = useState({});
  const [customCurrencyInputs, setCustomCurrencyInputs] = useState({});
  const [dateSelections, setDateSelections] = useState({});
  const [customDateInputs, setCustomDateInputs] = useState({});
  const [duplicateSelections, setDuplicateSelections] = useState({});
  const [temporalRoommateSelections, setTemporalRoommateSelections] = useState({});
  const [percentageSplits, setPercentageSplits] = useState({});

  // Inline Member Addition form state (keyed by anomaly ID)
  const [showAddMember, setShowAddMember] = useState({});
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberJoinDate, setNewMemberJoinDate] = useState('2026-02-01');

  const fetchDecisionLogs = useCallback(async () => {
    if (!user?.roommate_id) return;
    try {
      const logs = await api.getDecisionLog(user.roommate_id);
      setDecisionLogs(logs);
    } catch (err) {
      console.error('Failed to load audit history:', err);
    }
  }, [user?.roommate_id]);

  useEffect(() => {
    fetchDecisionLogs();
  }, [fetchDecisionLogs]);

  // Initialize form default values when anomalies list updates
  useEffect(() => {
    const payers = {};
    const currencies = {};
    const customCurrencies = {};
    const dates = {};
    const customDates = {};
    const duplicates = {};
    const temporals = {};
    const splits = {};

    anomalies.forEach((a) => {
      // Default currency selection
      currencies[a.id] = 'INR';
      customCurrencies[a.id] = '';

      // Default ambiguous date selection
      if (a.category === 'ambiguous_date' && a.raw_date) {
        const parts = a.raw_date.split('/');
        if (parts.length === 3) {
          dates[a.id] = `2026-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // Default duplicate resolution
      duplicates[a.id] = 'keep_first';

      // Default temporal violation select
      if (a.category === 'temporal_violation') {
        const nameMatch = a.description.match(/roommate\s+([A-Za-z]+)\s+was/);
        if (nameMatch) {
          const matchingRoommate = roommates.find(
            (r) => r.name.toLowerCase() === nameMatch[1].toLowerCase()
          );
          if (matchingRoommate) temporals[a.id] = matchingRoommate.id.toString();
        }
      }

      // Default percentage splits
      if (a.category === 'split_sum_error') {
        const initialPct = {};
        roommates.forEach((r) => {
          initialPct[r.id] = {
            enabled: true,
            proportion: Math.round(100 / roommates.length)
          };
        });
        splits[a.id] = initialPct;
      }
    });

    setPayerSelections(payers);
    setCurrencySelections(currencies);
    setCustomCurrencyInputs(customCurrencies);
    setDateSelections(dates);
    setCustomDateInputs(customDates);
    setDuplicateSelections(duplicates);
    setTemporalRoommateSelections(temporals);
    setPercentageSplits(splits);
  }, [anomalies, roommates]);

  const handleCreateMember = async (e, anomalyId) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setError('Please enter a name for the new member.');
      return;
    }
    try {
      setResolvingId(anomalyId);
      const newRoommate = await api.createRoommate(newMemberName.trim(), newMemberJoinDate, user.roommate_id);
      
      // Refresh options list
      await onRefresh();
      
      // Auto-assign newly created roommate
      setPayerSelections(prev => ({
        ...prev,
        [anomalyId]: newRoommate.id.toString()
      }));

      setShowAddMember(prev => ({ ...prev, [anomalyId]: false }));
      setNewMemberName('');
      setSuccessMsg(`Member "${newRoommate.name}" registered successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to register new member.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleResolve = async (anomaly, classificationOverride = null) => {
    setResolvingId(anomaly.id);
    setError(null);
    setSuccessMsg(null);

    let actionType = '';
    let details = {};

    try {
      switch (anomaly.category) {
        case 'missing_payer': {
          const payerId = payerSelections[anomaly.id];
          if (!payerId) throw new Error('Please choose a member.');
          actionType = 'assign_payer';
          details = { roommate_id: parseInt(payerId) };
          break;
        }

        case 'missing_currency': {
          const currSelect = currencySelections[anomaly.id];
          const customInput = customCurrencyInputs[anomaly.id];
          const finalCurrency = currSelect === 'custom' ? customInput.trim() : currSelect;
          if (!finalCurrency) throw new Error('Please select or write a currency.');
          actionType = 'resolve_currency';
          details = { currency: finalCurrency.toUpperCase() };
          break;
        }

        case 'ambiguous_date': {
          const dateSelect = dateSelections[anomaly.id];
          const customDate = customDateInputs[anomaly.id];
          const finalDate = dateSelect === 'custom' ? customDate : dateSelect;
          if (!finalDate) throw new Error('Please select or specify a date.');
          actionType = 'resolve_date';
          details = { parsed_date: finalDate };
          break;
        }

        case 'duplicate': {
          actionType = 'merge_duplicate';
          const match = anomaly.description.match(/ID:\s*(\d+)/);
          const originalId = match ? parseInt(match[1]) : null;
          if (!originalId) throw new Error('Could not identify first payment ID.');
          
          const choice = duplicateSelections[anomaly.id];
          if (choice === 'keep_first') {
            details = { keep_expense_id: originalId, discard_expense_id: anomaly.expense_id };
          } else {
            details = { keep_expense_id: anomaly.expense_id, discard_expense_id: originalId };
          }
          break;
        }

        case 'temporal_violation': {
          const tempRoommateId = temporalRoommateSelections[anomaly.id];
          if (!tempRoommateId) throw new Error('Please choose who to remove.');
          actionType = 'remove_roommate_split';
          details = { roommate_id: parseInt(tempRoommateId) };
          break;
        }

        case 'split_sum_error': {
          actionType = 'adjust_splits';
          const pSplits = percentageSplits[anomaly.id] || {};
          const activeSplits = Object.keys(pSplits)
            .filter((id) => pSplits[id].enabled)
            .map((id) => ({
              roommate_id: parseInt(id),
              proportion: parseFloat(pSplits[id].proportion),
              share_amount: Math.round(((anomaly.amount * parseFloat(pSplits[id].proportion)) / 100) * 100) / 100
            }));

          const sum = activeSplits.reduce((acc, curr) => acc + curr.proportion, 0);
          if (Math.abs(sum - 100) > 0.01) {
            throw new Error(`Split percentages must total exactly 100% (currently ${sum}%).`);
          }
          details = { splits: activeSplits };
          break;
        }

        case 'classification_ambiguity':
          if (classificationOverride === 'convert') {
            actionType = 'convert_to_settlement';
            details = { note: 'Resolved by user: converted from split expense to direct repayment.' };
          } else {
            // Keep as split expense
            // Simply mark the anomaly as resolved in database
            actionType = 'resolve_currency'; // Safe fall-through since classification ambiguity resolves to clean
            details = { note: 'Confirmed split classification correct.' };
          }
          break;

        default:
          throw new Error('Unsupported check.');
      }

      await api.resolveAnomaly(anomaly.id, actionType, details, user.roommate_id);
      setSuccessMsg('Correction applied successfully.');
      await onRefresh();
      await fetchDecisionLogs();
    } catch (err) {
      setError(err.message || 'Failed to apply correction.');
    } finally {
      setResolvingId(null);
    }
  };

  // Plain English mapping (replaces severity & technical jargon)
  const getPlainEnglishCheck = (category, desc) => {
    switch (category) {
      case 'missing_payer':
        return {
          title: "We couldn't find this person",
          reason: "The payer logged in this transaction doesn't match any registered member in this group.",
          suggest: "Choose who paid for this cost from the member list below, or register them as a new member."
        };
      case 'missing_currency':
        return {
          title: "Currency is missing",
          reason: "No currency was specified for this transaction, making split calculations provisional.",
          suggest: "Confirm whether this cost was paid in INR or USD."
        };
      case 'ambiguous_date':
        return {
          title: "The transaction date is unclear",
          reason: "The date format (like 04/05/2026) is ambiguous and could mean April 5th or May 4th.",
          suggest: "Confirm which calendar date is correct."
        };
      case 'split_sum_error':
        return {
          title: "The split percentages don't add up to 100%",
          reason: `The split percentages allocated to members in this transaction sum to an incorrect total.`,
          suggest: "Adjust split proportions so they total exactly 100%."
        };
      case 'temporal_violation':
        return {
          title: "This person wasn't living in the group on this date",
          reason: desc || "According to membership timelines, a split participant was checked out when this payment occurred.",
          suggest: "Confirm by removing them from this split, which will distribute their share among the remaining members."
        };
      case 'duplicate':
        return {
          title: "This looks like a duplicate payment",
          reason: "This transaction matches another payment on date, payer, and amount.",
          suggest: "Choose which record is correct to merge them and prevent double-counting."
        };
      case 'classification_ambiguity':
        return {
          title: "We aren't sure what this payment means",
          reason: "The payment description contains words like 'deposit' or 'settlement', suggesting it is a direct repayment rather than a split expense.",
          suggest: "Choose whether to keep this as a split group expense or convert it to a direct 1-to-1 repayment."
        };
      default:
        return {
          title: "Import Verification Alert",
          reason: "Database scan rule violation.",
          suggest: "Select a resolution strategy."
        };
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Review Imported Data</h2>
        <p style={styles.subtitle}>
          Help us verify imported CSV rows. Correcting these alerts keeps calculations and balances accurate.
        </p>
      </div>

      {successMsg && <div style={styles.successBanner}>{successMsg}</div>}
      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}

      <div style={styles.workspaceGrid}>
        {/* Left Column: Stack of Simple Cards */}
        <div style={styles.cardsColumn}>
          {anomalies.length === 0 ? (
            <div className="glass-card" style={styles.allCleanCard}>
              <span style={styles.checkBadge}>✓</span>
              <h3>Nothing to review</h3>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nice work! No transaction warnings or timeline conflicts exist in this group.</p>
            </div>
          ) : (
            anomalies.map((a) => {
              const pe = getPlainEnglishCheck(a.category, a.description);
              const isResolving = resolvingId === a.id;

              return (
                <div className="glass-card" key={a.id} style={styles.warningCard}>
                  {/* Alert Header */}
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardProblem}>{pe.title}</h3>
                    <span style={styles.badgeExpense}>Needs Review</span>
                  </div>

                  {/* Transaction metadata */}
                  <div style={styles.expenseBox}>
                    <strong>Transaction:</strong> "{a.expense_description}" | <strong>Total:</strong> {a.amount} {a.currency || 'Unspecified'} | <strong>Date:</strong> {a.raw_date}
                  </div>

                  {/* Reason & Suggestion */}
                  <div style={styles.detailBox}>
                    <p style={styles.reasonText}><strong>Problem:</strong> {pe.reason}</p>
                    <p style={styles.suggestText}><strong>Correction:</strong> {pe.suggest}</p>
                  </div>

                  {/* Dynamic Inline Forms */}
                  <div style={styles.formContainer}>
                    {/* 1. Missing Payer Form */}
                    {a.category === 'missing_payer' && (
                      <div style={styles.inlineForm}>
                        {!showAddMember[a.id] ? (
                          <div style={styles.inputRow}>
                            <select
                              className="form-input"
                              value={payerSelections[a.id] || ''}
                              onChange={(e) => setPayerSelections({ ...payerSelections, [a.id]: e.target.value })}
                              style={{ flex: 1, minWidth: '160px' }}
                            >
                              <option value="">-- Choose Payer --</option>
                              {roommates.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                            <button 
                              className="btn-secondary" 
                              onClick={() => setShowAddMember({ ...showAddMember, [a.id]: true })}
                            >
                              New Member
                            </button>
                            <button 
                              className="btn-primary" 
                              onClick={() => handleResolve(a)}
                              disabled={isResolving}
                            >
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <div style={styles.nestedForm}>
                            <span style={styles.nestedFormTitle}>Add New Member Profile</span>
                            <div style={styles.inputRow}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Name (e.g. Kabir)"
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                style={{ flex: 1, minWidth: '120px' }}
                              />
                              <input
                                type="date"
                                className="form-input"
                                value={newMemberJoinDate}
                                onChange={(e) => setNewMemberJoinDate(e.target.value)}
                                style={{ width: '130px' }}
                              />
                              <button className="btn-primary" onClick={(e) => handleCreateMember(e, a.id)}>
                                Add
                              </button>
                              <button 
                                className="btn-secondary" 
                                onClick={() => setShowAddMember({ ...showAddMember, [a.id]: false })}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Missing Currency Form */}
                    {a.category === 'missing_currency' && (
                      <div style={styles.inlineForm}>
                        <div style={styles.inputRow}>
                          <select
                            className="form-input"
                            value={currencySelections[a.id] || 'INR'}
                            onChange={(e) => setCurrencySelections({ ...currencySelections, [a.id]: e.target.value })}
                            style={{ width: '120px' }}
                          >
                            <option value="INR">INR (₹)</option>
                            <option value="USD">USD ($)</option>
                            <option value="custom">Custom</option>
                          </select>
                          {currencySelections[a.id] === 'custom' && (
                            <input
                              type="text"
                              className="form-input"
                              placeholder="EUR"
                              maxLength="3"
                              value={customCurrencyInputs[a.id] || ''}
                              onChange={(e) => setCustomCurrencyInputs({ ...customCurrencyInputs, [a.id]: e.target.value })}
                              style={{ width: '80px', textTransform: 'uppercase' }}
                            />
                          )}
                          <button 
                            className="btn-primary" 
                            onClick={() => handleResolve(a)}
                            disabled={isResolving}
                          >
                            Confirm Currency
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 3. Ambiguous Date Form */}
                    {a.category === 'ambiguous_date' && (
                      <div style={styles.inlineForm}>
                        <div style={styles.inputRow}>
                          <select
                            className="form-input"
                            value={dateSelections[a.id] || ''}
                            onChange={(e) => setDateSelections({ ...dateSelections, [a.id]: e.target.value })}
                            style={{ flex: 1, minWidth: '180px' }}
                          >
                            {a.raw_date?.split('/').length === 3 && (
                              <>
                                <option value={`2026-${a.raw_date.split('/')[1].padStart(2, '0')}-${a.raw_date.split('/')[0].padStart(2, '0')}`}>
                                  {`Day ${a.raw_date.split('/')[0]} / Month ${a.raw_date.split('/')[1]}`}
                                </option>
                                <option value={`2026-${a.raw_date.split('/')[0].padStart(2, '0')}-${a.raw_date.split('/')[1].padStart(2, '0')}`}>
                                  {`Day ${a.raw_date.split('/')[1]} / Month ${a.raw_date.split('/')[0]}`}
                                </option>
                              </>
                            )}
                            <option value="custom">Manual Calendar picker</option>
                          </select>
                          {dateSelections[a.id] === 'custom' && (
                            <input
                              type="date"
                              className="form-input"
                              value={customDateInputs[a.id] || ''}
                              onChange={(e) => setCustomDateInputs({ ...customDateInputs, [a.id]: e.target.value })}
                              style={{ width: '150px' }}
                            />
                          )}
                          <button 
                            className="btn-primary" 
                            onClick={() => handleResolve(a)}
                            disabled={isResolving}
                          >
                            Confirm Date
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. Duplicate Transaction Form */}
                    {a.category === 'duplicate' && (
                      <div style={styles.inlineForm}>
                        <div style={styles.inputRow}>
                          <select
                            className="form-input"
                            value={duplicateSelections[a.id] || 'keep_first'}
                            onChange={(e) => setDuplicateSelections({ ...duplicateSelections, [a.id]: e.target.value })}
                            style={{ flex: 1, minWidth: '180px' }}
                          >
                            <option value="keep_first">Keep original record, ignore duplicate</option>
                            <option value="keep_second">Keep duplicate record, ignore original</option>
                          </select>
                          <button 
                            className="btn-primary" 
                            onClick={() => handleResolve(a)}
                            disabled={isResolving}
                          >
                            Merge Payments
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 5. Temporal Membership Form */}
                    {a.category === 'temporal_violation' && (
                      <div style={styles.inlineForm}>
                        <div style={styles.inputRow}>
                          <select
                            className="form-input"
                            value={temporalRoommateSelections[a.id] || ''}
                            onChange={(e) => setTemporalRoommateSelections({ ...temporalRoommateSelections, [a.id]: e.target.value })}
                            style={{ flex: 1, minWidth: '180px' }}
                          >
                            <option value="">-- Choose roommate to remove --</option>
                            {roommates.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <button 
                            className="btn-primary" 
                            onClick={() => handleResolve(a)}
                            disabled={isResolving}
                          >
                            Remove split share
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 6. Split Percentage Form */}
                    {a.category === 'split_sum_error' && (
                      <div style={styles.inlineSplitForm}>
                        <div style={styles.splitGrid}>
                          {roommates.map((r) => {
                            const pSplits = percentageSplits[a.id] || {};
                            const enabled = pSplits[r.id]?.enabled ?? false;
                            const proportion = pSplits[r.id]?.proportion ?? 0;

                            return (
                              <div key={r.id} style={styles.splitRow}>
                                <label style={styles.checkLabel}>
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) => {
                                      const nextSplits = { ...pSplits };
                                      nextSplits[r.id] = { ...nextSplits[r.id], enabled: e.target.checked };
                                      setPercentageSplits({ ...percentageSplits, [a.id]: nextSplits });
                                    }}
                                  />
                                  <span>{r.name}</span>
                                </label>
                                <input
                                  type="number"
                                  className="form-input"
                                  min="0"
                                  max="100"
                                  value={proportion}
                                  disabled={!enabled}
                                  onChange={(e) => {
                                    const nextSplits = { ...pSplits };
                                    nextSplits[r.id] = { ...nextSplits[r.id], proportion: parseFloat(e.target.value) || 0 };
                                    setPercentageSplits({ ...percentageSplits, [a.id]: nextSplits });
                                  }}
                                  style={{ width: '60px', padding: '4px 6px', fontSize: '12px' }}
                                />
                                <span style={styles.pctLabel}>%</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={styles.splitActionsRow}>
                          <span style={styles.sumLabel}>
                            Sum:{' '}
                            <strong 
                              style={{
                                color: (() => {
                                  const pSplits = percentageSplits[a.id] || {};
                                  const total = Object.keys(pSplits).reduce((acc, id) => acc + (pSplits[id].enabled ? pSplits[id].proportion : 0), 0);
                                  return Math.abs(total - 100) < 0.01 ? 'var(--creditor-green)' : 'var(--debtor-red)';
                                })()
                              }}
                            >
                              {(() => {
                                const pSplits = percentageSplits[a.id] || {};
                                return Object.keys(pSplits).reduce((acc, id) => acc + (pSplits[id].enabled ? pSplits[id].proportion : 0), 0);
                              })()}%
                            </strong>
                          </span>
                          <button 
                            className="btn-primary" 
                            onClick={() => handleResolve(a)}
                            disabled={isResolving}
                          >
                            Save Split Shares
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 7. Classification Ambiguity Form */}
                    {a.category === 'classification_ambiguity' && (
                      <div style={styles.inlineForm}>
                        <div style={styles.btnRow}>
                          <button 
                            className="btn-secondary" 
                            onClick={() => handleResolve(a)}
                            disabled={isResolving}
                          >
                            Keep split expense
                          </button>
                          <button 
                            className="btn-primary" 
                            onClick={() => handleResolve(a, 'convert')}
                            disabled={isResolving}
                          >
                            Convert to direct payment
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Mini Audit History */}
        <div style={styles.auditColumn}>
          <div className="glass-card" style={styles.auditPanel}>
            <h3 style={styles.auditTitle}>Audit History</h3>
            <p style={styles.auditSubtitle}>Permanent record of manual fixes applied to imported records.</p>
            <div style={styles.logsList}>
              {decisionLogs.length === 0 ? (
                <div style={styles.emptyLogs}>No corrections recorded yet.</div>
              ) : (
                decisionLogs.map((log) => (
                  <div key={log.id} style={styles.logItem}>
                    <div style={styles.logHeader}>
                      <span style={styles.logAction}>{log.action_type.replace(/_/g, ' ')}</span>
                      <span style={styles.logTime}>{new Date(log.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div style={styles.logDetailText}>
                      {log.action_type === 'convert_to_settlement' 
                        ? 'Converted split expense to direct repayment.'
                        : `Applied correction details: ${Object.keys(log.resolution_details || {}).map(k => `${k}: ${log.resolution_details[k]}`).join(', ')}`}
                    </div>
                  </div>
                ))
              )}
            </div>
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
    maxWidth: '1200px',
    margin: '0 auto',
    backgroundColor: 'transparent',
  },
  headerRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  successBanner: {
    background: 'rgba(22, 163, 74, 0.05)',
    border: '1px solid var(--creditor-green)',
    color: 'var(--creditor-green)',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  errorBanner: {
    background: 'rgba(220, 38, 38, 0.05)',
    border: '1px solid var(--debtor-red)',
    color: 'var(--debtor-red)',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  workspaceGrid: {
    display: 'grid',
    gridTemplateColumns: '1.8fr 1fr',
    gap: '24px',
    alignItems: 'start',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
    }
  },
  cardsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  allCleanCard: {
    padding: '48px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    color: 'var(--text-muted)',
  },
  checkBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(22, 163, 74, 0.08)',
    color: 'var(--creditor-green)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    fontSize: '18px',
  },
  warningCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardProblem: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  badgeExpense: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#b45309',
    background: '#fef3c7',
    border: '1px solid #fde68a',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  expenseBox: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    background: '#f9fafb',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  detailBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  reasonText: {
    color: '#1d1d1f',
  },
  suggestText: {
    color: 'var(--text-muted)',
  },
  formContainer: {
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
  },
  inlineForm: {
    width: '100%',
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  btnRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  nestedForm: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  nestedFormTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  inlineSplitForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    padding: '12px',
    borderRadius: '6px',
  },
  splitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#1d1d1f',
    cursor: 'pointer',
    width: '80px',
  },
  pctLabel: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  splitActionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sumLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  // Audit Column
  auditColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  auditPanel: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  auditTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  auditSubtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '8px',
  },
  logsList: {
    maxHeight: '400px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingRight: '2px',
  },
  emptyLogs: {
    padding: '12px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '12px',
  },
  logItem: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    fontWeight: '600',
  },
  logAction: {
    color: 'var(--primary)',
    textTransform: 'uppercase',
  },
  logTime: {
    color: 'var(--text-muted)',
  },
  logDetailText: {
    fontSize: '12px',
    color: '#1d1d1f',
    lineHeight: '1.4',
  },
};
