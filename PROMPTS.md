# Prompts Log

This document records the major prompts and step-by-step instructions used throughout the development of the Shared Expenses App (SAMO) project.

---

## 1. Initial Ingestion & Schema Planning
**Goal**: Analyze the imported CSV before implementation begins.
**Prompt**:
* Identify anomalies
* Categorize issues
* Suggest handling policies
* Propose database entities
* Generate initial SCOPE structure

---

## 2. Senior-Engineer Design Review
**Goal**: Perform a design review of anomaly handling policies and database schema.
**Prompt**:
* Challenge all recommendations that rely on silent assumptions.
* Classify anomaly resolutions as:
  * Safe Auto-Fix
  * Suggested Fix Requiring User Approval
  * Manual Resolution Required
* Review auditability and reproducibility requirements.
* Evaluate schema support for:
  * Import tracking
  * Membership history validation
  * Anomaly resolution workflows
  * Balance explainability
* Recommend architecture improvements and identify unresolved risks.

---

## 3. Final Architecture Review
**Goal**: Conduct a final architecture review before implementation.
**Prompt**:
* Validate schema simplicity against a 2-day implementation timeline.
* Validate explainability for a 45-minute engineering review.
* Reassess relational modeling of expense splits.
* Reassess multi-currency handling without hardcoded exchange-rate assumptions.
* Review auditability requirements.
* Produce a final schema supporting:
  * Authentication
  * Groups
  * Membership history
  * Expenses
  * Multiple split strategies
  * Settlements
  * CSV imports
  * Anomaly detection
  * Balance traceability
  * Multi-currency support
* Recommend implementation order.

---

## 4. Frontend Setup & Routing
**Goal**: Setup the React + Vite frontend workspace structure and routing.
**Prompt**:
* Show the exact frontend folder structure.
* Create:
  * `client/`
  * `client/src/App.jsx`
  * `client/src/main.jsx`
  * `client/src/pages/`
  * `client/src/components/`
  * `client/src/services/`
  * `client/src/styles/`
* Implement the minimum UI required for:
  * Login Screen

---

## 5. Dashboard, Balances & Settlements
**Goal**: Implement the core Dashboard components.
**Prompt**:
* Show current ledger status (Clean / Provisional) and unresolved anomaly count.
* Render the Import Summary Card (Total Expenses, Total Settlements, Total Anomalies, Warning Count, Error Count).
* Create the Balances Grid showing: Roommate name, Total Paid, Total Share, Settlements Sent, Settlements Received, Net Balance.
* Visually distinguish creditors and debtors.
* Render Minimized Settlement Recommendations.

---

## 6. Anomaly Resolver
**Goal**: Implement the Anomaly Resolver / Import Review workflow.
**Prompt**:
* Build Anomaly Queue Sidebar grouped by severity (Error / Warning).
* Build Resolution Wizard Card containing category, explanation, why it affects calculations, raw CSV row, current database values, suggested resolution.
* Implement Resolution Forms:
  * Missing Payer (dropdown selector)
  * Missing Currency (currency selector/input)
  * Ambiguous Date (candidate date selector/picker)
  * Unregistered Name (merge or create roommate)
  * Temporal Membership Conflict (keep or remove participant)
  * Duplicate Transaction (keep first/second or merge)
  * Classification Ambiguity (expense or settlement toggle)
* Build the Decision Log Panel showing recent resolutions.

---

## 7. Trace Ledger / Balance Breakdown
**Goal**: Implement the Trace Ledger / Balance Breakdown page.
**Prompt**:
* Build Roommate Selector.
* Render Ledger Summary Card (Total Paid, Total Share, Sent, Received, Net Balance).
* Build Chronological Trace Table showing: Date, Description, Original Amount, Currency, Exchange Rate, Paid Contribution, Share Amount, Net Impact, Running Balance, Status.
* Visually grey out excluded transactions and show the reason (e.g., Ambiguous Date).
* Build the Balance Explanation Panel to show the dynamic arithmetic.

---

## 8. End-to-End Verification
**Goal**: Verify all system flows work together cleanly.
**Prompt**:
* Test complete workflow: Login $\rightarrow$ CSV Import $\rightarrow$ Anomaly Detection $\rightarrow$ Resolution $\rightarrow$ Balance Update $\rightarrow$ Settlement Recommendation $\rightarrow$ Ledger Trace.
* Verify:
  * Dashboard counts match database records.
  * Resolving an anomaly reduces unresolved count.
  * Dashboard auto-refreshes.
  * Ledger reflects updated calculations.
  * Settlement recommendations update.
  * No console errors or backend exceptions.

---

## 9. Splitwise-Style UX Refinement
**Goal**: Refactor the UX to feel like a consumer Splitwise-style product.
**Prompt**:
* Make CSV import optional, not the center of the product.
* Rename technical terminology:
  * Total Ingested Expenses $\rightarrow$ Group Expenses
  * Recorded Settlements $\rightarrow$ Payments Made
  * Unresolved Anomalies $\rightarrow$ Items Needing Review
  * Anomaly Resolver $\rightarrow$ Import Review
  * Trace Ledger $\rightarrow$ Balance Breakdown
* Add flows for:
  * Landing Page
  * Create Group
  * Add Member
  * Add Expense
* Re-style the UI to use Apple-inspired design principles (light theme, high-quality typography, spacious layouts, rounded corners, soft shadows).
