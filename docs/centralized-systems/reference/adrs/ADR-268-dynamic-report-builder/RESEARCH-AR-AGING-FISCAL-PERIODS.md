# Research: Customer Balances / AR Aging & Fiscal Period Management

**Date**: 2026-03-29
**Scope**: Competitive analysis across 7 major accounting platforms
**Purpose**: Inform design of accounting features for Nestor (Greek sole proprietor / small business)

---

## Part A: Customer Balances / Accounts Receivable Aging

### A.1 Aging Bucket Structure by Vendor

| Vendor | Default Buckets | Customizable? | Max Buckets |
|--------|----------------|---------------|-------------|
| **SAP Business One** | 0-30, 31-60, 61-90, 90+ | Partially (interval window) | 4 fixed buckets |
| **Oracle NetSuite** | Current, 1-30, 31-60, 61-90, 90+ | Yes (Interval + Duration fields) | Configurable |
| **Xero** | Current, 1-30, 31-60, 61-90, 90+ | Yes (aging periods config) | Configurable |
| **QuickBooks** | Current, 1-30, 31-60, 61-90, 90+ | Yes (days per period, number of periods) | Configurable |
| **SAGE 50/300** | Current, 1-30, 31-60, 61-90, 90+ | Yes | Configurable |
| **FreshBooks** | Current, 1-30, 31-60, 61-90, 90+ | Limited | Fixed |
| **Zoho Books** | Current, 1-30, 31-60, 61-90, 90+ | Yes (interval-based) | Configurable |

**Consensus**: The 30/60/90/90+ pattern is universal. Most enterprise systems allow customization (e.g., 15-day buckets, 120+ bucket). SAP B1 is the most rigid with only 4 buckets.

**Recommendation for Nestor**: Use configurable buckets with defaults `Current | 1-30 | 31-60 | 61-90 | 91-120 | 120+`. For Greek sole proprietors, 30-day intervals align with monthly VAT/income tracking.

---

### A.2 Real-Time Calculation vs Pre-Computed Snapshots

| Vendor | Approach | Details |
|--------|----------|---------|
| **SAP Business One** | Real-time query | Queries open AR documents on-demand, groups by aging |
| **Oracle NetSuite** | Real-time (SuiteQL) | `AmountUnpaid` for invoices, `PaymentAmountUnused` for credits; age = `CURRENT_DATE - dueDate` |
| **Xero** | Real-time | Calculates from open invoices at report generation time |
| **QuickBooks** | Real-time | Runs against current transaction data, option for scheduled refresh |
| **SAGE** | Real-time query | Past-date aging also available (snapshot at historical date) |
| **FreshBooks** | Real-time | Simple query against open invoices |
| **Zoho Books** | Real-time | Calculated from open invoices/bills at report time |

**Consensus**: All vendors calculate aging **real-time** from open transactions. No one pre-computes/caches aging data. Some (SAP, SAGE) offer **past-date aging** (recalculate aging as of a historical date).

**Recommendation for Nestor**: Real-time calculation from `accounting_invoices` where `status !== 'paid'`. For performance, memoize per session. Add optional "as-of date" parameter for past-date aging.

---

### A.3 Multi-Currency Balance Handling

| Vendor | Approach |
|--------|----------|
| **SAP Business One** | Balances in transaction currency + local currency. Revaluation via Period-End Closing |
| **Oracle NetSuite** | Dual display: transaction currency + base currency. Revaluation as period-close task |
| **Xero** | Auto-converts at daily exchange rate. Credit notes must match invoice currency |
| **QuickBooks** | Base currency display. Multi-currency as premium feature |
| **SAGE 300** | Full multi-currency. Revaluation creates unrealized gain/loss entries |
| **FreshBooks** | Base currency only in aging |
| **Zoho Books** | Credit limits in base currency only. Invoices can be foreign currency |

**Recommendation for Nestor**: For a Greek sole proprietor, EUR is the primary currency. Support optional foreign currency tracking on invoices, but aging/balances always in EUR. No multi-currency revaluation needed (Phase 1).

---

### A.4 Customer Statements

