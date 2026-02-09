# Accounting Subapp — ADR Index

Αρχιτεκτονικές αποφάσεις για το λογιστικό υποσύστημα.

**Αρίθμηση**: `ACC-xxx` (ανεξάρτητη, portable — αν αποσπαστεί η εφαρμογή)

---

## ADR Registry

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ACC-000](./ADR-ACC-000-founding-decision.md) | Founding Decision — Enterprise Accounting Subapp | DRAFT | 2026-02-09 |
| [ACC-001](./ADR-ACC-001-chart-of-accounts.md) | Chart of Accounts (ΕΛΠ Λογιστικό Σχέδιο) | DRAFT | 2026-02-09 |
| [ACC-002](./ADR-ACC-002-invoicing-system.md) | Invoicing System (Τιμολόγηση) | DRAFT | 2026-02-09 |
| [ACC-003](./ADR-ACC-003-mydata-aade-integration.md) | myDATA/ΑΑΔΕ Integration | DRAFT | 2026-02-09 |
| [ACC-004](./ADR-ACC-004-vat-engine.md) | VAT Engine (ΦΠΑ) | DRAFT | 2026-02-09 |
| [ACC-005](./ADR-ACC-005-ai-document-processing.md) | AI Document Processing (Expense Tracker) | DRAFT | 2026-02-09 |
| [ACC-006](./ADR-ACC-006-efka-contribution-tracking.md) | EFKA Contribution Tracking | DRAFT | 2026-02-09 |
| [ACC-007](./ADR-ACC-007-fixed-assets-depreciation.md) | Fixed Assets & Depreciation | DRAFT | 2026-02-09 |
| [ACC-008](./ADR-ACC-008-bank-reconciliation.md) | Bank Reconciliation | DRAFT | 2026-02-09 |
| [ACC-009](./ADR-ACC-009-tax-engine.md) | Tax Engine (Income Tax + Prepayment) | DRAFT | 2026-02-09 |
| [ACC-010](./ADR-ACC-010-portability-abstraction-layers.md) | Portability & Abstraction Layers | DRAFT | 2026-02-09 |

---

## Module → ADR Mapping

| Module | ADR | Description |
|--------|-----|-------------|
| M-001: Company Setup | ACC-000 | Covered in founding ADR |
| M-002: Income/Expense Book | ACC-001 | Chart of accounts + journal entries |
| M-003: Invoicing | ACC-002 | Invoice types, series, CRM integration |
| M-004: myDATA | ACC-003 | ΑΑΔΕ API, document types, MARK numbers |
| M-005: VAT Engine | ACC-004 | Quarterly declarations, rates |
| M-006: Expense Tracker | ACC-005 | AI classification + data extraction |
| M-007: EFKA Tracker | ACC-006 | ΤΣΜΕΔΕ/ΤΕΕ contributions |
| M-008: Fixed Assets | ACC-007 | Asset registry, depreciation |
| M-009: Bank Reconciliation | ACC-008 | Account sync, transaction matching |
| M-010: Reports | ACC-004, ACC-009 | VAT reports, tax reports |
