# DECISIONS.md

# Shared Expenses App (SAMO) – Key Engineering Decisions

## Purpose

This document records the final architectural and product decisions taken during development of the Shared Expenses App (SAMO), including the rationale behind each decision and the tradeoffs considered.

---

# 1. Product Direction

## Decision

Build a consumer-focused shared expense application inspired by Splitwise, while also supporting CSV import, anomaly detection, and balance reconciliation.

## Rationale

The assignment requires both:

* A usable expense-sharing application
* Handling messy imported financial data

The application therefore supports:

* Manual expense creation
* Group management
* Expense splitting
* Balance tracking
* Settlement recommendations
* CSV import and review

CSV import is treated as a supporting capability rather than the primary product experience.

---

# 2. Technology Stack

## Frontend

* React
* Vite

### Why

* Fast development
* Component-based architecture
* Excellent support for interactive dashboards

---

## Backend

* Node.js
* Express

### Why

* Lightweight
* Simple REST API development
* Suitable for rapid iteration

---

## Database

* SQLite

### Why

* Relational database support
* Single portable database file
* Easy local execution
* No external database installation required

### Tradeoff

SQLite is not designed for high-concurrency production systems but is ideal for this assignment and local deployment.

---

# 3. Relational Split Storage

## Decision

Store expense participants in a dedicated `expense_splits` table.

## Rejected Alternative

Store participants and split details as semicolon-separated strings.

## Why

Relational storage provides:

* Easier querying
* Cleaner calculations
* Better normalization
* Traceable balance computation

This also allows support for:

* Equal splits
* Unequal splits
* Percentage splits
* Share-based splits

without complex string parsing.

---

# 4. Human Approval for Data Corrections

## Decision

The system never silently modifies financial records.

## Why

Financial corrections can change balances and settlements.

Automatically guessing corrections could produce incorrect results.

Instead:

* Issues are detected
* Suggestions are generated
* Explanations are provided
* Users approve or reject corrections

This preserves transparency and auditability.

---

# 5. Import Review Workflow

## Decision

Provide a dedicated Import Review workflow.

## Why

The assignment dataset intentionally contains inconsistencies.

The workflow allows users to:

* Review detected issues
* Understand suggested fixes
* Apply corrections
* Maintain an audit trail

Examples:

* Missing currency
* Duplicate expenses
* Missing payer
* Ambiguous dates
* Invalid split percentages

---

# 6. Auditability

## Decision

Preserve original imported data.

## Implementation

Each imported expense stores:

* Original CSV row
* Imported values
* Resolution history

Additionally:

* User corrections are recorded in the decision log.

## Why

This makes every balance explainable and reproducible.

---

# 7. Balance Calculation Strategy

## Decision

Calculate balances dynamically.

Formula:

Balance = Paid − Share + Sent − Received

Where:

* Paid = Amount paid by user
* Share = User's portion of expenses
* Sent = Settlements sent
* Received = Settlements received

## Why

This approach keeps calculations simple, transparent, and easy to explain during review.

---

# 8. Multi-Currency Support

## Decision

Store:

* Original amount
* Original currency
* Exchange rate

for every transaction.

## Why

Balances must remain traceable to the original transaction.

Conversions are calculated dynamically using the stored exchange rate.

Example:

540 USD @ 83 INR/USD

Converted Value:

44,820 INR

---

# 9. Settlement Recommendation Algorithm

## Decision

Use a greedy cash-flow minimization algorithm.

## Why

The goal is to reduce the number of payments required to settle balances.

The algorithm:

1. Separates debtors and creditors
2. Matches largest debtor with largest creditor
3. Repeats until balances reach zero

This produces a simple settlement plan.

---

# 10. User Experience Direction

## Decision

Prioritize simplicity and consumer usability.

## Design Principles

* Minimal interface
* Clear terminology
* Splitwise-style workflows
* Plain language explanations
* Human-readable issue descriptions

Examples:

Instead of:

"Temporal Membership Conflict"

The interface shows:

"This person wasn't living in the group on this date."

---

# 11. CSV Import Positioning

## Decision

CSV import is available but not the primary workflow.

## Why

The application should remain useful even without imported data.

Users can:

* Create groups
* Add members
* Add expenses
* View balances
* Settle debts

without importing any CSV file.

---

# Final Outcome

The final system combines:

* Expense sharing
* Balance tracking
* Settlement recommendations
* CSV import
* Data quality review
* Auditability

while maintaining a simple consumer-focused experience.
