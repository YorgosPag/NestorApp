/**
 * @fileoverview Accounting Subapp — Abstraction Layer Interfaces
 * @description Interfaces για τα accounting services (Repository, Engines, Analyzers)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-010 Abstraction Layer
 * @see Pattern: src/services/crm/tasks/contracts.ts (ITasksRepository)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { Transaction } from 'firebase-admin/firestore';

import type { PageRequest, PaginatedResult } from '@/lib/pagination';

// ── Company Profile Types ────────────────────────────────────────────────────
import type { CompanyProfile, CompanyProfileFieldMask, CompanySetupInput } from './company';
import type { Partner, Member, Shareholder } from './entity';

// ── Phase 1 Types ───────────────────────────────────────────────────────────
import type {
  JournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryFilters,
  JournalLedgerQuery,
} from './journal';
import type {
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  InvoiceSeries,
  ServicePreset,
} from './invoice';

// ── Phase 2 Types ───────────────────────────────────────────────────────────
import type {
  VATCalculation,
  VATInputCalculation,
  VATQuarterSummary,
  VATAnnualSummary,
  VATDeductibilityRule,
} from './vat';
import type { FiscalQuarter, ExpenseCategory, PeriodRange } from './common';
import type { MyDataSubmission, ReceivedDocument, MyDataConfig } from './mydata';
import type {
  TaxScaleConfig,
  TaxCalculationParams,
  TaxResult,
  TaxEstimate,
  TaxInstallment,
  PartnershipTaxResult,
  PartnerTaxInput,
  EPETaxResult,
  AETaxResult,
} from './tax';
import type { EntityType } from './entity';
import type {
  EFKAPayment,
  EFKAUserConfig,
} from './efka';
import type {
  FixedAsset,
  CreateFixedAssetInput,
  FixedAssetFilters,
  FixedAssetLedgerQuery,
  DepreciationRecord,
  DepreciationPostingOutcome,
  DepreciationPostingRequest,
  DepreciationPreview,
  DepreciationRunResult,
  DisposalResult,
} from './assets';
import type {
  BankTransaction,
  BankTransactionFilters,
  BankLedgerQuery,
  AmountBand,
  InvoiceReference,
  BankAccountConfig,
  MatchCandidate,
  MatchCandidateGroup,
  MatchResult,
  MatchedEntityRef,
  ImportBatch,
  CSVParserConfig,
} from './bank';
import type { MatchingConfig } from './matching-config';
import type {
  ReceivedExpenseDocument,
  ExtractedDocumentData,
  DocumentClassification,
  DocumentType,
} from './documents';
import type { APYCertificate, APYEmailSendRecord } from './apy-certificate';
import type {
  CustomCategoryDocument,
  CreateCustomCategoryInput,
  UpdateCustomCategoryInput,
} from './custom-category';
import type { CustomerBalance, InvoiceLedgerQuery } from './customer-balance';
import type { FiscalPeriod, FiscalPeriodDraft, FiscalPeriodTransitionRequest } from './fiscal-period';
import type { AccountingAuditEntry, AuditEntryFilters } from './accounting-audit';

// ============================================================================
// ACCOUNTING REPOSITORY — CRUD Operations
// ============================================================================

/**
 * Επιλογές αποθήκευσης προφίλ (ADR-841 §7 Α23 Φ3.2 Γ3).
 *
 * - `fields` — μάσκα: γράφονται **μόνο** αυτά πάνω στο αποθηκευμένο (`undefined` = πλήρης αντικατάσταση).
 * - `auditOf` — τα ίχνη από το πριν/μετά **της συναλλαγής**, γραμμένα στην **ίδια** συναλλαγή.
 *   ⚠️ Καλείται σε **κάθε** επανάληψη της συναλλαγής: καθαρή συνάρτηση, καμία παρενέργεια.
 */
/**
 * **Σύντροφος της συναλλαγής του προφίλ** (ADR-841 §7 Α23.12) — ό,τι πρέπει να δεσμευτεί **μαζί** με την
 * αλλαγή του προφίλ, ή καθόλου. Δύο φάσεις, επειδή το Firestore απαιτεί **όλες τις αναγνώσεις πριν από κάθε
 * γραφή**: διαβάζει όταν καλείται, και επιστρέφει τον γραφέα — που τρέχει **μόνο** αν το προφίλ άλλαξε.
 */
