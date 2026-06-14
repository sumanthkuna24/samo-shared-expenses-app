# AI Usage & Development Prompts

## Overview
This document records the essential AI-assisted development prompts, engineering review cases, and iterative workflows used to build the Shared Expenses App (SAMO) in its current state. It serves as a guide for reproducing the development journey and understanding the architectural choices.

---

## AI Tools Used
* **ChatGPT**: Used for high-level architecture reviews, project planning, terminology simplification, and critical design analysis.
* **Antigravity**: Used for database schema implementation, backend Express routes, CSV anomaly scanning, React page components, and visual light-theme redesigns.

---

## Key Prompts & Iterative Milestones

### 1. Database Schema & Architecture Prompts
Used to establish a relational design with clean entity relationships and multi-currency support.

* **Goal**: Define a SQLite schema supporting groups, roommates, multi-currency expenses, settlements, and splits.
* **Key Guidelines**:
  * Store splits relationally in a dedicated `expense_splits` table rather than denormalized strings.
  * Preserve original CSV columns for import auditability.
  * Separate raw date text and parsed ISO dates to avoid environment-specific parsing discrepancies.
* **Resulting Schema**: [server/db.js](file:///d:/samo/server/db.js)

### 2. Anomaly Detection & Ingestion Prompts
Used to build the ingestion pipeline and write scanning rules for raw CSV rows.

* **Goal**: Write a two-stage validation pipeline: check basic schema during import, and execute post-import scans for logical anomalies.
* **Rules Defined**:
  * Duplicate records (handling NULL values explicitly).
  * Missing currency, missing payer, and unregistered participant.
  * Ambiguous date formatting.
  * Temporal membership conflicts (expense date outside roommate group active window).
  * Split sum mismatches (percentages or shares not equaling total).
* **Resulting Logic**: [server/anomalyDetector.js](file:///d:/samo/server/anomalyDetector.js)

### 3. Balance Calculation & Ledger Prompts
Used to write mathematical formulas and query logic for debt calculations and running balances.

* **Goal**: Construct a query-driven balance engine.
* **Formula Defined**:
  $$\text{Balance} = \text{Paid} - \text{Share} + \text{Sent} - \text{Received}$$
* **Resulting Code**: [server/balanceEngine.js](file:///d:/samo/server/balanceEngine.js)

### 4. Consumer UX Simplification & Refactoring Prompts
Used to convert the engineering-centric layout into a clean, Splitwise-style consumer application.

* **Goal**: Refactor the frontend pages (Dashboard, Import Review, Balance Breakdown) to use consumer-friendly terminology, hide currency conversions under expanders, and make manual entry primary while keeping CSV import as a side feature.
* **Terminology Mappings**:
  * *Total Ingested Expenses* $\rightarrow$ **Group Expenses**
  * *Recorded Settlements* $\rightarrow$ **Payments Made**
  * *Unresolved Anomalies* $\rightarrow$ **Items Needing Review**
  * *Anomaly Resolver* $\rightarrow$ **Import Review**
  * *Trace Ledger* $\rightarrow$ **Balance Breakdown**
  * *Provisional / Excluded* $\rightarrow$ **Needs Review**

### 5. Apple-Inspired Premium Theme Refinement
Used to apply a clean, minimal design system.

* **Goal**: Replace dark theme/fintech glows with a spacious light-theme styling (white background, dark grey typography, calm indigo accents, rounded corners, soft shadows).

---

## AI Review Cases (Tradeoffs & Corrections)

### Review Case 001: Missing Currency Values
* **Initial Suggestion**: Auto-assign missing currencies to `INR` on import.
* **Issue Identified**: Financial records should never be silently modified by assumptions.
* **Correction**: Store as `NULL` in the database, flag as a validation anomaly, and require explicit user resolution via the UI.

### Review Case 002: Denormalized Split Storage
* **Initial Suggestion**: Store split participant names as semicolon-separated strings inside the main `expenses` table.
* **Issue Identified**: Complicates participant-level queries, prevents relational database normalization, and makes balance breakdown verification hard to audit.
* **Correction**: Keep a dedicated `expense_splits` table mapping `expense_id` and `roommate_id` to individual split shares/percentages.

### Review Case 003: Invalid Percentage Splits
* **Initial Suggestion**: Automatically scale split percentages to sum to 100% when they total 110%.
* **Issue Identified**: Assumes values only need scaling, whereas they are likely input errors.
* **Correction**: Flag as an anomaly, lock the transaction from balance calculations, and require manual user correction.

### Review Case 004: Date Ingestion Ambiguity
* **Initial Suggestion**: Parse date strings immediately and fallback to the server's local date parsing settings.
* **Issue Identified**: Indeterministic parsing across environments could lead to different balance timelines.
* **Correction**: Map raw input to `raw_date` and parsed values to `parsed_date`, maintaining unresolved anomalies for ambiguous dates (e.g., MM-DD vs DD-MM).

### Review Case 005: Duplicate Payer Detection
* **Initial Suggestion**: Match duplicates using direct comparisons (`paid_by_id = paid_by_id`).
* **Issue Identified**: In SQL, `NULL = NULL` is false, meaning duplicate records with missing payers were missed.
* **Correction**: Explicitly write duplicate comparison logic to handle `NULL` matches.

### Review Case 006: Roommate Ledger Query Crash
* **Initial Suggestion**: Directly invoke string operations on payer names.
* **Issue Identified**: Transactions with unresolved/unknown payers threw exceptions and crashed the API ledger.
* **Correction**: Implemented defensive null checks on all database string comparisons.
