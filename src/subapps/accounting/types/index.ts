/**
 * @fileoverview Accounting Subapp — Types Barrel Export
 * @description Public API για όλους τους τύπους του λογιστικού υποσυστήματος
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 */

// ── Entity Types (ADR-ACC-012 OE, ADR-ACC-014 EPE) ─────────────────────────
export type {
  EntityType,
  Partner,
  PartnerEFKAConfig,
  Member,
  MemberEFKAConfig,
  Shareholder,
  ShareholderEFKAConfig,
  ShareholderEFKAMode,
  BoardRole,
} from './entity';

// ── Company Profile Types (M-001 Company Setup) ────────────────────────────
export type {
  KadEntry,
  CompanyProfile,
  CompanySetupInput,
  SoleProprietorProfile,
  OECompanyProfile,
  EPECompanyProfile,
  AECompanyProfile,
  SoleProprietorSetupInput,
  OESetupInput,
  EPESetupInput,
  AESetupInput,
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
  EmailSendRecord,
  Invoice,
  InvoiceSeries,
  InvoiceFilters,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  ServicePreset,
  ServicePresetsDocument,
  CancellationReasonCode,
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

// ── Tax Types (ADR-ACC-009, ADR-ACC-014 EPE) ───────────────────────────────
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
  CorporateTaxResult,
  MemberDividendResult,
  EPETaxResult,
  ShareholderDividendResult,
  AETaxResult,
} from './tax';

// ── EFKA Types (ADR-ACC-006, ADR-ACC-014 EPE) ──────────────────────────────
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
  ManagerEFKASummary,
  EPEEFKASummary,
  EmployeeBoardMemberEFKA,
  AEEFKASummary,
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
  MatchCandidateGroup,
  MatchResult,
  MatchedEntityRef,
  MatchableEntityType,
  MatchTier,
  ImportBatchStatus,
  ImportBatch,
  BankTransactionFilters,
} from './bank';

// ── Matching Config Types (Phase 2a — SAP/Midday) ──────────────────────────
export type {
  MatchingScoringWeights,
  MatchingThresholds,
  MatchingConfig,
} from './matching-config';
export { DEFAULT_MATCHING_CONFIG } from './matching-config';

// ── Matching Rules Types (Phase 2b — Rule Learning) ─────────────────────────
export type {
  RuleStatus,
  RulePattern,
  RuleTarget,
  LearnedRule,
  CreateLearnedRuleInput,
} from './matching-rules';

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

// ── APY Certificate Types (ADR-ACC-020) ─────────────────────────────────────
export type {
  APYCertificateLineItem,
  APYCertificateProvider,
  APYCertificateCustomer,
  APYEmailSendRecord,
  APYCertificate,
} from './apy-certificate';

// ── Custom Category Types (ADR-ACC-021) ──────────────────────────────────────
export type {
  CustomCategoryCode,
  CustomCategoryDocument,
  CreateCustomCategoryInput,
  UpdateCustomCategoryInput,
} from './custom-category';
export { isCustomCategoryCode } from './custom-category';

// ── Customer Balance Types (Phase 1b — Q1-Q4) ──────────────────────────────
export type {
  AgingBuckets,
  CreditHoldRule,
  RiskClass,
  CustomerBalance,
  CreditCheckResult,
} from './customer-balance';

// ── Fiscal Period Types (Phase 1b — Q5-Q8) ──────────────────────────────────
export type {
  FiscalPeriodStatus,
  FiscalPeriod,
  YearEndChecklistStep,
  YearEndChecklist,
  PostingValidationResult,
} from './fiscal-period';

// ── Audit Trail Types (Phase 1c — Q1-Q3) ────────────────────────────────────
export type {
  AccountingAuditEventType,
  AuditEntityType,
  AccountingAuditEntry,
  AuditEntryFilters,
} from './accounting-audit';

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
