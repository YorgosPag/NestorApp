# Accounting Subapp — ADR Index

Αρχιτεκτονικές αποφάσεις για το λογιστικό υποσύστημα.

**Αρίθμηση**: `ACC-xxx` (ανεξάρτητη, portable — αν αποσπαστεί η εφαρμογή)

---

## ADR Registry

| ADR | Title | Status | Types | Date |
|-----|-------|--------|-------|------|
| [ACC-000](./ADR-ACC-000-founding-decision.md) | Founding Decision — Enterprise Accounting Subapp | DRAFT | — | 2026-02-09 |
| [ACC-001](./ADR-ACC-001-chart-of-accounts.md) | Chart of Accounts (ΕΛΠ Λογιστικό Σχέδιο) | DRAFT | Phase 1+2 | 2026-02-09 |
| [ACC-002](./ADR-ACC-002-invoicing-system.md) | Invoicing System (Τιμολόγηση) | DRAFT | Phase 1+2 | 2026-02-09 |
| [ACC-003](./ADR-ACC-003-mydata-aade-integration.md) | myDATA/ΑΑΔΕ Integration | DRAFT | Phase 1+2 | 2026-02-09 |
| [ACC-004](./ADR-ACC-004-vat-engine.md) | VAT Engine (ΦΠΑ) | DRAFT | Phase 2 | 2026-02-09 |
| [ACC-005](./ADR-ACC-005-ai-document-processing.md) | AI Document Processing (Expense Tracker) | DRAFT | Phase 2 | 2026-02-09 |
| [ACC-006](./ADR-ACC-006-efka-contribution-tracking.md) | EFKA Contribution Tracking | DRAFT | Phase 2 | 2026-02-09 |
| [ACC-007](./ADR-ACC-007-fixed-assets-depreciation.md) | Fixed Assets & Depreciation | DRAFT | Phase 2 | 2026-02-09 |
| [ACC-008](./ADR-ACC-008-bank-reconciliation.md) | Bank Reconciliation | DRAFT | Phase 2 | 2026-02-09 |
| [ACC-009](./ADR-ACC-009-tax-engine.md) | Tax Engine (Income Tax + Prepayment) | DRAFT | Phase 2 | 2026-02-09 |
| [ACC-010](./ADR-ACC-010-portability-abstraction-layers.md) | Portability & Abstraction Layers | DRAFT | Phase 2 | 2026-02-09 |

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

---

## Implementation Progress

### Phase 1: Core Domain Types (2026-02-09) — DONE

| File | Description | ADR |
|------|-------------|-----|
| `types/common.ts` | Shared types: EntryType, IncomeCategory (5), ExpenseCategory (19), MyData codes, PaymentMethod | ACC-001, ACC-003 |
| `types/journal.ts` | JournalEntry, CategoryDefinition, Filters, Create/Update inputs | ACC-001 |
| `types/invoice.ts` | Invoice (full), InvoiceType (7), LineItem, Payment, Issuer/Customer, VatBreakdown, MyDataMeta, Series | ACC-002 |
| `types/index.ts` | Barrel re-export | — |
| `config/account-categories.ts` | 24 CategoryDefinition registry (5 income + 19 expense) | ACC-001 |

### Phase 2: Domain Types + Abstraction Interfaces (2026-02-09) — DONE

| File | Description | ADR |
|------|-------------|-----|
| `types/vat.ts` | VATRate, VATDeductibilityRule, VATCalculation, VATQuarterSummary, VATAnnualSummary | ACC-004 |
| `types/mydata.ts` | MyDataConfig, MyDataSubmission, MyDataVatCategory, ReceivedDocument | ACC-003 |
| `types/tax.ts` | TaxBracket, TaxScaleConfig, TaxResult, TaxEstimate, TaxInstallment, WithholdingReconciliation | ACC-009 |
| `types/efka.ts` | EFKACategoryRate, EFKAYearConfig, EFKAPayment, EFKAAnnualSummary, EFKANotification | ACC-006 |
| `types/assets.ts` | FixedAsset, DepreciationRecord, DisposalResult, DepreciationRateConfig | ACC-007 |
| `types/bank.ts` | BankTransaction, CSVParserConfig, MatchCandidate, MatchResult, ImportBatch | ACC-008 |
| `types/documents.ts` | ExtractedDocumentData, ReceivedExpenseDocument, VendorCategoryLearning, DocumentClassification | ACC-005 |
| `types/interfaces.ts` | IAccountingRepository, IVATEngine, ITaxEngine, IDepreciationEngine, IDocumentAnalyzer, IMatchingEngine, IMyDataService, ICSVImportService, AccountingPermission | ACC-010 |

