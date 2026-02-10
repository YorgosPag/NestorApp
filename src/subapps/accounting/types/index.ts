/**
 * @fileoverview Accounting Subapp — Types Barrel Export
 * @description Public API για όλους τους τύπους του λογιστικού υποσυστήματος
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 */

// ── Entity Types (ADR-ACC-012 OE) ───────────────────────────────────────────
export type {
  EntityType,
  Partner,
  PartnerEFKAConfig,
} from './entity';

// ── Company Profile Types (M-001 Company Setup) ────────────────────────────
export type {
  KadEntry,
  CompanyProfile,
  CompanySetupInput,
  SoleProprietorProfile,
  OECompanyProfile,
} from './company';

// ── Common Types ────────────────────────────────────────────────────────────
export type {
  FiscalQuarter,
  PeriodRange,
  EntryType,
  IncomeCategory,
  ExpenseCategory,
  AccountCategory,
  MyDataIncomeType,
  MyDataExpenseType,
  MyDataDocumentStatus,
  PaymentMethod,
} from './common';

// ── Journal Types ───────────────────────────────────────────────────────────
export type {
  CategoryDefinition,
  JournalEntry,
  JournalEntryFilters,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
} from './journal';

// ── Invoice Types ───────────────────────────────────────────────────────────
export type {
  InvoiceType,
  InvoiceLineItem,
  InvoicePayment,
  InvoiceIssuer,
  InvoiceCustomer,
  VatBreakdown,
  InvoiceMyDataMeta,
  Invoice,
  InvoiceSeries,
  InvoiceFilters,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  ServicePreset,
  ServicePresetsDocument,
} from './invoice';

// ── VAT Types (ADR-ACC-004) ─────────────────────────────────────────────────
export type {
  VATRate,
  VATDeductibilityRule,
  VATCalculation,
  VATInputCalculation,
  VATRateBreakdown,
  VATInputRateBreakdown,
  VATQuarterStatus,
  VATQuarterSummary,
  VATAnnualSummary,
} from './vat';

// ── myDATA Types (ADR-ACC-003) ──────────────────────────────────────────────
export type {
  MyDataEnvironment,
  MyDataConfig,
  MyDataSubmissionAction,
  MyDataResponseStatus,
  MyDataError,
  MyDataSubmission,
  MyDataVatCategory,
  ReceivedDocument,
} from './mydata';

// ── Tax Types (ADR-ACC-009) ─────────────────────────────────────────────────
export type {
  TaxBracket,
  TaxScaleConfig,
  TaxCalculationParams,
  TaxBracketResult,
  TaxResult,
  TaxEstimate,
  TaxInstallmentStatus,
  TaxInstallment,
  TaxInsightPriority,
  TaxPlanningInsight,
  WithholdingReconciliation,
  PartnerTaxResult,
  PartnershipTaxResult,
} from './tax';

// ── EFKA Types (ADR-ACC-006) ────────────────────────────────────────────────
export type {
  EFKACategoryRate,
  EFKAYearConfig,
  EFKAUserConfig,
  EFKAMonthlyBreakdown,
  EFKAPaymentStatus,
  EFKAPayment,
  EFKAAnnualSummary,
  EFKANotificationType,
  EFKANotification,
  PartnerEFKASummary,
  PartnershipEFKASummary,
} from './efka';

// ── Fixed Assets Types (ADR-ACC-007) ────────────────────────────────────────
export type {
  AssetCategory,
  AssetStatus,
  DepreciationRateConfig,
  FixedAsset,
  DepreciationRecord,
  DisposalResult,
  CreateFixedAssetInput,
  FixedAssetFilters,
} from './assets';

// ── Bank Reconciliation Types (ADR-ACC-008) ─────────────────────────────────
export type {
  TransactionDirection,
  MatchStatus,
  BankAccountType,
  BankAccountConfig,
  BankTransaction,
  CSVParserConfig,
  CSVColumnMapping,
  MatchCandidate,
  MatchResult,
  ImportBatchStatus,
  ImportBatch,
  BankTransactionFilters,
} from './bank';

// ── AI Document Processing Types (ADR-ACC-005) ─────────────────────────────
export type {
  DocumentType,
  DocumentProcessingStatus,
  ExtractedLineItem,
  ExtractedDocumentData,
  ReceivedExpenseDocument,
  VendorCategoryLearning,
  QueueItemStatus,
  ExpenseProcessingQueue,
  DocumentClassification,
} from './documents';

// ── Abstraction Interfaces (ADR-ACC-010) ────────────────────────────────────
export type {
  IAccountingRepository,
  IVATEngine,
  ITaxEngine,
  IDepreciationEngine,
  IDocumentAnalyzer,
  IMatchingEngine,
  IMyDataService,
  ICSVImportService,
  AccountingPermission,
} from './interfaces';
