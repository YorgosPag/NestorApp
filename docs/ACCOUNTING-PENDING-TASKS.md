# Accounting Subapp — Pending Tasks Analysis

> **Date**: 2026-03-17
> **Scope**: 18 ADRs (ACC-000 to ACC-017) + code verification
> **Method**: ADR review + Grep/Glob source code verification

---

## VERIFIED: Fully Implemented (10 modules + 4 entity extensions)

| Module | ADR | Status |
|--------|-----|--------|
| Company Setup (all entity types) | ACC-000 | Code + UI |
| Journal (24 categories, CRUD, filters) | ACC-001 | Code + UI |
| Invoicing (7 types, line items, VAT, withholding) | ACC-002 | Code + UI |
| VAT Engine (quarterly + annual) | ACC-004 | Code + UI |
| AI Document Processing (OpenAI Vision) | ACC-005 | Code + UI |
| EFKA Tracker (12 categories, dual-mode AE) | ACC-006, ACC-017 | Code + UI |
| Fixed Assets & Depreciation | ACC-007 | Code + UI |
| Bank Reconciliation (4 banks CSV + 85% matching) | ACC-008 | Code + UI |
| Tax Engine & Reports (5-tier brackets) | ACC-009 | Code + UI |
| Service Presets (10 defaults, searchable) | ACC-011 | Code + UI |
| OE Partnership Support | ACC-012 | Code + UI |
| EPE/LLC Support | ACC-014 | Code + UI |
| AE Shareholders | ACC-015 | Code + UI |
| AE Corporate Tax & Dividends (tax logic only) | ACC-016 | Code + UI |

---

## STUB: Waiting for Credentials

### myDATA/AADE Integration (ACC-003)

- **Exists**: `MyDataServiceStub` in `services/external/mydata-service.stub.ts`
- **Exists**: Types in `types/mydata.ts`, interfaces in `types/interfaces.ts`
- **Missing**: Real API calls, XML builder (`fast-xml-parser`), AADE credentials
- **Missing**: Reconciliation UI page (`/accounting/mydata/reconciliation`)
- **Blocker**: AADE Subscription Key + production credentials from Giorgos

---

## NOT IMPLEMENTED

### 1. Invoice PDF Generation (ACC-002) → **ADR-ACC-018 CREATED**

- **ADR**: [`ADR-ACC-018`](../src/subapps/accounting/docs/adrs/ADR-ACC-018-invoice-pdf-generation.md) — Full design document
- **Evidence**: Zero PDF-related code in `src/subapps/accounting/`
- **ADR reference**: ACC-002 specifies PDF template + export
- **Approach**: Client-side jsPDF (reuse existing libs + Roboto font + intl-utils)
- **New files**: 2 (template + exporter), 2 modified (actions menu + details)
- **Zero new npm packages**
- **Priority**: HIGH (daily use)

### 2. Invoice Email Sending (ACC-002)

- **Evidence**: `InvoiceActionsMenu.tsx` has Mail button — **no handler, placeholder only**
- **ADR reference**: ACC-002 specifies email delivery
- **Dependencies**: Mailgun already integrated in project (email pipeline operational)
- **Priority**: HIGH (low effort, Mailgun ready)

### 3. Withholding Tax Certificate / APY (ACC-000 section 7.3)

- **Evidence**: Withholding types exist in `invoice.ts`, calculation in `tax-engine.ts`
- **Missing**: Certificate document generation (PDF/printable)
- **Priority**: MEDIUM (legal requirement)

### 4. TEE e-Amoives Integration (ACC-000 section 7.5)

- **Evidence**: Only ADR references, zero implementation code
- **Description**: Connection to TEE portal, coefficient updates for engineering fees
- **Priority**: LOW (future phase)

### 5. E-Adeies Integration (ACC-000 section 8.6)

- **Evidence**: Only ADR references, zero implementation code
- **Description**: Link building permits to accounting entries
- **Priority**: LOW (future phase)

### 6. Open Banking API / PSD2 (ACC-008 section 3.1)

- **Evidence**: Only ADR references, zero implementation code
- **Current**: CSV import works for 4 banks (NBG, Eurobank, Piraeus, Alpha)
- **Description**: Auto-sync bank transactions instead of manual CSV upload
- **Priority**: LOW (CSV covers current needs)

### 7. Custom Expense Categories (ACC-001 section 10.1)

- **Evidence**: Only ADR references, hardcoded 24 categories in `account-categories.ts`
- **Description**: User-defined expense categories beyond the 24 built-in
- **Priority**: MEDIUM (quick win)

### 8. Dividend Payment UI (ACC-016)

- **Evidence**: Tax calculation exists in `CorporateTaxBreakdown.tsx` and `tax-engine.ts`
- **Missing**: Payment recording UI, distribution workflow, payment history
- **Priority**: MEDIUM (quick win, logic ready)

### 9. Bulk Operations

- **Evidence**: No bulk invoice/entry creation in codebase
- **Description**: Mass invoice creation, batch journal entries
- **Priority**: LOW (future phase)

---

## Recommended Priority Order

| Priority | Feature | Effort | Why |
|----------|---------|--------|-----|
| 1 | Invoice PDF | ~1 week | Core business function |
| 2 | Invoice Email | 3-5 days | Mailgun ready, low effort |
| 3 | APY Certificate | 3-5 days | Legal compliance |
| 4 | myDATA | Blocked | Needs AADE credentials |
| 5 | Custom Categories | 2-3 days | Quick win |
| 6 | Dividend Payment UI | 2-3 days | Quick win, logic ready |
| 7 | TEE Integration | 1 week | Future phase |
| 8 | E-Adeies Integration | 1 week | Future phase |
| 9 | Open Banking PSD2 | 2+ weeks | Future phase |
| 10 | Bulk Operations | 1 week | Future phase |