| Vendor | Statement Types | Delivery |
|--------|----------------|----------|
| **SAP Business One** | Dunning letters (10 levels), aging statements | Print/Email |
| **Oracle NetSuite** | Balance Forward, Open Item | Email/Print/PDF |
| **Xero** | Outstanding (open items), Activity (date range) | Email from UI |
| **QuickBooks** | Balance Forward, Open Item, Transaction | Email/Print/PDF |
| **SAGE** | Customer statements, dunning letters | Print/Email |
| **FreshBooks** | Basic statement | Email |
| **Zoho Books** | Customer statement (activity log) | Email/PDF |

**Three standard types across industry**:
1. **Balance Forward**: Running balance, pays by total amount
2. **Open Item**: Lists individual unpaid invoices, pays per invoice
3. **Activity/Transaction**: Full transaction history for a period

**Recommendation for Nestor**: Implement **Open Item** statement (Greek businesses pay per invoice, not running balance). Add PDF generation using existing jsPDF infrastructure.

---

### A.5 Credit Limits & Credit Holds

| Vendor | Credit Limit | Credit Hold | Auto-Hold | Available Credit |
|--------|-------------|-------------|-----------|-----------------|
| **SAP Business One** | Per customer | Manual + Auto (credit freeze) | Yes (configurable threshold) | `creditLimit - balance` |
| **Oracle NetSuite** | Per customer | Manual (`On`) + Auto (limit exceeded) | Yes (with grace period) | `creditLimit - balanceDue` |
| **Xero** | Per customer | Warning only (no hard block) | No | Displayed in report |
| **QuickBooks** | No native feature | No | No | No |
| **SAGE** | Per customer | Yes | Yes | Calculated |
| **FreshBooks** | No | No | No | No |
| **Zoho Books** | Per customer | Warning or Restrict mode | Yes | `creditLimit - outstanding` |

**Consensus**: Enterprise systems (SAP, NetSuite, SAGE) have full credit management. SMB tools (Xero, Zoho) have basic limits. QuickBooks and FreshBooks lack credit limits.

**Available Credit formula** (universal):
```
availableCredit = creditLimit - (totalOutstanding - unappliedCredits)
```

**Recommendation for Nestor**: Implement credit limits per customer with configurable behavior (warn vs block). Available credit = `creditLimit - outstandingBalance + unappliedCredits`.

---

### A.6 Disputed Invoice Handling

| Vendor | Dispute Tracking | Effect on Aging |
|--------|-----------------|-----------------|
| **SAP Business One** | No dedicated dispute module (S/4HANA has FSCM Dispute Management) | Included in aging unless manually credited |
| **Oracle NetSuite** | Manual flag on transactions | Included in aging |
| **Xero** | No dispute feature | Included in aging |
| **QuickBooks** | Manual notes/tags | Included in aging |
| **SAGE** | Hold/dispute flag | Can be excluded from dunning |
| **FreshBooks** | No | Included in aging |
| **Zoho Books** | No dedicated feature | Included in aging |

**Consensus**: Only SAP S/4HANA has formal dispute management. All SMB tools include disputed invoices in aging. The standard practice is to flag invoices as "disputed" and optionally exclude from dunning/collections.

**Recommendation for Nestor**: Add optional `disputed: boolean` flag on invoices. Disputed invoices appear in aging but are visually marked. Exclude from automated dunning.

---

### A.7 Data Structure Summary (Cross-Vendor Patterns)

Common data model for customer balance:

```typescript
interface CustomerBalance {
  customerId: string;
  customerName: string;
  // Aging buckets
  current: number;       // Not yet due
  days1to30: number;     // 1-30 days overdue
  days31to60: number;    // 31-60 days overdue
  days61to90: number;    // 61-90 days overdue
  days91to120: number;   // 91-120 days overdue
  days121plus: number;   // 121+ days overdue
  totalOverdue: number;  // Sum of all overdue
  totalOutstanding: number; // current + totalOverdue
  // Credit management
  creditLimit: number | null;
  availableCredit: number | null;
  unappliedCredits: number; // Credit notes not yet applied
  // Metadata
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
  averageDaysToPay: number | null;
  invoiceCount: number;
  oldestInvoiceDate: Date | null;
  hasDisputedInvoices: boolean;
}
```

---

## Part B: Fiscal Period Management