### Phase 3: Services (Business Logic) (2026-02-09) — DONE

#### Sub-Phase 3A: Pure Calculation Engines + Config

| File | Description | ADR |
|------|-------------|-----|
| `services/config/vat-config.ts` | Greek VAT rates (24/13/6/0%), deductibility rules from ACCOUNT_CATEGORIES, `getVatRateForDate()` | ACC-004 |
| `services/config/tax-config.ts` | Progressive tax scale (9-44%), prepayment 55%, professional tax 650€, `getTaxScaleForYear()` | ACC-009 |
| `services/config/depreciation-config.ts` | 7 asset categories (buildings 4%→computers 20%), `getDepreciationRate()` | ACC-007 |
| `services/config/efka-config.ts` | EFKA year configs 2025/2026, 6 main+3 supp+3 lump categories, `calculateMonthlyBreakdown()` | ACC-006 |
| `services/engines/vat-engine.ts` | `VATEngine implements IVATEngine` — output/input VAT, deductibility, quarter/annual summaries | ACC-004 |
| `services/engines/tax-engine.ts` | `TaxEngine implements ITaxEngine` — progressive bracket calc, installments, projections | ACC-009 |
| `services/engines/depreciation-engine.ts` | `DepreciationEngine implements IDepreciationEngine` — straight-line, pro-rata, disposal, forecast | ACC-007 |

#### Sub-Phase 3B: Firestore Repository + Orchestration

| File | Description | ADR |
|------|-------------|-----|
| EDIT: `firestore-collections.ts` | +9 accounting collections (bank_transactions, fixed_assets, depreciation_records, etc.) | ACC-000 |
| EDIT: `enterprise-id.service.ts` | +8 prefixes & generators (je, inv, btxn, fxa, depr, efka, batch, exdoc) | ACC-000 |
| `services/repository/firestore-helpers.ts` | `sanitizeForFirestore()`, `isoNow()`, `getQuarterFromDate()` | ACC-010 |
| `services/repository/firestore-accounting-repository.ts` | `FirestoreAccountingRepository implements IAccountingRepository` — 26 CRUD methods | ACC-010 |
| `services/accounting-service.ts` | `AccountingService` — orchestrates engines + repository | ACC-000 |
| `services/index.ts` | Factory: `createAccountingServices()` + barrel re-exports | ACC-000 |

#### Sub-Phase 3C: CSV Import + Matching Engine

| File | Description | ADR |
|------|-------------|-----|
| `services/config/csv-parsers/index.ts` | Registry + `getSupportedBanks()` + `getParserConfig()` | ACC-008 |
| `services/config/csv-parsers/nbg.ts` | NBG: windows-1253, tab, DD/MM/YYYY, debit/credit columns | ACC-008 |
| `services/config/csv-parsers/eurobank.ts` | Eurobank: utf-8, semicolon, unified amount column | ACC-008 |
| `services/config/csv-parsers/piraeus.ts` | Piraeus: windows-1253, comma, counterparty column | ACC-008 |
| `services/config/csv-parsers/alpha.ts` | Alpha: utf-8, semicolon, counterparty + reference columns | ACC-008 |
| `services/engines/matching-engine.ts` | `MatchingEngine implements IMatchingEngine` — scoring algorithm, auto-match @85% | ACC-008 |
| `services/external/csv-import-service.ts` | `CSVImportService implements ICSVImportService` — parse + batch import | ACC-008 |

#### Sub-Phase 3D: External API Stubs

| File | Description | ADR |
|------|-------------|-----|
| `services/external/mydata-service.stub.ts` | `MyDataServiceStub implements IMyDataService` — throws "not configured" | ACC-003 |
| `services/external/document-analyzer.stub.ts` | `DocumentAnalyzerStub implements IDocumentAnalyzer` — throws "not configured" | ACC-005 |

### Phase 4+: React Components, Hooks, Pages — PENDING
