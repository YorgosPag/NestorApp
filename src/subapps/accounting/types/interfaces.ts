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

import type { PaginatedResult } from '@/lib/pagination';

// ── Phase 1 Types ───────────────────────────────────────────────────────────
import type {
  JournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryFilters,
} from './journal';
import type {
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  InvoiceSeries,
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
} from './tax';
import type {
  EFKAPayment,
  EFKAAnnualSummary,
  EFKAUserConfig,
  EFKAYearConfig,
} from './efka';
import type {
  FixedAsset,
  CreateFixedAssetInput,
  FixedAssetFilters,
  DepreciationRecord,
  DisposalResult,
} from './assets';
import type {
  BankTransaction,
  BankTransactionFilters,
  BankAccountConfig,
  MatchCandidate,
  MatchResult,
  ImportBatch,
  CSVParserConfig,
} from './bank';
import type {
  ReceivedExpenseDocument,
  ExtractedDocumentData,
  DocumentClassification,
  DocumentType,
} from './documents';

// ============================================================================
// ACCOUNTING REPOSITORY — CRUD Operations
// ============================================================================

/**
 * Repository interface για accounting data access
 *
 * Ακολουθεί το ίδιο pattern με ITasksRepository (src/services/crm/tasks/contracts.ts).
 * Οι implementations θα δημιουργηθούν στη Φάση 3 (Firestore adapters).
 */
export interface IAccountingRepository {
  // ── Journal Entries ─────────────────────────────────────────────────────
  createJournalEntry(data: CreateJournalEntryInput): Promise<{ id: string }>;
  getJournalEntry(entryId: string): Promise<JournalEntry | null>;
  updateJournalEntry(entryId: string, updates: UpdateJournalEntryInput): Promise<void>;
  deleteJournalEntry(entryId: string): Promise<void>;
  listJournalEntries(filters: JournalEntryFilters, pageSize?: number): Promise<PaginatedResult<JournalEntry>>;

  // ── Invoices ────────────────────────────────────────────────────────────
  createInvoice(data: CreateInvoiceInput): Promise<{ id: string; number: number }>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  updateInvoice(invoiceId: string, updates: UpdateInvoiceInput): Promise<void>;
  listInvoices(filters: InvoiceFilters, pageSize?: number): Promise<PaginatedResult<Invoice>>;
  getNextInvoiceNumber(seriesCode: string): Promise<number>;
  getInvoiceSeries(): Promise<InvoiceSeries[]>;

  // ── Bank Transactions ───────────────────────────────────────────────────
  createBankTransaction(data: Omit<BankTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }>;
  getBankTransaction(transactionId: string): Promise<BankTransaction | null>;
  updateBankTransaction(transactionId: string, updates: Partial<BankTransaction>): Promise<void>;
  listBankTransactions(filters: BankTransactionFilters, pageSize?: number): Promise<PaginatedResult<BankTransaction>>;
  getBankAccounts(): Promise<BankAccountConfig[]>;
  createImportBatch(data: Omit<ImportBatch, 'batchId'>): Promise<{ id: string }>;

  // ── Fixed Assets ────────────────────────────────────────────────────────
  createFixedAsset(data: CreateFixedAssetInput): Promise<{ id: string }>;
  getFixedAsset(assetId: string): Promise<FixedAsset | null>;
  updateFixedAsset(assetId: string, updates: Partial<FixedAsset>): Promise<void>;
  listFixedAssets(filters: FixedAssetFilters, pageSize?: number): Promise<PaginatedResult<FixedAsset>>;
  createDepreciationRecord(data: Omit<DepreciationRecord, 'recordId'>): Promise<{ id: string }>;
  getDepreciationRecords(assetId: string, fiscalYear?: number): Promise<DepreciationRecord[]>;

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
  /** Υπολογισμός ετήσιας απόσβεσης ενός παγίου */
  calculateAnnualDepreciation(asset: FixedAsset, fiscalYear: number): DepreciationRecord;

  /** Μαζική εκτέλεση αποσβέσεων (τέλος χρήσης) */
  bookDepreciations(fiscalYear: number): Promise<DepreciationRecord[]>;

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

  /** Εφαρμογή αντιστοίχισης */
  matchTransaction(transactionId: string, entityId: string, entityType: MatchResult['matchedEntityType']): Promise<MatchResult>;

  /** Μαζική αυτόματη αντιστοίχιση (batch) */
  matchBatch(transactionIds: string[]): Promise<MatchResult[]>;

  /** Αναίρεση αντιστοίχισης */
  unmatchTransaction(transactionId: string): Promise<void>;
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