### B.1 Period Status Lifecycle by Vendor

| Vendor | Statuses | Notes |
|--------|----------|-------|
| **SAP Business One** | `Unlocked` > `Unlocked Except Sales` > `Closing Period` > `Locked` | 4-state model. "Closing Period" = only authorized users can post |
| **Oracle NetSuite** | `Open` > `Locked (A/R)` > `Locked (A/P)` > `Locked (Payroll)` > `Locked (All)` > `Closed` | Granular module-by-module locking via Period Close Checklist |
| **Xero** | `Open` > `Locked` (via lock date) | Simple lock date model. Advisor role required |
| **QuickBooks** | `Open` > `Closed` (via closing date + password) | Binary model. Password protection for changes |
| **SAGE 50** | `Open` > `Locked` (per period) | Two fiscal years open simultaneously (periods 1-12 + 13-24) |
| **SAGE 300** | `Open` > `Locked` (per module) > `Closed` | Supports adjustment period (period 14) + closing period (period 15) |
| **FreshBooks** | `Open` > `Locked` (financial lock date) | Simple lock. Can be unlocked anytime |
| **Zoho Books** | `Open` > `Locked` (per module or all) | Module-level locking. Partial unlock supported |

**Consensus**: Three tiers of sophistication:
1. **Simple** (Xero, QB, FreshBooks): Single lock date, binary open/closed
2. **Intermediate** (Zoho, SAGE 50): Per-period locking, unlock/relock
3. **Enterprise** (SAP, NetSuite, SAGE 300): Multi-status lifecycle, module-level locking, checklists

---

### B.2 Soft Close vs Hard Close

| Concept | Description | Who Has It |
|---------|-------------|------------|
| **Soft Close** (Lock) | Prevents casual posting. Authorized users can still post with override/password | SAP B1 ("Closing Period" status), NetSuite (Locked), QuickBooks (closing date + password) |
| **Hard Close** | No posting possible, period is final | SAP B1 ("Locked" status), NetSuite ("Closed"), SAGE 300 (Closed) |
| **Module-Level Lock** | Lock A/R, A/P, Payroll independently before full close | NetSuite (explicit), SAGE 300, Zoho Books |

**Recommendation for Nestor**: Implement 3-state model: `OPEN` > `SOFT_CLOSED` (admin can still post with reason) > `HARD_CLOSED` (no posting). This covers Greek accounting needs where the accountant may need to post corrections after initial review.

---

### B.3 Posting to Closed Periods with Override

| Vendor | Allows Override? | How? |
|--------|-----------------|------|
| **SAP Business One** | Yes (Closing Period status) | Only users with "period-end closing" authorization |
| **Oracle NetSuite** | Yes (Locked periods) | Users with "Override Period Restrictions" permission |
| **Xero** | Yes | Advisor role can change lock date, post, relock |
| **QuickBooks** | Yes | Users who know the closing password can modify |
| **SAGE 300** | Yes | Unlock period, post, relock |
| **FreshBooks** | Yes | Unlock, post, relock |
| **Zoho Books** | Yes | Unlock specific date range, post, relock |

**Consensus**: Every vendor allows posting to closed periods via some override mechanism. The key differences:
- **Permission-based**: SAP, NetSuite (best practice)
- **Password-based**: QuickBooks
- **Manual unlock/relock**: Xero, SAGE, FreshBooks, Zoho

**Recommendation for Nestor**: Permission-based override. Soft-closed period allows posting with `overrideReason` (audit trail). Hard-closed requires explicit re-open action.

---

### B.4 Year-End Closing Process

| Vendor | Process | Auto-Closing Entries? | Retained Earnings? |
|--------|---------|----------------------|-------------------|
| **SAP Business One** | Period-End Closing wizard (Administration > Utilities) | Yes (zeros P&L accounts) | Yes (sweeps to Retained Earnings account) |
| **Oracle NetSuite** | Automatic or Manual year-end close | Yes (recommended automatic method) | Yes (adjusts retained earnings based on balance sheet dates) |
| **Xero** | Automatic (closing balance = next year opening balance) | Automatic | Automatic |
| **QuickBooks** | Auto-adjusting at year-end | Yes (zeros income/expense, creates net income entry) | Yes (automatic) |
| **SAGE 300** | Create New Year function | Yes (closes income/expense to retained earnings) | Yes (auto-generated closing entries) |
| **FreshBooks** | Manual lock of fiscal year | No auto-closing entries | No (simple lock date) |
| **Zoho Books** | Auto (closing balance = opening balance of new year) | Automatic | Automatic |