export type CompanyProfileTransactionCompanion = (
  transaction: Transaction,
) => Promise<(before: CompanyProfile | null, after: CompanyProfile) => void>;

export interface CompanySetupSaveOptions {
  readonly fields?: CompanyProfileFieldMask;
  readonly auditOf?: (before: CompanyProfile | null, after: CompanyProfile) => readonly AccountingAuditEntry[];
  readonly companion?: CompanyProfileTransactionCompanion;
}

/** Ό,τι διάβασε και ό,τι έγραψε η **ίδια** συναλλαγή — οι συνέπειες κρίνονται από εδώ, ποτέ από δεύτερη ανάγνωση. */
export interface CompanySetupSaveResult {
  readonly before: CompanyProfile | null;
  readonly after: CompanyProfile;
}

/**
 * Repository interface για accounting data access
 *
 * Ακολουθεί το ίδιο pattern με ITasksRepository (src/services/crm/tasks/contracts.ts).
 * Οι implementations θα δημιουργηθούν στη Φάση 3 (Firestore adapters).
 */
export interface IAccountingRepository {
  // ── Company Setup (M-001) ─────────────────────────────────────────────
  getCompanySetup(): Promise<CompanyProfile | null>;
  saveCompanySetup(data: CompanySetupInput, options?: CompanySetupSaveOptions): Promise<CompanySetupSaveResult>;

  // ── Journal Entries ─────────────────────────────────────────────────────
  createJournalEntry(data: CreateJournalEntryInput): Promise<{ id: string }>;
  getJournalEntry(entryId: string): Promise<JournalEntry | null>;
  updateJournalEntry(entryId: string, updates: UpdateJournalEntryInput): Promise<void>;
  deleteJournalEntry(entryId: string): Promise<void>;
  /** ΣΕΛΙΔΑ για την οθόνη. ⚠️ ΟΧΙ για υπολογισμούς — βλ. `collectJournalEntries`. */
  listJournalEntries(filters: JournalEntryFilters, page?: PageRequest): Promise<PaginatedResult<JournalEntry>>;
  /** ΟΛΗ η εμβέλεια των φίλτρων της λίστας — για τα σύνολα της οθόνης (κάρτες σύνοψης), όχι η σελίδα. */
  collectJournalEntryList(filters: JournalEntryFilters): Promise<JournalEntry[]>;
  /** «Αναφέρει κάποια εγγραφή την κατηγορία;» — ύπαρξη, όχι σελίδα· πετά σε σφάλμα (ποτέ «όχι» από σφάλμα). */
  hasJournalEntriesInCategory(categoryCode: string): Promise<boolean>;
  /** ΟΛΕΣ οι εγγραφές της εμβέλειας, για υπολογισμό· πετά σε σφάλμα ή υπέρβαση ορίου, ποτέ μερικό. */
  collectJournalEntries(query: JournalLedgerQuery): Promise<JournalEntry[]>;
  getJournalEntryByInvoiceId(invoiceId: string): Promise<JournalEntry | null>;

  // ── Invoices ────────────────────────────────────────────────────────────
  createInvoice(data: CreateInvoiceInput): Promise<{ id: string; number: number }>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  updateInvoice(invoiceId: string, updates: UpdateInvoiceInput): Promise<void>;
  /** ΣΕΛΙΔΑ για την οθόνη. ⚠️ ΟΧΙ για υπολογισμούς — βλ. `collectInvoices` (ADR-ACC-010 §2.1.1). */
  listInvoices(filters: InvoiceFilters, page?: PageRequest): Promise<PaginatedResult<Invoice>>;
  /** ΟΛΗ η εμβέλεια των φίλτρων της λίστας — για τα σύνολα της οθόνης (κάρτες σύνοψης), όχι η σελίδα. */
  collectInvoiceList(filters: InvoiceFilters): Promise<Invoice[]>;
  /** ΟΛΑ τα παραστατικά ως το `asOf` (πελάτη ή εταιρείας), για υπολογισμό απαιτήσεων — πετά, ποτέ μερικό. */
  collectInvoices(query: InvoiceLedgerQuery): Promise<Invoice[]>;
  getNextInvoiceNumber(seriesCode: string): Promise<number>;
  getInvoiceSeries(): Promise<InvoiceSeries[]>;

