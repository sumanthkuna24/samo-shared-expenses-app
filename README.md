# Shared Expenses App (SAMO)

SAMO is a consumer-focused, Splitwise-inspired shared expense tracking application. It features manual expense creation, group management, settlement recommendations, and a dedicated CSV import workflow with post-import anomaly detection, user reviews, and audit trails.

---

## Key Features

1. **Splitwise-Style UX**: Clean, simple landing page and dashboard focusing on group spending, roommate balances, and clear settlements.
2. **Flexible Splits**: Support for equal splits, unequal splits, percentage splits, and share-based splits.
3. **Smart Import Review**: Anomaly detector checks imported CSV records for duplicate transactions, missing currencies/payers, ambiguous dates, unregistered participants, and temporal membership conflicts.
4. **Dynamic Balance Engine**: Balances are calculated dynamically:
   $$\text{Balance} = \text{Paid} - \text{Share} + \text{Sent} - \text{Received}$$
5. **Settlement Recommendations**: Cash-flow minimization algorithm matches debtors and creditors to settle debts in the minimum number of payments.
6. **Auditability**: Original CSV records are preserved, and user resolutions are stored in a decision log.
7. **Apple-Inspired Design**: Elegant light-theme layout built with white backgrounds, dark gray typography, soft shadows, and spacious spacing.

---

## Project Structure

* [DECISIONS.md](file:///d:/samo/DECISIONS.md) - Summary of architectural and engineering decisions.
* [SCOPE.md](file:///d:/samo/SCOPE.md) - Project scope and CSV anomaly resolution matrix.
* [AI_USAGE.md](file:///d:/samo/AI_USAGE.md) - Documentation on AI-assisted development workflows.
* [PROMPTS.md](file:///d:/samo/PROMPTS.md) - Detailed chronological log of prompts.
* `client/` - Vite + React frontend application.
* `server/` - Node.js + Express API backend server.

---

## Local Setup

### Prerequisite
* Node.js (v18+)

### 1. Run the Backend Server
```bash
# Install dependencies from root
npm install

# Start the Node.js API server
node server/server.js
```
The server will start on `http://localhost:5000` and initialize/seed the SQLite database (`expenses.db`) with default roommates and login credentials.

### 2. Run the Frontend App
```bash
# Navigate to the client directory
cd client

# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```
The client app will start on `http://localhost:5173`. Open it in your browser.

---

## Deployment Note

The application uses SQLite for portability and simplicity. 

For production-scale deployments, the persistence layer can be migrated to PostgreSQL or another managed relational database with minimal changes to the application architecture.

---

## Test Accounts
You can log in to the application using any of the following seeded user credentials:
* **Username**: `aisha`, `rohan`, `priya`, `meera`, or `sam`
* **Password**: `password123`