**Year-End Closing Steps (Universal Pattern)**:
1. Review and reconcile all accounts
2. Post adjustment entries (accruals, deferrals, depreciation)
3. Run period-end reports (trial balance, P&L, balance sheet)
4. Execute closing entries (zero P&L to Retained Earnings)
5. Lock/close all periods of the fiscal year
6. Open new fiscal year

**Recommendation for Nestor**: For Greek sole proprietor (single-entry/simplified double-entry):
- Year = January 1 - December 31 (Greek fiscal year)
- Year-end: Auto-generate closing entries sweeping P&L to equity
- Lock previous year after annual tax filing (typically by June following year)

---

### B.5 Adjustment Periods (Period 13)

| Vendor | Has Period 13? | How It Works |
|--------|---------------|--------------|
| **SAP Business One** | No explicit Period 13 | Adjustments via regular journal entries in the last period |
| **Oracle NetSuite** | Yes (optional, via 4-week periods = 13 periods) | Period 13 is a regular period in 4-week calendar |
| **Xero** | No | Adjustments posted to December |
| **QuickBooks** | No | Adjustments posted to last period |
| **SAGE 50** | Implicit (periods 1-12 + periods 13-24 for second year) | No dedicated adjustment period |
| **SAGE 300** | Yes (Period 14 = adjustment, Period 15 = closing) | Dedicated adjustment period for year-end entries. Does not appear in monthly reports |
| **FreshBooks** | No | No |
| **Zoho Books** | No | No |

**Consensus**: Only SAGE 300 has a true "adjustment period" separate from regular months. Most systems post adjustments to the last regular period (December). NetSuite's period 13 is for 4-week calendars, not adjustments.

**Recommendation for Nestor**: Do not implement Period 13. Greek accounting standards do not require it. Adjustments post to December (period 12). Optionally tag journal entries as `adjustmentType: 'YEAR_END'` for filtering in reports.

---

### B.6 Period-End Checklists

| Vendor | Has Checklist? | Built-in Tasks |
|--------|---------------|----------------|
| **Oracle NetSuite** | Yes (comprehensive) | Lock A/R > Lock A/P > Lock Payroll > Lock All > Intercompany Adjustments > Revalue Foreign Currency > Recognize Revenue > Create Period End Journals > GL Audit Numbering > Close |
| **SAP Business One** | Partial (manual steps) | Period-End Closing wizard handles core steps |
| **Xero** | No (third-party tools like Numeric) | Manual process |
| **QuickBooks** | No (community guides exist) | Manual checklist |
| **SAGE 300** | No built-in checklist | Manual process |
| **FreshBooks** | No | Manual |
| **Zoho Books** | No | Manual |

**NetSuite's Period Close Checklist (Best-in-Class)**:
1. Lock A/R transactions
2. Lock A/P transactions
3. Lock Payroll transactions
4. Lock All transactions
5. Resolve inventory date/period mismatches
6. Review negative inventory
7. Create intercompany adjustments
8. Revalue open foreign currency balances
9. Recognize revenue
10. Create period-end journal entries
11. Calculate consolidated exchange rates
12. GL Audit Numbering (gapless sequence)
13. Close Period

**Recommendation for Nestor**: Implement a simplified checklist for Greek sole proprietor:
1. Review unbilled revenue
2. Post depreciation entries (monthly)
3. Reconcile bank accounts
4. Review VAT calculations
5. Generate trial balance
6. Lock period

---

### B.7 Cross-Period Reversals

| Vendor | Approach |
|--------|----------|
| **SAP Business One** | Reversal creates new JE in current period referencing original. Can specify reversal date |
| **Oracle NetSuite** | Reversing journal entries: auto-reverse on first day of next period |
| **Xero** | Manual reversal. Must be in unlocked period |
| **QuickBooks** | Manual reversal entry |
| **SAGE 300** | Auto-reversal: system creates reversing entries on first/last day of next period (configurable) |
| **FreshBooks** | Manual |
| **Zoho Books** | Manual reversal |