  // ── Service Presets (ADR-ACC-011) ───────────────────────────────────────
  getServicePresets(): Promise<ServicePreset[]>;
  saveServicePresets(presets: ServicePreset[]): Promise<void>;

  // ── Matching Engine Config (ADR-439 Phase 2c — per-tenant) ───────────────
  getMatchingConfig(): Promise<MatchingConfig | null>;
  saveMatchingConfig(config: MatchingConfig): Promise<void>;

  // ── Bank Transactions ───────────────────────────────────────────────────
  createBankTransaction(data: Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }>;
  getBankTransaction(transactionId: string): Promise<BankTransaction | null>;
  updateBankTransaction(transactionId: string, updates: Partial<BankTransaction>): Promise<void>;
  /** ΣΕΛΙΔΑ για την οθόνη. ⚠️ ΟΧΙ για υπολογισμούς (ADR-ACC-010 §2.1.1). */
  listBankTransactions(filters: BankTransactionFilters, page?: PageRequest): Promise<PaginatedResult<BankTransaction>>;
  /** ΟΛΗ η εμβέλεια των φίλτρων της λίστας — για τα σύνολα της οθόνης (κάρτες σύνοψης), όχι η σελίδα. */
  collectBankTransactionList(filters: BankTransactionFilters): Promise<BankTransaction[]>;
  /** ΟΛΕΣ οι κινήσεις μιας εμβέλειας, για υπολογισμό — πετά, ποτέ μερικό (§2.1.1). */
  collectBankTransactions(query: BankLedgerQuery): Promise<BankTransaction[]>;

  // ── Υποψήφια αντιστοίχισης — στένεμα στη βάση, όχι σελίδα (§2.1.1, Φάση 2) ─────────
  /** Ανοιχτά τιμολόγια με ανοιχτό ποσό μέσα στη ζώνη — πλήρως, ή σφάλμα. */
  collectOpenInvoicesByAmount(band: AmountBand): Promise<Invoice[]>;
  /** Ανοιχτά τιμολόγια που αναγράφονται ρητά (σειρά + αριθμός), ανεξαρτήτως ποσού. */
  findOpenInvoicesByReference(references: readonly InvoiceReference[]): Promise<Invoice[]>;
  /** Ενεργές εγγραφές της χρήσης με μικτό ποσό μέσα στη ζώνη — πλήρως, ή σφάλμα. */
  collectActiveJournalEntriesByAmount(fiscalYear: number, band: AmountBand): Promise<JournalEntry[]>;
  getBankAccounts(): Promise<BankAccountConfig[]>;
  createImportBatch(data: Omit<ImportBatch, 'batchId'>): Promise<{ id: string }>;

  // ── Fixed Assets ────────────────────────────────────────────────────────
  createFixedAsset(data: CreateFixedAssetInput): Promise<{ id: string }>;
  getFixedAsset(assetId: string): Promise<FixedAsset | null>;
  updateFixedAsset(assetId: string, updates: Partial<FixedAsset>): Promise<void>;
  /** ΣΕΛΙΔΑ για την οθόνη. ⚠️ ΟΧΙ για υπολογισμούς (ADR-ACC-010 §2.1.1). */
  listFixedAssets(filters: FixedAssetFilters, page?: PageRequest): Promise<PaginatedResult<FixedAsset>>;
  /** ΟΛΗ η εμβέλεια των φίλτρων της λίστας — για τα σύνολα της οθόνης (κάρτες σύνοψης), όχι η σελίδα. */
  collectFixedAssetList(filters: FixedAssetFilters): Promise<FixedAsset[]>;
  /** ΟΛΑ τα πάγια μιας εμβέλειας, για υπολογισμό αποσβέσεων — πετά, ποτέ μερικό (§2.1.1 Φάση 4). */
  collectFixedAssets(query: FixedAssetLedgerQuery): Promise<FixedAsset[]>;
  /**
   * Ο ΕΝΑΣ γραφέας απόσβεσης: εγγραφή (πάγιο, χρήση) + εγγραφή Ε-Ε της διαφοράς + προβολή παγίου + ίχνος, ατομικά·
   * ιδεμπότητος από ντετερμινιστικά id (§2.1.1 Φάσεις 4–5). Το `decide` τρέχει μέσα στη συναλλαγή, στα φρέσκα έγγραφα.
   */
  postDepreciation(request: DepreciationPostingRequest): Promise<DepreciationPostingOutcome>;
  /** Οι εγγραφές απόσβεσης μιας χρήσης για τα δοσμένα πάγια (κλειδί: assetId) — με ταυτότητα, πετά σε σφάλμα. */
  readDepreciationRecords(fiscalYear: number, assetIds: readonly string[]): Promise<Map<string, DepreciationRecord>>;
  getDepreciationRecords(assetId: string, fiscalYear?: number): Promise<DepreciationRecord[]>;

