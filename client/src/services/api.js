const API_BASE_URL = 'http://localhost:5000/api';

const api = {
  // Authentication
  login: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed.');
    }
    return response.json();
  },

  // Roommates Timelines
  getRoommates: async () => {
    const response = await fetch(`${API_BASE_URL}/roommates`);
    if (!response.ok) throw new Error('Failed to fetch roommates timelines.');
    return response.json();
  },

  // CSV Import (clears existing data and runs ingestion)
  importCSV: async () => {
    const response = await fetch(`${API_BASE_URL}/import`, {
      method: 'POST'
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'CSV Ingestion failed.');
    }
    return response.json();
  },

  // Retrieve Ledger status, Balances and Settlements
  getBalances: async () => {
    const response = await fetch(`${API_BASE_URL}/balances`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch balances.');
    }
    return response.json();
  },

  // Retrieve Active Anomalies
  getAnomalies: async () => {
    const response = await fetch(`${API_BASE_URL}/anomalies`);
    if (!response.ok) throw new Error('Failed to fetch anomalies.');
    return response.json();
  },

  // Resolve Anomaly
  resolveAnomaly: async (anomalyId, actionType, details) => {
    const response = await fetch(`${API_BASE_URL}/anomalies/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anomalyId, actionType, details })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Anomaly resolution failed.');
    }
    return response.json();
  },

  // Retrieve Roommate Chronological Trace Ledger
  getLedger: async (roommateName) => {
    const response = await fetch(`${API_BASE_URL}/roommates/${roommateName}/ledger`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch roommate ledger.');
    }
    return response.json();
  },

  // Retrieve Decision Log Audit Trail
  getDecisionLog: async () => {
    const response = await fetch(`${API_BASE_URL}/decision-log`);
    if (!response.ok) throw new Error('Failed to fetch decision logs.');
    return response.json();
  },

  // Register a new roommate in the system
  createRoommate: async (name, joinedAt) => {
    const response = await fetch(`${API_BASE_URL}/roommates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, joined_at: joinedAt })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create roommate.');
    }
    return response.json();
  },

  // Create a new expense group
  createGroup: async (name, baseCurrency) => {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, base_currency: baseCurrency })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create group.');
    }
    return response.json();
  },

  // Create a new manual expense and splits allocation
  createExpense: async (expenseData) => {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseData)
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create expense.');
    }
    return response.json();
  }
};

export default api;
