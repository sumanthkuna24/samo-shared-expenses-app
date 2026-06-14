# IMPORT_REPORT.md

## Shared Expenses App – CSV Import Report

### Import Summary

* Total Rows Processed: 42
* Rows Imported Successfully: 42
* Anomalies Detected: 16
* Auto-Fixed Anomalies: 5
* User Review Required: 11

---

## AN-01 – Potential Duplicate Transaction

**Rows:** 5, 6
**Description:** Duplicate "Dinner at Marina Bites" entries with matching amount, payer, date, and participants.

**Detection Result:** Potential duplicate detected.

**Action Taken:** Flagged for user review. User chooses whether to keep one entry or both.

**Status:** Review Required

---

## AN-02 – Conflicting Duplicate Transaction

**Rows:** 24, 25

**Description:** Two Thalassa Dinner records with matching participants but different amounts/payers.

**Detection Result:** Possible duplicate or co-payment conflict.

**Action Taken:** Flagged for manual review.

**Status:** Review Required

---

## AN-03 – String Number Format

**Row:** 7

**Description:** Amount stored as `"1,200"`.

**Detection Result:** Formatting anomaly.

**Action Taken:** Automatically converted to `1200.00`.

**Status:** Auto-Fixed

---

## AN-04 – Whitespace Number Format

**Row:** 29

**Description:** Amount contains leading/trailing spaces.

**Detection Result:** Formatting anomaly.

**Action Taken:** Trimmed whitespace and parsed value.

**Status:** Auto-Fixed

---

## AN-05 – Excess Decimal Precision

**Row:** 10

**Description:** Amount `899.995`.

**Detection Result:** Currency precision anomaly.

**Action Taken:** Rounded to `900.00`.

**Status:** Auto-Fixed

---

## AN-06 – Zero Value Expense

**Row:** 31

**Description:** Transaction amount equals zero.

**Detection Result:** Potential void transaction.

**Action Taken:** Flagged for review.

**Status:** Review Required

---

## AN-07 – Missing Payer

**Row:** 13

**Description:** Expense has no payer.

**Detection Result:** Unable to allocate payment responsibility.

**Action Taken:** Flagged for manual payer assignment.

**Status:** Review Required

---

## AN-08 – Missing Currency

**Row:** 28

**Description:** Currency field is empty.

**Detection Result:** Currency unavailable.

**Action Taken:** Stored as NULL and flagged for review.

**Status:** Review Required

---

## AN-09 – Invalid Percentage Split

**Rows:** 15, 32

**Description:** Split percentages total 110%.

**Detection Result:** Split calculation invalid.

**Action Taken:** Flagged for manual correction.

**Status:** Review Required

---

## AN-10 – Split Schema Mismatch

**Row:** 42

**Description:** Equal split contains redundant split details.

**Detection Result:** Schema inconsistency.

**Action Taken:** Automatically normalized.

**Status:** Auto-Fixed

---

## AN-11 – Name Formatting

**Rows:** 9, 27

**Description:** Participant names contain casing/spacing inconsistencies.

**Detection Result:** Formatting anomaly.

**Action Taken:** Trimmed and normalized names.

**Status:** Auto-Fixed

---

## AN-12 – Unregistered Participant Name

**Row:** 11

**Description:** "Priya S" not found in member registry.

**Detection Result:** Unknown participant.

**Action Taken:** Flagged for user decision (merge or create new member).

**Status:** Review Required

---

## AN-13 – Guest Participant

**Row:** 23

**Description:** Guest participant "Kabir" not registered.

**Detection Result:** External participant detected.

**Action Taken:** Flagged for manual resolution.

**Status:** Review Required

---

## AN-14 – Ambiguous Date

**Row:** 34

**Description:** Date value `04/05/2026` is ambiguous.

**Detection Result:** Unable to determine intended date.

**Action Taken:** Flagged for user selection.

**Status:** Review Required

---

## AN-15 – Temporal Membership Conflict

**Row:** 36

**Description:** Expense includes a roommate outside active membership dates.

**Detection Result:** Timeline violation detected.

**Action Taken:** Flagged for review.

**Status:** Review Required

---

## AN-16 – Classification Ambiguity

**Rows:** 14, 38

**Description:** Transaction may represent either a settlement or an expense.

**Detection Result:** Classification conflict.

**Action Taken:** Flagged for user review.

**Status:** Review Required

---

## Import Outcome

The import completed successfully.

Formatting-related issues were corrected automatically where no business assumptions were required.

Financial, ownership, participant, date, currency, duplicate, and classification anomalies were surfaced for user review to avoid silent modification of imported financial data.