  // ── Partners (ADR-ACC-012 OE) — arrays read from profile SSoT (ADR-440) ──
  getPartners(): Promise<Partner[]>;
  getPartnerEFKAPayments(partnerId: string, year: number): Promise<EFKAPayment[]>;

  // ── Members (ADR-ACC-014 EPE) — arrays read from profile SSoT (ADR-440) ──
  getMembers(): Promise<Member[]>;
  getMemberEFKAPayments(memberId: string, year: number): Promise<EFKAPayment[]>;

  // ── Shareholders (ADR-ACC-015 AE) — arrays read from profile SSoT (ADR-440) ──
  getShareholders(): Promise<Shareholder[]>;
  getShareholderEFKAPayments(shareholderId: string, year: number): Promise<EFKAPayment[]>;

  // ── EFKA Payments ───────────────────────────────────────────────────────
  getEFKAPayments(year: number): Promise<EFKAPayment[]>;
  updateEFKAPayment(paymentId: string, updates: Partial<EFKAPayment>): Promise<void>;
  getEFKAUserConfig(): Promise<EFKAUserConfig | null>;
  saveEFKAUserConfig(config: EFKAUserConfig): Promise<void>;

  // ── Tax ─────────────────────────────────────────────────────────────────
  getTaxInstallments(fiscalYear: number): Promise<TaxInstallment[]>;
  updateTaxInstallment(installmentNumber: number, fiscalYear: number, updates: Partial<TaxInstallment>): Promise<void>;

  // ── Expense Documents ───────────────────────────────────────────────────
  createExpenseDocument(data: Omit<ReceivedExpenseDocument, 'documentId' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }>;
  getExpenseDocument(documentId: string): Promise<ReceivedExpenseDocument | null>;
  updateExpenseDocument(documentId: string, updates: Partial<ReceivedExpenseDocument>): Promise<void>;
  listExpenseDocuments(fiscalYear: number, status?: ReceivedExpenseDocument['status']): Promise<ReceivedExpenseDocument[]>;

  // ── APY Certificates (ADR-ACC-020) ──────────────────────────────────────
  createAPYCertificate(data: Omit<APYCertificate, 'certificateId' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }>;
  getAPYCertificate(certificateId: string): Promise<APYCertificate | null>;
  listAPYCertificates(fiscalYear?: number, customerId?: string): Promise<APYCertificate[]>;
  updateAPYCertificate(certificateId: string, updates: Partial<Omit<APYCertificate, 'certificateId' | 'createdAt'>>): Promise<void>;
  pushAPYEmailRecord(certificateId: string, record: APYEmailSendRecord): Promise<void>;

  // ── Custom Categories (ADR-ACC-021) ─────────────────────────────────────
  createCustomCategory(data: CreateCustomCategoryInput): Promise<{ id: string; code: string }>;
  getCustomCategory(categoryId: string): Promise<CustomCategoryDocument | null>;
  listCustomCategories(includeInactive?: boolean): Promise<CustomCategoryDocument[]>;
  updateCustomCategory(categoryId: string, updates: UpdateCustomCategoryInput): Promise<void>;
  deleteCustomCategory(categoryId: string): Promise<void>;

  // ── Customer Balances (Phase 1b — Q1-Q4) ────────────────────────────────
  getCustomerBalance(customerId: string): Promise<CustomerBalance | null>;
  upsertCustomerBalance(customerId: string, balance: CustomerBalance): Promise<void>;
  listCustomerBalances(): Promise<CustomerBalance[]>;