**Universal Pattern**:
- Original entry: Period N (e.g., March)
- Reversal: Posted to Period N+1 (e.g., April 1st) with opposite debits/credits
- Both entries reference each other for audit trail
- If Period N is locked, reversal goes to first open period

**Recommendation for Nestor**: Auto-reversal support. When creating a reversal:
- Default reversal date = first day of next period
- If target period is locked, prompt for next open period
- Link original + reversal entries via `reversalOfId` / `reversedById`

---

### B.8 Automatic Period Opening

| Vendor | Auto-Open? |
|--------|-----------|
| **SAP Business One** | No (manual creation of posting periods) |
| **Oracle NetSuite** | Yes (can auto-create fiscal year periods) |
| **Xero** | Yes (continuous, no explicit periods) |
| **QuickBooks** | Yes (continuous, no explicit periods) |
| **SAGE 300** | No (Create New Year function required) |
| **FreshBooks** | Yes (continuous) |
| **Zoho Books** | Yes (automatic new fiscal year) |

**Two paradigms**:
1. **Explicit period management** (SAP, SAGE, NetSuite): Periods must be created/opened. Better control
2. **Continuous/implicit** (Xero, QB, FreshBooks, Zoho): No explicit periods, just lock dates. Simpler

**Recommendation for Nestor**: Hybrid approach. Auto-create 12 monthly periods for each fiscal year. Periods auto-open on their start date. Manual close/lock required.

---

## Part C: Greek-Specific Considerations

### C.1 Greek Fiscal Year
- Fixed: **January 1 - December 31** (no variation for sole proprietors)
- Tax filing: Annual income tax by June 30 of following year
- Books closing: After annual tax submission

### C.2 VAT Period Alignment
- **Sole proprietors (single-entry)**: Quarterly VAT filing
  - Q1: Jan-Mar (due April 30)
  - Q2: Apr-Jun (due July 31)
  - Q3: Jul-Sep (due October 31)
  - Q4: Oct-Dec (due January 31)
- Period management should align with quarterly VAT deadlines
- Lock periods quarterly after VAT submission

### C.3 myDATA / AADE Compliance
- Monthly data submission to AADE (by 20th of following month)
- Period locking should happen AFTER myDATA submission for that month
- Suggested workflow: Submit myDATA > Review > Lock month
- B2B e-invoicing mandatory from March 2026

### C.4 Recommended Period Structure for Nestor

```
Fiscal Year 2026:
  Period 01 (Jan): OPEN → SOFT_CLOSED (after myDATA) → HARD_CLOSED (after VAT Q1)
  Period 02 (Feb): OPEN → SOFT_CLOSED → HARD_CLOSED
  Period 03 (Mar): OPEN → SOFT_CLOSED → HARD_CLOSED (after VAT Q1 filing)
  Period 04 (Apr): OPEN → SOFT_CLOSED → HARD_CLOSED
  ...
  Period 12 (Dec): OPEN → SOFT_CLOSED → HARD_CLOSED (after annual tax filing)
```

---

## Part D: Design Recommendations Summary

### D.1 Customer Balance / AR Aging

| Feature | Priority | Implementation |
|---------|----------|----------------|
| Standard aging buckets (Current/30/60/90/120+) | P0 | Real-time query from invoices |
| Configurable bucket intervals | P1 | User preference |
| Customer statements (Open Item) | P0 | PDF via jsPDF |
| Credit limits per customer | P1 | Field on contact, check on invoice creation |
| Available credit calculation | P1 | `creditLimit - outstanding + credits` |
| Disputed invoice flag | P2 | Boolean field + visual indicator |
| Past-date aging (as-of date) | P2 | Historical recalculation |
| Dunning letters | P2 | Template-based, multi-level |
| Average days to pay metric | P1 | Computed from payment history |

### D.2 Fiscal Period Management

