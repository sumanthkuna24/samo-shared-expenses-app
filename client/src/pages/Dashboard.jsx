import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Dashboard({ balancesData, roommates, onRefresh, user, loading }) {
  // Modal toggle states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  
  // CSV Import state
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // New Group Form State
  const [groupName, setGroupName] = useState('');
  const [groupCurrency, setGroupCurrency] = useState('INR');
  const [groupError, setGroupError] = useState('');
  const [groupSuccess, setGroupSuccess] = useState('');

  // New Member Form State
  const [memberName, setMemberName] = useState('');
  const [memberJoinDate, setMemberJoinDate] = useState('2026-06-15');
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');

  // New Expense Form State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState('INR');
  const [expensePayerId, setExpensePayerId] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState('equal');
  const [checkedRoommates, setCheckedRoommates] = useState({});
  const [splitPercentages, setSplitPercentages] = useState({});
  const [expenseError, setExpenseError] = useState('');
  const [expenseSuccess, setExpenseSuccess] = useState('');

  // Activity Feed States
  const [feed, setFeed] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  // Fetch recent expense feed from active roommate's ledger
  useEffect(() => {
    if (user?.roommate_name) {
      fetchFeed();
    }
  }, [user, balancesData]);

  const fetchFeed = async () => {
    setLoadingFeed(true);
    try {
      const data = await api.getLedger(user.roommate_name, user.roommate_id);
      // Filter expenses and sort chronologically descending (newest first)
      const expenses = data.filter(item => item.type === 'expense').reverse();
      setFeed(expenses);
    } catch (err) {
      console.error('Failed to load activity feed:', err);
    } finally {
      setLoadingFeed(false);
    }
  };


  // Initialize splits checklists
  useEffect(() => {
    if (roommates && roommates.length > 0) {
      const initialChecks = {};
      const initialPcts = {};
      const equalShare = Math.round(100 / roommates.length);

      roommates.forEach(r => {
        initialChecks[r.id] = true;
        initialPcts[r.id] = equalShare;
      });
      setCheckedRoommates(initialChecks);
      setSplitPercentages(initialPcts);
      
      // Default payer is the logged-in user
      const loggedInRoommate = roommates.find(r => r.name.toLowerCase() === user.roommate_name.toLowerCase());
      if (loggedInRoommate) {
        setExpensePayerId(loggedInRoommate.id.toString());
      } else {
        setExpensePayerId(roommates[0].id.toString());
      }
    }
  }, [roommates, showExpenseModal, user]);

  const handleImport = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      const result = await api.importCSV(user.roommate_id);
      setImportStatus({
        success: true,
        message: `Imported successfully! ${result.unresolvedAnomalies || 0} review items created.`
      });
      await onRefresh();
    } catch (err) {
      setImportStatus({
        success: false,
        message: err.message || 'Import failed.'
      });
    } finally {
      setImporting(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setGroupError('');
    setGroupSuccess('');
    if (!groupName.trim()) {
      setGroupError('Group name is required.');
      return;
    }
    try {
      const result = await api.createGroup(groupName.trim(), groupCurrency, user.roommate_id);
      setGroupSuccess(`Group "${result.name}" created successfully!`);
      setGroupName('');
      await onRefresh();
      setTimeout(() => {
        setShowGroupModal(false);
        setGroupSuccess('');
      }, 1500);
    } catch (err) {
      setGroupError(err.message || 'Failed to create group.');
    }
  };

  const handleJoinDemoGroup = async () => {
    setLoadingJoin(true);
    try {
      await api.joinGroup(user.roommate_id, 1);
      await onRefresh();
    } catch (err) {
      console.error('Failed to join demo group:', err);
    } finally {
      setLoadingJoin(false);
    }
  };


  const handleAddMember = async (e) => {
    e.preventDefault();
    setMemberError('');
    setMemberSuccess('');
    if (!memberName.trim() || !memberJoinDate) {
      setMemberError('Member name and onboarding date are required.');
      return;
    }
    try {
      const result = await api.createRoommate(memberName.trim(), memberJoinDate, user.roommate_id);
      setMemberSuccess(`Member "${result.name}" joined the group!`);
      setMemberName('');
      await onRefresh();
      setTimeout(() => {
        setShowMemberForm(false);
        setMemberSuccess('');
      }, 1500);
    } catch (err) {
      setMemberError(err.message || 'Failed to add member.');
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setExpenseError('');
    setExpenseSuccess('');

    if (!expenseDesc.trim() || !expenseAmount || !expensePayerId) {
      setExpenseError('Please enter description, amount, and payer details.');
      return;
    }

    const participants = Object.keys(checkedRoommates).filter(id => checkedRoommates[id]);
    if (participants.length === 0) {
      setExpenseError('Please select at least one split participant.');
      return;
    }

    try {
      const splitPayload = participants.map(id => {
        const roommateId = parseInt(id);
        const prop = expenseSplitType === 'equal' 
          ? (100 / participants.length)
          : parseFloat(splitPercentages[id] || 0);

        return {
          roommate_id: roommateId,
          proportion: prop
        };
      });

      if (expenseSplitType === 'percentage') {
        const sum = splitPayload.reduce((acc, curr) => acc + curr.proportion, 0);
        if (Math.abs(sum - 100) > 0.01) {
          setExpenseError(`Percentage splits must sum to exactly 100% (currently ${sum}%).`);
          return;
        }
      }

      const currentDate = new Date().toISOString().split('T')[0];

      await api.createExpense({
        description: expenseDesc.trim(),
        amount: parseFloat(expenseAmount),
        currency: expenseCurrency,
        paid_by_id: parseInt(expensePayerId),
        split_type: expenseSplitType,
        raw_date: currentDate,
        splits: splitPayload
      }, user.roommate_id);

      setExpenseSuccess('Expense split recorded successfully!');
      setExpenseDesc('');
      setExpenseAmount('');
      await onRefresh();
      
      setTimeout(() => {
        setShowExpenseModal(false);
        setExpenseSuccess('');
      }, 1500);
    } catch (err) {
      setExpenseError(err.message || 'Failed to record expense.');
    }
  };

  const balances = balancesData?.balances || [];
  const settlements = balancesData?.settlements || [];
  const calculationStatus = balancesData?.status || 'clean';
  const itemsNeedingReviewCount = balancesData?.unresolvedAnomaliesCount || 0;

  // Calculate Personal Balance Summaries
  const myBalance = balances.find(b => b.name.toLowerCase() === user.roommate_name.toLowerCase());
  const myNet = myBalance ? myBalance.net : 0;
  
  // Calculate total owed and total owes from settlements
  let totalOwesMe = 0;
  let totalIOwe = 0;
  settlements.forEach(s => {
    if (s.receiver.toLowerCase() === user.roommate_name.toLowerCase()) {
      totalOwesMe += s.amount;
    }
    if (s.sender.toLowerCase() === user.roommate_name.toLowerCase()) {
      totalIOwe += s.amount;
    }
  });

  if (balances.length === 0) {
    return (
      <div style={styles.container}>
        {/* 1. BRAND HERO ROW */}
        <div style={styles.dashboardHero}>
          <div style={styles.heroLeft}>
            <span style={styles.heroGreeting}>Welcome back,</span>
            <h2 style={styles.heroUser}>{user.roommate_name}</h2>
          </div>
          <div style={styles.heroRight}>
            <button className="btn-primary" onClick={() => setShowGroupModal(true)} style={styles.addExpenseBtn}>
              Create a Group
            </button>
          </div>
        </div>

        {/* 2. ONBOARDING EMPTY STATE */}
        <div className="glass-card" style={styles.onboardingCard}>
          <div style={styles.onboardingIcon}>👋</div>
          <h2 style={styles.onboardingTitle}>No expenses yet</h2>
          <p style={styles.onboardingSubtitle}>
            Create a group or add your first expense to get started. You can also join the demo roommate group to try out the sample dataset.
          </p>

          <div style={styles.onboardingActions}>
            <button 
              className="btn-primary" 
              onClick={() => setShowGroupModal(true)}
              style={styles.onboardingBtn}
            >
              Create a Group
            </button>
            <button 
              className="btn-secondary" 
              onClick={handleJoinDemoGroup}
              disabled={loadingJoin}
              style={{ ...styles.onboardingBtn, marginLeft: '12px' }}
            >
              {loadingJoin ? 'Joining...' : 'Join Demo Group'}
            </button>
            <button 
              className="btn-secondary" 
              onClick={handleImport}
              disabled={importing}
              style={{ ...styles.onboardingBtn, marginLeft: '12px' }}
            >
              {importing ? 'Importing...' : 'Import Sample Dataset'}
            </button>
          </div>
          {importStatus && (
            <div 
              style={{
                ...styles.importAlert,
                marginTop: '20px',
                maxWidth: '400px',
                margin: '20px auto 0 auto',
                backgroundColor: importStatus.success ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                borderColor: importStatus.success ? 'var(--creditor-green)' : 'var(--debtor-red)',
                color: importStatus.success ? 'var(--creditor-green)' : 'var(--debtor-red)'
              }}
            >
              {importStatus.message}
            </div>
          )}
        </div>

        {/* ================= MODAL: CREATE GROUP ================= */}
        {showGroupModal && (
          <div style={styles.modalOverlay}>
            <div className="glass-card" style={styles.modalCard}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Create New Group</h3>
                <button style={styles.modalClose} onClick={() => setShowGroupModal(false)}>×</button>
              </div>
              <form onSubmit={handleCreateGroup} style={styles.modalForm}>
                {groupError && <div style={styles.modalError}>{groupError}</div>}
                {groupSuccess && <div style={styles.modalSuccess}>{groupSuccess}</div>}

                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Group Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Goa Trip 2026"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Base Currency</label>
                  <select
                    className="form-input"
                    value={groupCurrency}
                    onChange={(e) => setGroupCurrency(e.target.value)}
                    disabled={loading}
                  >
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </div>

                <button type="submit" className="btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
                  Create Group
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (

    <div style={styles.container}>
      {/* 1. BRAND HERO ROW */}
      <div style={styles.dashboardHero}>
        <div style={styles.heroLeft}>
          <span style={styles.heroGreeting}>Welcome back,</span>
          <h2 style={styles.heroUser}>{user.roommate_name}</h2>
        </div>
        <div style={styles.heroRight}>
          <button className="btn-primary" onClick={() => setShowExpenseModal(true)} style={styles.addExpenseBtn}>
            Add Expense
          </button>
          <button className="btn-secondary" onClick={() => setShowMemberForm(true)} style={styles.actionBtn}>
            + Member
          </button>
          <button className="btn-secondary" onClick={() => setShowGroupModal(true)} style={styles.actionBtn}>
            + Group
          </button>
        </div>
      </div>

      {/* 2. SPLITWISE BALANCE SUMMARY CARDS */}
      <div style={styles.summaryGrid}>
        <div className="glass-card" style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Your Balance</span>
          <span 
            style={{
              ...styles.summaryValue,
              color: myNet > 0.01 ? 'var(--creditor-green)' : myNet < -0.01 ? 'var(--debtor-red)' : 'var(--text-main)'
            }}
          >
            {myNet > 0.01 ? '+' : ''}₹{Math.round(myNet).toLocaleString()}
          </span>
          <span style={styles.summarySubtext}>
            {myNet > 0.01 ? 'You are owed money' : myNet < -0.01 ? 'You owe money overall' : 'You are fully settled'}
          </span>
        </div>
        <div className="glass-card" style={styles.summaryCard}>
          <span style={styles.summaryLabel}>You Owe</span>
          <span style={{ ...styles.summaryValue, color: totalIOwe > 0.01 ? 'var(--debtor-red)' : 'var(--text-dim)' }}>
            ₹{Math.round(totalIOwe).toLocaleString()}
          </span>
          <span style={styles.summarySubtext}>repayments to make</span>
        </div>
        <div className="glass-card" style={styles.summaryCard}>
          <span style={styles.summaryLabel}>You Are Owed</span>
          <span style={{ ...styles.summaryValue, color: totalOwesMe > 0.01 ? 'var(--creditor-green)' : 'var(--text-dim)' }}>
            ₹{Math.round(totalOwesMe).toLocaleString()}
          </span>
          <span style={styles.summarySubtext}>roommates owe you</span>
        </div>
      </div>

      {/* 3. CORE TWO-COLUMN SPLITWISE WORKSPACE */}
      <div style={styles.mainWorkspace}>
        {/* Left Column: Recent Activity Feed */}
        <div className="glass-card" style={styles.feedContainer}>
          <div style={styles.feedHeader}>
            <h3 style={styles.workspaceTitle}>Recent Expenses</h3>
            {calculationStatus !== 'clean' && (
              <span 
                style={styles.reviewBannerLink}
                title="Timeline conflicts or percentage errors exist in imported rows"
              >
                ⚠️ estimated balances ({itemsNeedingReviewCount} warnings active)
              </span>
            )}
          </div>

          <div style={styles.feedScroll}>
            {loadingFeed ? (
              <div style={styles.feedLoader}>
                <span style={styles.spinner}></span>
                <span>Updating feed...</span>
              </div>
            ) : feed.length === 0 ? (
              <div style={styles.emptyFeed}>
                <span style={styles.feedEmptyIcon}>✍</span>
                <p style={{ fontWeight: '500', color: 'var(--text-main)' }}>No expenses yet</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click "Add Expense" to record a shared cost.</p>
              </div>
            ) : (
              feed.map((item, idx) => {
                const isPayer = item.paid_amount > 0.01;
                const isExcluded = item.status === 'excluded';
                
                let dateDisplay = { month: 'Mar', day: '15' };
                try {
                  const dateObj = new Date(item.date);
                  if (!isNaN(dateObj.getTime())) {
                    dateDisplay = {
                      month: dateObj.toLocaleString('en-US', { month: 'short' }),
                      day: dateObj.getDate().toString()
                    };
                  }
                } catch(e) {}

                return (
                  <div 
                    key={idx} 
                    style={{
                      ...styles.feedItem,
                      opacity: isExcluded ? 0.6 : 1
                    }}
                  >
                    {/* Date Block */}
                    <div style={styles.feedDateBox}>
                      <span style={styles.dateMonth}>{dateDisplay.month}</span>
                      <span style={styles.dateDay}>{dateDisplay.day}</span>
                    </div>

                    {/* Transaction Details */}
                    <div style={styles.feedItemDetails}>
                      <span style={styles.feedItemTitle}>{item.description}</span>
                      <span style={styles.feedItemMeta}>
                        {isExcluded ? (
                          <span style={styles.excludeLabel}>Needs Review (On Hold)</span>
                        ) : (
                          <>
                            Paid total: <strong>{item.total}</strong>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Lending Details */}
                    <div style={styles.feedItemLending}>
                      {isExcluded ? (
                        <div style={styles.lendingBlock}>
                          <span style={styles.lendingLabelMuted}>Calculations</span>
                          <span style={styles.lendingValMuted}>Excluded</span>
                        </div>
                      ) : isPayer ? (
                        <div style={styles.lendingBlock}>
                          <span style={styles.lendingLabelGreen}>You paid</span>
                          <span style={styles.lendingValGreen}>₹{Math.round(item.paid_amount * item.exchange_rate)}</span>
                        </div>
                      ) : (
                        <div style={styles.lendingBlock}>
                          <span style={styles.lendingLabelRed}>You owe</span>
                          <span style={styles.lendingValRed}>₹{Math.round(item.share_amount * item.exchange_rate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div style={styles.sidebarColumn}>
          {/* Permanent, discoverable CSV Onboarding Action card (New Placement) */}
          <div className="glass-card" style={styles.sideCardAccent}>
            <h4 style={styles.sidebarSectionTitle}>💡 Smart Import</h4>
            <p style={styles.importSubtitle}>
              Have an existing Splitwise export file? Ingest it to automatically populate roommates and transactions.
            </p>
            <button 
              className="btn-secondary" 
              onClick={handleImport} 
              disabled={importing || loading}
              style={styles.importBtn}
            >
              {importing ? 'Importing CSV...' : 'Import Splitwise CSV'}
            </button>
            {importStatus && (
              <div 
                style={{
                  ...styles.importAlert,
                  backgroundColor: importStatus.success ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                  borderColor: importStatus.success ? 'var(--creditor-green)' : 'var(--debtor-red)',
                  color: importStatus.success ? 'var(--creditor-green)' : 'var(--debtor-red)'
                }}
              >
                {importStatus.message}
              </div>
            )}
          </div>

          {/* Group Member Balances */}
          <div className="glass-card" style={styles.sideCard}>
            <h3 style={styles.sidebarTitle}>Group Members</h3>
            <div style={styles.membersList}>
              {balances.map((member) => {
                const isMe = member.name.toLowerCase() === user.roommate_name.toLowerCase();
                const isOwed = member.net > 0.01;
                const owesMoney = member.net < -0.01;

                return (
                  <div key={member.id} style={styles.memberRow}>
                    <div style={styles.memberName}>
                      <span style={styles.memberAvatar}>👤</span>
                      <span>
                        {member.name} {isMe ? '(You)' : ''}
                      </span>
                    </div>
                    <div style={styles.memberBalance}>
                      {isOwed ? (
                        <span style={styles.greenText}>is owed ₹{Math.round(member.net).toLocaleString()}</span>
                      ) : owesMoney ? (
                        <span style={styles.redText}>owes ₹{Math.round(Math.abs(member.net)).toLocaleString()}</span>
                      ) : (
                        <span style={styles.dimText}>settled up</span>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Repayment Settlement Suggestions */}
          <div className="glass-card" style={styles.sideCard}>
            <h3 style={styles.sidebarTitle}>Repayment Plans</h3>
            <div style={styles.settlementsList}>
              {settlements.length === 0 ? (
                <div style={styles.allSettledBox}>
                  <span style={styles.checkBadge}>✓</span>
                  <span style={styles.allSettledText}>All roommates are fully settled!</span>
                </div>
              ) : (
                settlements.map((s, idx) => (
                  <div key={idx} style={styles.settlementCard}>
                    <div style={styles.settlementText}>
                      <strong style={styles.redText}>{s.sender}</strong>
                      <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>repays</span>
                      <strong style={styles.greenText}>{s.receiver}</strong>
                    </div>
                    <div style={styles.settlementAmount}>
                      ₹{Math.round(s.amount).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL: CREATE GROUP ================= */}
      {showGroupModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-card" style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Create New Group</h3>
              <button style={styles.modalClose} onClick={() => setShowGroupModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateGroup} style={styles.modalForm}>
              {groupError && <div style={styles.modalError}>{groupError}</div>}
              {groupSuccess && <div style={styles.modalSuccess}>{groupSuccess}</div>}

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Group Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Goa Trip 2026"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Base Currency</label>
                <select
                  className="form-input"
                  value={groupCurrency}
                  onChange={(e) => setGroupCurrency(e.target.value)}
                  disabled={loading}
                >
                  <option value="INR">INR (Indian Rupee)</option>
                  <option value="USD">USD (US Dollar)</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
                Create Group
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD MEMBER ================= */}
      {showMemberForm && (
        <div style={styles.modalOverlay}>
          <div className="glass-card" style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add New Member</h3>
              <button style={styles.modalClose} onClick={() => setShowMemberForm(false)}>×</button>
            </div>
            <form onSubmit={handleAddMember} style={styles.modalForm}>
              {memberError && <div style={styles.modalError}>{memberError}</div>}
              {memberSuccess && <div style={styles.modalSuccess}>{memberSuccess}</div>}

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Member Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Kabir"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Timeline Join Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={memberJoinDate}
                  onChange={(e) => setMemberJoinDate(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
                Add Member
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD EXPENSE ================= */}
      {showExpenseModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-card" style={{ ...styles.modalCard, maxWidth: '480px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Record Shared Expense</h3>
              <button style={styles.modalClose} onClick={() => setShowExpenseModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddExpense} style={styles.modalForm}>
              {expenseError && <div style={styles.modalError}>{expenseError}</div>}
              {expenseSuccess && <div style={styles.modalSuccess}>{expenseSuccess}</div>}

              <div style={styles.modalGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Gas cylinders"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Amount</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    min="1"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={styles.modalGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Currency</label>
                  <select
                    className="form-input"
                    value={expenseCurrency}
                    onChange={(e) => setExpenseCurrency(e.target.value)}
                    disabled={loading}
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Paid By</label>
                  <select
                    className="form-input"
                    value={expensePayerId}
                    onChange={(e) => setExpensePayerId(e.target.value)}
                    disabled={loading}
                  >
                    {roommates.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Split Rule</label>
                <div style={styles.splitToggleRow}>
                  <button
                    type="button"
                    style={expenseSplitType === 'equal' ? styles.toggleBtnActive : styles.toggleBtn}
                    onClick={() => setExpenseSplitType('equal')}
                  >
                    Equally
                  </button>
                  <button
                    type="button"
                    style={expenseSplitType === 'percentage' ? styles.toggleBtnActive : styles.toggleBtn}
                    onClick={() => setExpenseSplitType('percentage')}
                  >
                    Percentages (%)
                  </button>
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Split Participants</label>
                <div style={styles.participantsGrid}>
                  {roommates.map(r => {
                    const isChecked = checkedRoommates[r.id] ?? false;
                    const pctValue = splitPercentages[r.id] ?? 0;

                    return (
                      <div key={r.id} style={styles.participantSplitRow}>
                        <label style={styles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setCheckedRoommates({
                                ...checkedRoommates,
                                [r.id]: e.target.checked
                              });
                            }}
                          />
                          <span>{r.name}</span>
                        </label>
                        {expenseSplitType === 'percentage' && (
                          <input
                            type="number"
                            className="form-input"
                            min="0"
                            max="100"
                            value={pctValue}
                            disabled={!isChecked}
                            onChange={(e) => {
                              setSplitPercentages({
                                ...splitPercentages,
                                [r.id]: parseFloat(e.target.value) || 0
                              });
                            }}
                            style={{ width: '70px', padding: '4px 8px', fontSize: '12px' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '6px' }} disabled={loading}>
                Save Transaction
              </button>
            </form>
          </div>
        </div>
      )}
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
  dashboardHero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    flexWrap: 'wrap',
    gap: '20px',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  heroGreeting: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  heroUser: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  heroRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  addExpenseBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
  },
  actionBtn: {
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: '500',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  summaryCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0 2px 10px rgba(0,0,0,0.01)',
  },
  summaryLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  summaryValue: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  summarySubtext: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  mainWorkspace: {
    display: 'grid',
    gridTemplateColumns: '1.8fr 1fr',
    gap: '24px',
    alignItems: 'start',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
    }
  },
  feedContainer: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  feedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '16px',
  },
  workspaceTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  reviewBannerLink: {
    fontSize: '12px',
    color: '#b45309',
    background: '#fef3c7',
    border: '1px solid #fde68a',
    padding: '4px 10px',
    borderRadius: '6px',
    fontWeight: '500',
  },
  feedScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '520px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  feedLoader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px',
    color: 'var(--text-muted)',
  },
  emptyFeed: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '60px 20px',
    color: 'var(--text-muted)',
  },
  feedEmptyIcon: {
    fontSize: '32px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#f3f4f6',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '16px',
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '14px 16px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
  },
  feedDateBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  dateMonth: {
    fontSize: '9px',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  dateDay: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  feedItemDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  feedItemTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#1d1d1f',
  },
  feedItemMeta: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  excludeLabel: {
    color: '#b45309',
    fontWeight: '500',
  },
  feedItemLending: {
    textAlign: 'right',
  },
  lendingBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  lendingLabelMuted: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  lendingValMuted: {
    fontSize: '13px',
    color: 'var(--text-dim)',
    fontWeight: '600',
  },
  lendingLabelGreen: {
    fontSize: '10px',
    color: 'var(--creditor-green)',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  lendingValGreen: {
    fontSize: '15px',
    color: 'var(--creditor-green)',
    fontWeight: '700',
  },
  lendingLabelRed: {
    fontSize: '10px',
    color: 'var(--debtor-red)',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  lendingValRed: {
    fontSize: '15px',
    color: 'var(--debtor-red)',
    fontWeight: '700',
  },
  // Sidebar column
  sidebarColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  sideCardAccent: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  sidebarSectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: '0.02em',
  },
  importSubtitle: {
    fontSize: '12px',
    color: '#475569',
    lineHeight: '1.5',
  },
  importBtn: {
    alignSelf: 'flex-start',
    fontSize: '13px',
    padding: '8px 16px',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#334155',
  },
  importAlert: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '12px',
    lineHeight: '1.4',
  },
  sideCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  sidebarTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  memberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    paddingBottom: '8px',
    borderBottom: '1px solid #f3f4f6',
  },
  memberName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#1d1d1f',
    fontWeight: '500',
  },
  memberAvatar: {
    fontSize: '16px',
  },
  memberBalance: {
    fontSize: '13px',
    fontWeight: '500',
  },
  greenText: {
    color: 'var(--creditor-green)',
  },
  redText: {
    color: 'var(--debtor-red)',
  },
  dimText: {
    color: 'var(--text-muted)',
  },
  settlementsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  allSettledBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: 'rgba(22, 163, 74, 0.05)',
    border: '1px solid rgba(22, 163, 74, 0.15)',
    borderRadius: '8px',
  },
  checkBadge: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--creditor-green)',
    color: '#ffffff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    fontSize: '11px',
  },
  allSettledText: {
    fontSize: '12px',
    color: 'var(--text-main)',
  },
  settlementCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementText: {
    fontSize: '13px',
    color: '#1d1d1f',
  },
  settlementAmount: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1d1d1f',
  },
  // Modal Overlays
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(29, 29, 31, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalCard: {
    width: '90%',
    maxWidth: '400px',
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    boxShadow: '0 20px 45px rgba(0,0,0,0.1)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  modalError: {
    background: 'rgba(220, 38, 38, 0.05)',
    border: '1px solid var(--debtor-red)',
    color: 'var(--debtor-red)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
  },
  modalSuccess: {
    background: 'rgba(22, 163, 74, 0.05)',
    border: '1px solid var(--creditor-green)',
    color: 'var(--creditor-green)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  splitToggleRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  toggleBtn: {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: 'var(--text-muted)',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.15s ease',
  },
  toggleBtnActive: {
    background: 'rgba(79, 70, 229, 0.08)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  participantsGrid: {
    maxHeight: '140px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    padding: '12px',
    borderRadius: '6px',
  },
  participantSplitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#1d1d1f',
    cursor: 'pointer',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(0, 0, 0, 0.1)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  onboardingCard: {
    padding: '60px 40px',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
    maxWidth: '700px',
    margin: '40px auto 0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  onboardingIcon: {
    fontSize: '48px',
  },
  onboardingTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1d1d1f',
  },
  onboardingSubtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    maxWidth: '500px',
  },
  onboardingActions: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '10px',
  },
  onboardingBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
  }
};