  // ── Fiscal Periods (Phase 1b — Q5-Q8) ───────────────────────────────────
  // ΑΝΑ ΜΙΣΘΩΤΗ (ADR-ACC-010 §2.1.1 Φ6): `periodId` = κλειδί `YYYY-MM` μέσα στον μισθωτή, όχι id εγγράφου.
  getFiscalPeriod(periodId: string): Promise<FiscalPeriod | null>;
  listFiscalPeriods(fiscalYear: number): Promise<FiscalPeriod[]>;
  /** Μετάβαση κατάστασης — απόφαση + εγγραφή + ίχνος `PERIOD_*` σε ΜΙΑ συναλλαγή. */
  transitionFiscalPeriod(periodId: string, request: FiscalPeriodTransitionRequest): Promise<FiscalPeriod>;
  /** Όλες ή καμία — υπάρχουσα χρήση ⇒ `FiscalYearExistsError`, ποτέ αντικατάσταση. */
  createFiscalPeriods(fiscalYear: number, periods: readonly FiscalPeriodDraft[]): Promise<void>;

  // ── Audit Log (Phase 1c — Q1-Q3, immutable: create + list ONLY) ────────
  createAuditEntry(entry: AccountingAuditEntry): Promise<void>;
  listAuditEntries(filters: AuditEntryFilters, limit?: number): Promise<AccountingAuditEntry[]>;
}

// ============================================================================
// VAT ENGINE — Υπολογισμός ΦΠΑ
// ============================================================================

/**
 * Interface για τον VAT Engine
 *
 * Υπολογισμοί ΦΠΑ εκροών/εισροών + τριμηνιαίες/ετήσιες συνόψεις.
 */
export interface IVATEngine {
  /** Υπολογισμός ΦΠΑ εκροών (σε τιμολόγιο) */
  calculateOutputVat(netAmount: number, vatRate: number): VATCalculation;

  /** Υπολογισμός ΦΠΑ εισροών (σε δαπάνη) με εκπτωσιμότητα */
  calculateInputVat(netAmount: number, vatRate: number, category: ExpenseCategory): VATInputCalculation;

  /** Ποσοστό εκπτωσιμότητας ΦΠΑ ανά κατηγορία */
  getDeductibilityRule(category: ExpenseCategory): VATDeductibilityRule;

  /** Τριμηνιαία σύνοψη ΦΠΑ */
  calculateQuarterSummary(fiscalYear: number, quarter: FiscalQuarter): Promise<VATQuarterSummary>;

  /** Ετήσια σύνοψη ΦΠΑ */
  calculateAnnualSummary(fiscalYear: number): Promise<VATAnnualSummary>;
}

// ============================================================================
// TAX ENGINE — Υπολογισμός Φόρου Εισοδήματος
// ============================================================================

/**
 * Interface για τον Tax Engine
 *
 * Υπολογισμοί ετήσιου φόρου + real-time projections.
 */
export interface ITaxEngine {
  /** Υπολογισμός ετήσιου φόρου εισοδήματος */
  calculateAnnualTax(params: TaxCalculationParams): TaxResult;

  /** Real-time πρόβλεψη φόρου (βάσει τρεχόντων δεδομένων) */
  estimateTax(fiscalYear: number, upToDate?: string): Promise<TaxEstimate>;

  /** Λήψη φορολογικής κλίμακας για ένα έτος */
  getTaxScale(year: number): TaxScaleConfig;

  /** Υπολογισμός δόσεων φόρου */
  calculateInstallments(totalAmount: number, fiscalYear: number): TaxInstallment[];

  /** Υπολογισμός φόρου ΟΕ (pass-through ανά εταίρο) */
  calculatePartnershipTax(
    fiscalYear: number,
    totalIncome: number,
    totalExpenses: number,
    totalEfkaByPartner: Map<string, number>,
    partners: readonly PartnerTaxInput[]
  ): PartnershipTaxResult;

  /** Υπολογισμός εταιρικού φόρου ΕΠΕ (22% flat + μερίσματα 5%) */
  calculateCorporateTax(
    fiscalYear: number,
    totalIncome: number,
    totalExpenses: number,
    efkaManagerTotal: number,
    members: Array<{
      memberId: string;
      memberName: string;
      dividendSharePercent: number;
    }>,
    distributionPercent?: number,
    entityType?: EntityType
  ): EPETaxResult;