| Feature | Priority | Implementation |
|---------|----------|----------------|
| 12 monthly periods per year | P0 | Auto-created, Jan-Dec |
| 3-state lifecycle (Open/Soft/Hard) | P0 | `FiscalPeriod` document in Firestore |
| Soft close with override + reason | P0 | Permission-based, audit trail |
| Hard close (no posting) | P0 | Absolute lock |
| Period-end checklist (simplified) | P1 | 6-step Greek-specific checklist |
| Year-end closing entries | P1 | Auto-generate P&L sweep |
| Cross-period reversals | P1 | Auto-date to next open period |
| VAT quarter alignment | P0 | Visual grouping of Q1-Q4 |
| myDATA submission tracking per period | P1 | Status field on period |
| Automatic period creation for new year | P2 | Auto-create on Dec 31 |

---

## Sources

### SAP Business One
- [Customer Receivables Aging Report](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/a8d7ac9975754253ae9aac47387f73c6.html)
- [Posting Periods in SAP B1](https://sap-b1-blog.com/en/posting-periods-sap-business-one/)
- [Year-End Closing in SAP B1](https://www.seidor.com/en-us/blog/sap-business-one-how-perform-year-end-closing)
- [Credit Management in SAP B1](https://sap-b1-blog.com/en/credit-management-with-sap-business-one/)
- [Credit Limit Concept](https://www.sap-business-one-tips.com/en/credit-limit-concept/)

### Oracle NetSuite
- [A/R Aging Summary Report](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1531392.html)
- [Period Close Checklist](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1455781.html)
- [Locking/Unlocking Periods](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1451780.html)
- [Year-End Closing](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1457773.html)
- [Managing Customer Credit](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1080144.html)
- [SuiteQL AR Aging](https://timdietrich.me/blog/netsuite-suiteql-accounts-receivable-aging/)

### Xero
- [Aged Receivables Summary](https://central.xero.com/s/article/Aged-Receivables-Summary-report-New)
- [Lock Dates](https://central.xero.com/s/article/Set-up-and-work-with-lock-dates-US)
- [Multi-Currency](https://www.xero.com/us/accounting-software/use-multiple-currencies/)

### QuickBooks
- [AR Aging Report](https://quickbooks.intuit.com/learn-support/en-us/help-article/accounts-receivable-reports/run-accounts-receivable-aging-report/L4N7PC2hg_US_en_US)
- [Close Books](https://quickbooks.intuit.com/learn-support/en-us/help-article/close-books/close-books-quickbooks-desktop/L8T1Cgfhk_US_en_US)
- [Lock Closed Periods](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/how-to-lock-closed-periods/00/193572)
- [Statement Types](https://plugin-qbo.intuit.com/qbo-ush/helpcontent/production/latest/en_US/QBO_Plus/Content/Topics/customer/help_customer_statements_types.htm)

### SAGE
- [Sage 300 Fiscal Years and Periods](https://help.sage300.com/en-us/2021/web/Subsystems/GL/Content/Setup/AboutFiscalYearsAndPeriods.htm)
- [Sage 50 Close Fiscal Year](https://help-sage50.na.sage.com/en-us/2019/Content/YEAREND/CloseFiscalYear.htm)
- [Sage 200 Accounting Periods](https://desktophelp.sage.co.uk/sage200/sage200standard/Content/Screens/Settings/Accounting%20Periods.htm)

### FreshBooks
- [Financial Lock](https://support.freshbooks.com/hc/en-us/articles/360061299751-What-is-financial-lock)
- [AR Aging Report Guide](https://www.freshbooks.com/hub/reports/accounts-receivable-aging-report)

### Zoho Books
- [Receivables Reports](https://www.zoho.com/us/books/help/reports/receivables.html)
- [Customer Credit Limits](https://www.zoho.com/us/books/help/contacts/credit-limit.html)
- [Transaction Locking](https://www.zoho.com/us/books/help/accountant/transaction-lock.html)
- [Year-End Closing](https://www.zoho.com/books/academy/financial-management/year-end-accounting.html)

### Greek Tax/Compliance
- [Greece myDATA e-invoicing](https://www.flick.network/en-gr/e-invoicing-in-greece)
- [Greece VAT Filing Requirements](https://www.avalara.com/vatlive/en/country-guides/europe/greece/greek-e-invoices-ebooks-and-mydata.html)
- [Sole Proprietorship in Greece](https://www.deel.com/blog/sole-proprietorship-greece/)
