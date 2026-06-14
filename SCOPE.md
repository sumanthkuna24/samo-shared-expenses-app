# Project Scope & Data Anomalies (SCOPE.md)

## 1. Project Scope

Build a shared expenses application capable of:

* User authentication
* Group management
* Membership history tracking
* Expense management
* Multiple split strategies (Equal, Unequal, Percentage, Share-based)
* Debt settlement tracking
* CSV import with anomaly detection
* Balance summaries and detailed balance explanations

---

## 2. CSV Import Scope

The importer must:

1. Import the CSV exactly as provided.
2. Detect anomalies.
3. Surface anomalies to users.
4. Avoid silent assumptions.
5. Produce an import report containing all detected issues and actions taken.

---

## 3. Initial Anomaly Categories

### Duplicate Records
* **Examples**: Marina Bites duplicate entries, Thalassa conflicting entries.
* **Status**: Detected

### Missing Required Data
* **Examples**: Missing payer, missing currency.
* **Status**: Detected

### Numeric Formatting Issues
* **Examples**: Amount values containing commas, leading/trailing spaces, excess decimal precision.
* **Status**: Detected

### Date Issues
* **Examples**: Multiple date formats, ambiguous dates, missing year values.
* **Status**: Detected

### Identity Resolution Issues
* **Examples**: Name casing inconsistencies, trailing whitespace, possible aliases (Priya vs Priya S).
* **Status**: Detected

### Membership Timeline Issues
* **Examples**: Expenses including Meera after move-out, expenses affecting users before joining.
* **Status**: Detected

### Settlement Classification Issues
* **Examples**: Repayments logged as expenses, deposits recorded as expenses.
* **Status**: Detected

### Split Validation Issues
* **Examples**: Percentages exceeding 100%, split type conflicting with split details.
* **Status**: Detected

### Guest Participant Issues
* **Examples**: Non-member participants such as Kabir.
* **Status**: Detected

---

## 4. Planned Database Entities

* **Users**: System accounts and auth credentials.
* **Groups**: Budgeting groups (e.g. shared apartments).
* **GroupMemberships**: Association mapping users to groups with join/leave dates.
* **Expenses**: Financial transactions representing group expenditures.
* **ExpenseSplits**: Relational split distributions mapping roommates to their split amount/percentage.
* **Settlements**: Log of payments made from debtor to creditor to resolve balances.
* **ImportReports**: Audit log of imported files, row counts, and scan timestamps.
* **DataAnomalies**: Identified data validation errors/warnings that must be resolved.

---

## 5. CSV Anomaly Resolution Matrix

Anomalies are scanned post-import, stored in the `data_anomalies` table, and linked directly to their source transaction record. Balance calculations are blocked or adjusted until all anomalies of severity `Error` or `Warning` are resolved.

| ID | Row(s) | Category | Class | Trigger | Action / Proposed Solution |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AN-01** | 5, 6 | Duplicate | **Suggested Fix** | Match on date, payer, split, amount. | Keep Row 5 (with notes), set Row 6 `anomaly_status = 'ignored'`. |
| **AN-02** | 24, 25 | Duplicate Conflict | **Manual** | Match date & split, different amount/payer. | Choose: Keep Row 24, Keep Row 25, or Merge into co-payment. |
| **AN-03** | 7 | String Number | **Safe Auto-Fix** | Number formatted as `"1,200"`. | Parse and normalize to `1200.00`. |
| **AN-04** | 29 | Spaced Number | **Safe Auto-Fix** | Whitespace in amount (` 1450 `). | Trim whitespace and parse. |
| **AN-05** | 10 | Precision | **Safe Auto-Fix** | Decimal precision exceeds standard (`899.995`). | Round to 2 decimal places (`900.00`). |
| **AN-06** | 31 | Zero Value | **Suggested Fix** | Amount is `0`. | Set status to `ignored` with reason 'Zero Amount'. |
| **AN-07** | 13 | Missing Payer | **Manual** | `paid_by` is empty. | Block calculations until user selects payer in UI. |
| **AN-08** | 28 | Missing Currency | **Suggested Fix** | `currency` is empty. | Suggest base currency (INR) based on merchant. User must approve. |
| **AN-09** | 15, 32 | Split Sum Error | **Manual** | Split percentages sum to 110%. | Block until user manually corrects splits in `expense_splits` to 100%. |
| **AN-10** | 42 | Split Details Mismatch | **Safe Auto-Fix** | split_type `equal` has split details. | If detail values are all equal, auto-convert to equal split. |
| **AN-11** | 9, 27 | Casing/Whitespace | **Safe Auto-Fix** | `priya` / `rohan `. | Standardize: capitalize and trim names. |
| **AN-12** | 11 | Name Variant | **Manual** | Payer `Priya S` not in group. | Prompt user: Merge with `Priya` or create new roommate. |
| **AN-13** | 23 | External Guest | **Manual** | Split contains guest `Kabir`. | Prompt: Absorb Kabir's share into Dev, or add Kabir as guest. |
| **AN-14** | 34 | Ambiguous Date | **Manual** | Date `04/05/2026`. | User must select April 5 or May 4. |
| **AN-15** | 36 | Temporal | **Manual** | Meera split after move-out (March 29). | Suggest removing Meera from split; user must approve. |
| **AN-16** | 14, 38 | Classification | **Suggested Fix** | P2P transfer logged as expense. | Suggest importing as Settlement. User must approve. |

---

## 6. Roommate Registries & Temporal Timeline

These values represent the membership timeline of the roommate group in the assignment dataset, which are used to validate transactions against active dates:

* **Aisha**: Joined `2026-02-01`, Active
* **Rohan**: Joined `2026-02-01`, Active
* **Priya**: Joined `2026-02-01`, Active
* **Meera**: Joined `2026-02-01`, Left `2026-03-29`
* **Sam**: Joined `2026-04-08`, Active