  /** Υπολογισμός εταιρικού φόρου ΑΕ (22% flat + μερίσματα 5%) */
  calculateAETax(
    fiscalYear: number,
    totalIncome: number,
    totalExpenses: number,
    efkaBoardTotal: number,
    shareholders: Array<{
      shareholderId: string;
      shareholderName: string;
      dividendSharePercent: number;
    }>,
    distributionPercent?: number
  ): AETaxResult;
}

// ============================================================================
// DEPRECIATION ENGINE — Αποσβέσεις
// ============================================================================

/**
 * Interface για τον Depreciation Engine
 *
 * Υπολογισμοί ετήσιων αποσβέσεων + εκποιήσεις.
 */
export interface IDepreciationEngine {
  /** Υπολογισμός ετήσιας απόσβεσης ενός παγίου — από τον πίνακα αποσβέσεων (στοιχεία του παγίου, όχι μεταβλητά πεδία) */
  calculateAnnualDepreciation(asset: FixedAsset, fiscalYear: number): DepreciationRecord;

  /** Προεπισκόπηση της εκτέλεσης (SAP test run) — σωστό / καταχωρημένο / διαφορά ανά πάγιο, ΚΑΜΙΑ εγγραφή. */
  previewDepreciations(fiscalYear: number): Promise<DepreciationPreview>;

  /**
   * Εκτέλεση αποσβέσεων χρήσης που ΕΧΕΙ ΛΗΞΕΙ — όλα τα πάγια (πλήρης σάρωση)· το καταχωρημένο συγκλίνει στο σωστό
   * (πρώτη φορά = όλο, μετά = μόνο η διαφορά) και φτάνει στο Βιβλίο Ε-Ε (ADR-ACC-010 §2.1.1 Φάσεις 4–5).
   */
  bookDepreciations(fiscalYear: number): Promise<DepreciationRunResult>;

  /** Αναίρεση της χρήσης (Xero rollback): το καταχωρημένο συγκλίνει στο 0 με αντιλογισμό — μόνο νεότερη χρήση/πάγιο. */
  reverseDepreciations(fiscalYear: number): Promise<DepreciationRunResult>;

  /** Υπολογισμός αποτελέσματος εκποίησης */
  calculateDisposal(asset: FixedAsset, salePrice: number, disposalDate: string): DisposalResult;

  /** Πρόβλεψη μελλοντικών αποσβέσεων (1-5 χρόνια) */
  forecastDepreciations(asset: FixedAsset, years: number): DepreciationRecord[];
}

// ============================================================================
// DOCUMENT ANALYZER — AI Ανάλυση Εγγράφων
// ============================================================================

/**
 * Interface για τον AI Document Analyzer
 *
 * OCR + NLP εξαγωγή δεδομένων + ταξινόμηση.
 */
export interface IDocumentAnalyzer {
  /** Ταξινόμηση εγγράφου (τύπος + κατηγορία) */
  classifyDocument(fileUrl: string, mimeType: string): Promise<DocumentClassification>;

  /** Εξαγωγή δεδομένων μέσω AI (OCR/NLP) */
  extractData(fileUrl: string, documentType: DocumentType): Promise<ExtractedDocumentData>;

  /** Αυτόματη κατηγοριοποίηση δαπάνης βάσει vendor learning */
  categorizeExpense(issuerVatNumber: string, description: string): Promise<ExpenseCategory | null>;
}

// ============================================================================
// MATCHING ENGINE — Αντιστοίχιση Τραπεζικών Κινήσεων
// ============================================================================

/**
 * Interface για τον Bank Matching Engine
 *
 * Αυτόματη αντιστοίχιση τραπεζικών κινήσεων ↔ εγγραφές.
 */
export interface IMatchingEngine {
  /** Εύρεση υποψήφιων αντιστοιχίσεων για μία συναλλαγή */
  findCandidates(transaction: BankTransaction): Promise<MatchCandidate[]>;

  /** Εφαρμογή αντιστοίχισης (1:1) */
  matchTransaction(transactionId: string, entityId: string, entityType: MatchResult['matchedEntityType']): Promise<MatchResult>;

  /** Μαζική αντιστοίχιση (batch) — 1st pass: 1:1, 2nd pass: N:M grouping */
  matchBatch(transactionIds: string[]): Promise<MatchResult[]>;

  /** Αναίρεση αντιστοίχισης (1:1) */
  unmatchTransaction(transactionId: string): Promise<void>;

  /** Εύρεση N:M candidate groups για πολλαπλές συναλλαγές */
  findCandidateGroups(transactions: BankTransaction[]): Promise<MatchCandidateGroup[]>;

  /** Αντιστοίχιση N:M group: πολλές συναλλαγές ↔ πολλές εγγραφές */
  matchGroup(transactionIds: string[], entityRefs: MatchedEntityRef[]): Promise<MatchResult[]>;

  /** Αναίρεση ολόκληρου N:M group */
  unmatchGroup(matchGroupId: string): Promise<void>;

  /** Φόρτωση config (Firestore override ή defaults) */
  getConfig(): Promise<MatchingConfig>;
}

// ============================================================================
// MYDATA SERVICE — myDATA/ΑΑΔΕ Integration
// ============================================================================

/**
 * Interface για τη διασύνδεση με myDATA
 *
 * Υποβολή, ακύρωση, χαρακτηρισμός παραστατικών.
 */
export interface IMyDataService {
  /** Υποβολή τιμολογίου στο myDATA */
  submitInvoice(invoiceId: string): Promise<MyDataSubmission>;

  /** Ακύρωση τιμολογίου στο myDATA */
  cancelInvoice(invoiceId: string, mark: string): Promise<MyDataSubmission>;

  /** Χαρακτηρισμός εισερχόμενου παραστατικού */
  classifyReceivedDocument(mark: string, classification: ExpenseCategory): Promise<MyDataSubmission>;

  /** Λήψη εισερχόμενων παραστατικών */
  fetchReceivedDocuments(dateRange: PeriodRange): Promise<ReceivedDocument[]>;

  /** Λήψη ρυθμίσεων myDATA */
  getConfig(): Promise<MyDataConfig>;
}

// ============================================================================
// CSV IMPORT SERVICE — Εισαγωγή Τραπεζικών CSV
// ============================================================================

/**
 * Interface για εισαγωγή τραπεζικών CSV
 */
export interface ICSVImportService {
  /** Λήψη υποστηριζόμενων bank parsers */
  getSupportedBanks(): CSVParserConfig[];

  /** Parsing CSV αρχείου σε τραπεζικές κινήσεις */
  parseCSV(fileContent: string, bankCode: string): Promise<Array<Omit<BankTransaction, 'transactionId' | 'matchStatus' | 'matchedEntityId' | 'matchedEntityType' | 'matchConfidence' | 'importBatchId' | 'notes' | 'createdAt' | 'updatedAt'>>>;

  /** Εισαγωγή parsed κινήσεων στη βάση */
  importTransactions(transactions: Array<Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>>, accountId: string): Promise<ImportBatch>;
}

// ============================================================================
// ACCOUNTING PERMISSION — RBAC
// ============================================================================

/**
 * Δικαιώματα πρόσβασης accounting module
 *
 * Χρησιμοποιείται για role-based access control.
 */
export type AccountingPermission =
  | 'accounting:view'              // Ανάγνωση δεδομένων
  | 'accounting:journal:create'    // Δημιουργία εγγραφών Ε-Ε
  | 'accounting:journal:edit'      // Επεξεργασία εγγραφών Ε-Ε
  | 'accounting:journal:delete'    // Διαγραφή εγγραφών Ε-Ε
  | 'accounting:invoice:create'    // Δημιουργία τιμολογίων
  | 'accounting:invoice:edit'      // Επεξεργασία τιμολογίων
  | 'accounting:invoice:submit'    // Υποβολή στο myDATA
  | 'accounting:bank:import'       // Εισαγωγή bank CSV
  | 'accounting:bank:match'        // Αντιστοίχιση κινήσεων
  | 'accounting:assets:manage'     // Διαχείριση παγίων
  | 'accounting:documents:upload'  // Ανέβασμα παραστατικών
  | 'accounting:documents:confirm' // Επιβεβαίωση AI extractions
  | 'accounting:tax:view'          // Προβολή φορολογικών
  | 'accounting:reports:export'    // Εξαγωγή αναφορών
  | 'accounting:admin';            // Πλήρης διαχείριση
