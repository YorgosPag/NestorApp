/**
 * @fileoverview Accounting Subapp — Bank Reconciliation Types
 * @description Τύποι για τραπεζική συμφωνία (bank reconciliation)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CurrencyCode } from '@/types/contacts/banking';
import type { PeriodRange } from './common';

// ============================================================================
// TRANSACTION DIRECTION & MATCH STATUS
// ============================================================================

/** Κατευθύνσεις συναλλαγής — ρίζα του λεξιλογίου. */
export const TRANSACTION_DIRECTIONS = ['credit', 'debit'] as const;

/** Κατεύθυνση συναλλαγής */
export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number];

/**
 * Κατάσταση αντιστοίχισης
 *
 * - `unmatched`: Δεν αντιστοιχίστηκε σε καμία εγγραφή
 * - `auto_matched`: Αυτόματη αντιστοίχιση (βάσει ποσού + ημερομηνίας)
 * - `manual_matched`: Χειροκίνητη αντιστοίχιση
 * - `excluded`: Εξαιρέθηκε (π.χ. μεταφορά μεταξύ λογαριασμών)
 */
export const MATCH_STATUSES = ['unmatched', 'auto_matched', 'manual_matched', 'excluded', 'reconciled'] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

// ============================================================================
// BANK ACCOUNT CONFIG
// ============================================================================

/** Τύπος τραπεζικού λογαριασμού — παράγεται από τη ρίζα {@link BANK_ACCOUNT_TYPES}. */
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

/** Τύποι λογαριασμού — ρίζα του λεξιλογίου (ADR-ACC-008 §2). */
export const BANK_ACCOUNT_TYPES = ['checking', 'savings', 'business'] as const;

/**
 * Τραπεζικός λογαριασμός **της εταιρείας** — ΕΝΑ μητρώο για τη συμφωνία τράπεζας (ADR-ACC-008) **και** για τις
 * οδηγίες πληρωμής των τιμολογίων (ADR-ACC-018 §15). Οι λογαριασμοί **τρίτων** ζουν στις επαφές
 * (`contacts/{id}/bankAccounts`) — άλλο πράγμα.
 *
 * Firestore path: `accounting_bank_accounts/{accountId}` · γραφέας: ΜΟΝΟ ο διακομιστής (`/api/accounting/bank-accounts`).
 * Δεν διαγράφεται ποτέ (οι κινήσεις κρατούν `accountId`): απενεργοποίηση.
 */
export interface BankAccountConfig {
  /** Μοναδικό ID (`bacc_…`, enterprise-id) */
  accountId: string;
  /** Τράπεζα (π.χ. 'Εθνική Τράπεζα') */
  bankName: string;
  /** IBAN (χωρίς κενά) — EN 16931 BT-84 */
  iban: string;
  /** Ετικέτα εμφάνισης (π.χ. 'Κύριος Λογ/μός') — εσωτερική, δεν τυπώνεται */
  label: string;
  /** Τύπος λογαριασμού */
  type: BankAccountType;
  /** Νόμισμα */
  currency: CurrencyCode;
  /** Ενεργός; */
  isActive: boolean;
  /** Κωδικός τράπεζας (SWIFT/BIC, ISO 9362) — EN 16931 BT-86 */
  bankCode: string | null;
  /**
   * Δικαιούχος — η επωνυμία **όπως είναι γνωστή στην τράπεζα** (EN 16931 BT-85, EPC QR «Name»).
   * Απούσα σε έγγραφα πριν από 2026-11-10 ⇒ ο καταναλωτής πέφτει στην επωνυμία του εκδότη.
   */
  holderName?: string | null;
  /** Εμφανίζεται στις οδηγίες πληρωμής των τιμολογίων; (απούσα = όχι) */
  showOnInvoices?: boolean;
  /** Ο ΕΝΑΣ προεπιλεγμένος για τιμολόγια (πρώτος στον πίνακα, αυτός μπαίνει στο QR) — τον επιβάλλει ο γραφέας */
  isDefaultForInvoices?: boolean;
  /** Σειρά εμφάνισης (αύξουσα) */
  sortOrder?: number;
  /** Σημειώσεις */
  notes: string | null;
  /** Tenant isolation — απαιτείται από τους κανόνες Firestore */
  companyId?: string;
  /** Δημιουργός — απαιτείται από τους κανόνες Firestore */
  createdBy?: string;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας αλλαγής (ISO 8601) */
  updatedAt?: string;
}

/** Ό,τι δίνει ο χρήστης για νέο λογαριασμό — ταυτότητα, μισθωτής, χρόνοι: του διακομιστή. */
export interface CreateBankAccountInput {
  bankName: string;
  iban: string;
  bankCode: string | null;
  holderName: string;
  label: string;
  type: BankAccountType;
  currency: CurrencyCode;
  showOnInvoices: boolean;
  isDefaultForInvoices: boolean;
  notes: string | null;
}

/** Μερική αλλαγή — το IBAN αλλάζει μόνο μέσω νέου λογαριασμού (ίχνος + κινήσεις δεμένες στο παλιό). */
export type UpdateBankAccountInput = Partial<Omit<CreateBankAccountInput, 'iban' | 'currency'>> & {
  sortOrder?: number;
};

// ============================================================================
// BANK TRANSACTION
// ============================================================================

/**
 * Τραπεζική συναλλαγή (εισαγόμενη από CSV/API)
 *
 * Firestore path: `accounting_bank_transactions/{transactionId}`
 */
export interface BankTransaction {
  /** Μοναδικό ID (Firestore doc ID) */
  transactionId: string;
  /** Αναφορά σε τραπεζικό λογαριασμό */
  accountId: string;
  /** Ημερομηνία αξίας (value date, ISO 8601) */
  valueDate: string;
  /** Ημερομηνία εκτέλεσης (ISO 8601) */
  transactionDate: string;
  /** Κατεύθυνση */
  direction: TransactionDirection;
  /** Ποσό (πάντα θετικό) */
  amount: number;
  /** Νόμισμα */
  currency: CurrencyCode;
  /** Υπόλοιπο μετά τη συναλλαγή */
  balanceAfter: number | null;
  /** Περιγραφή από τράπεζα */
  bankDescription: string;
  /** Αντισυμβαλλόμενος (IBAN ή όνομα) */
  counterparty: string | null;
  /** Αιτιολογία πληρωμής */
  paymentReference: string | null;

  // — Αντιστοίχιση —
  /** Κατάσταση αντιστοίχισης */
  matchStatus: MatchStatus;
  /** ID αντιστοιχισμένης εγγραφής (invoice, journal entry, EFKA κ.λπ.) */
  matchedEntityId: string | null;
  /** Τύπος αντιστοιχισμένης εγγραφής */
  matchedEntityType: MatchableEntityType | null;
  /** Βαθμός εμπιστοσύνης αντιστοίχισης (0-100, null αν χειροκίνητη) */
  matchConfidence: number | null;

  // — N:M Matching (Phase 2a) —
  /** Group ID for N:M matches (null for 1:1 or unmatched) */
  matchGroupId?: string | null;
  /** All matched entity references (for N:M; single-element for 1:1) */
  matchedEntities?: MatchedEntityRef[] | null;

  // — Reconciliation (Phase 1c — Q1, Q7, Q8) —
  /** Optimistic locking version (incremented on every write) */
  version?: number;
  /** Display name of user who last matched */
  matchedByName?: string | null;
  /** User ID who reconciled */
  reconciledBy?: string | null;
  /** ISO 8601 timestamp of reconciliation */
  reconciledAt?: string | null;
  /** Display name of user who reconciled */
  reconciledByName?: string | null;

  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;
  /** User who created this document */
  createdBy?: string;

  // — Metadata —
  /** ID batch εισαγωγής */
  importBatchId: string;
  /** Σημειώσεις χρήστη */
  notes: string | null;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// CSV PARSER CONFIG
// ============================================================================

/**
 * Ρυθμίσεις CSV parser ανά τράπεζα
 *
 * Κάθε ελληνική τράπεζα εξάγει CSV με διαφορετική δομή.
 * Αυτό το config ορίζει τη στήλη για κάθε πεδίο.
 */
export interface CSVParserConfig {
  /** Κωδικός τράπεζας */
  bankCode: string;
  /** Όνομα τράπεζας */
  bankName: string;
  /** Encoding αρχείου (π.χ. 'utf-8', 'windows-1253') */
  encoding: string;
  /** Separator (π.χ. ',', ';', '\t') */
  delimiter: string;
  /** Παράβλεψη πρώτων γραμμών (headers) */
  skipRows: number;
  /** Μορφή ημερομηνίας (π.χ. 'DD/MM/YYYY', 'YYYY-MM-DD') */
  dateFormat: string;
  /** Μορφή δεκαδικών (π.χ. ',' ή '.') */
  decimalSeparator: string;
  /** Αντιστοίχιση στηλών (column index → field name) */
  columnMapping: CSVColumnMapping;
}

/** Αντιστοίχιση στηλών CSV → πεδία BankTransaction */
export interface CSVColumnMapping {
  /** Στήλη ημερομηνίας αξίας */
  valueDate: number;
  /** Στήλη ημερομηνίας εκτέλεσης (null αν δεν υπάρχει) */
  transactionDate: number | null;
  /** Στήλη περιγραφής */
  description: number;
  /** Στήλη ποσού (ενιαία, θετικό=credit, αρνητικό=debit) */
  amount: number | null;
  /** Στήλη χρέωσης (debit, null αν ενιαίο amount) */
  debitAmount: number | null;
  /** Στήλη πίστωσης (credit, null αν ενιαίο amount) */
  creditAmount: number | null;
  /** Στήλη υπολοίπου (null αν δεν υπάρχει) */
  balance: number | null;
  /** Στήλη αντισυμβαλλομένου (null αν δεν υπάρχει) */
  counterparty: number | null;
  /** Στήλη αιτιολογίας (null αν δεν υπάρχει) */
  reference: number | null;
}

// ============================================================================
// MATCH CANDIDATE & RESULT
// ============================================================================

/**
 * Υποψήφια αντιστοίχιση για τραπεζική συναλλαγή
 *
 * Ο matching engine παράγει μία λίστα υποψηφίων,
 * ταξινομημένη κατά βαθμό εμπιστοσύνης.
 */
export interface MatchCandidate {
  /** ID εγγραφής (invoice, journal, EFKA κ.λπ.) */
  entityId: string;
  /** Τύπος εγγραφής */
  entityType: MatchableEntityType;
  /** Περιγραφή (για εμφάνιση) */
  displayLabel: string;
  /** Ποσό εγγραφής */
  amount: number;
  /** Ημερομηνία εγγραφής */
  date: string;
  /** Βαθμός εμπιστοσύνης (0-100) */
  confidence: number;
  /** Λόγοι αντιστοίχισης (π.χ. 'Ίδιο ποσό', 'Κοντινή ημερομηνία') */
  matchReasons: string[];
  /** Tier classification based on confidence thresholds */
  tier: MatchTier;
}

/**
 * Αποτέλεσμα αντιστοίχισης
 *
 * Επιστρέφεται μετά την εφαρμογή αντιστοίχισης.
 */
export interface MatchResult {
  /** ID τραπεζικής συναλλαγής */
  transactionId: string;
  /** Κατάσταση αντιστοίχισης */
  status: MatchStatus;
  /** ID αντιστοιχισμένης εγγραφής (null αν excluded/unmatched) */
  matchedEntityId: string | null;
  /** Τύπος αντιστοιχισμένης εγγραφής */
  matchedEntityType: MatchableEntityType | null;
  /** Βαθμός εμπιστοσύνης */
  confidence: number | null;
  /** Group ID for N:M matches */
  matchGroupId?: string | null;
  /** All transaction IDs in this match group (N:M) */
  transactionIds?: string[];
  /** All matched entities in this group (N:M) */
  matchedEntities?: MatchedEntityRef[];
}

// ============================================================================
// IMPORT BATCH
// ============================================================================

/** Κατάσταση batch εισαγωγής */
export type ImportBatchStatus = 'processing' | 'completed' | 'failed';

/**
 * Metadata batch εισαγωγής τραπεζικών κινήσεων
 *
 * Firestore path: `accounting_import_batches/{batchId}`
 */
export interface ImportBatch {
  /** Μοναδικό ID */
  batchId: string;
  /** Αναφορά σε τραπεζικό λογαριασμό */
  accountId: string;
  /** Όνομα αρχείου */
  fileName: string;
  /** Κατάσταση */
  status: ImportBatchStatus;
  /** Πλήθος γραμμών στο αρχείο */
  totalRows: number;
  /** Πλήθος επιτυχώς εισαχθεισών */
  importedCount: number;
  /** Πλήθος αποτυχημένων/διπλότυπων */
  skippedCount: number;
  /** Σφάλματα (αν υπάρχουν) */
  errors: string[];

  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;
  /** User who created this document */
  createdBy?: string;

  /** Ημερομηνία εισαγωγής (ISO 8601) */
  importedAt: string;
}

// ============================================================================
// FILTERS
// ============================================================================

/** Φίλτρα αναζήτησης τραπεζικών συναλλαγών */
export interface BankTransactionFilters {
  /** Τραπεζικός λογαριασμός */
  accountId?: string;
  /** Κατεύθυνση */
  direction?: TransactionDirection;
  /** Κατάσταση αντιστοίχισης */
  matchStatus?: MatchStatus;
}
// ⚠️ ΣΕΛΙΔΑ της οθόνης. Τα `dateRange` / `minAmount` / `maxAmount` / `searchText` / `matchGroupId` αφαιρέθηκαν
// (2026-10-14): δηλώνονταν αλλά ΔΕΝ εφαρμόζονταν — η τραπεζική συμφωνία ζητούσε «περίοδο» και έπαιρνε τις
// 10.000 νεότερες κινήσεις όλων των εποχών. Για υπολογισμό: `collectBankTransactions` (ADR-ACC-010 §2.1.1).

/** Εμβέλεια σάρωσης του καθολικού τράπεζας — ΟΛΕΣ οι κινήσεις της, ή σφάλμα. */
export type BankLedgerScope =
  | { readonly kind: 'period'; readonly period: PeriodRange }
  | { readonly kind: 'matchGroup'; readonly matchGroupId: string };

/** Ερώτημα σάρωσης καθολικού τράπεζας — χωρίς `pageSize`, ώστε το κόψιμο να είναι αδύνατο από τον τύπο. */
export interface BankLedgerQuery {
  readonly scope: BankLedgerScope;
}

// ============================================================================
// CANDIDATE RETRIEVAL (στένεμα υποψηφίων — ADR-ACC-010 §2.1.1, Φάση 2)
// ============================================================================

/** Κλειστό διάστημα ποσών (€) — το «παράθυρο» μέσα στο οποίο ένα υποψήφιο μπορεί να αντιστοιχιστεί. */
export interface AmountBand {
  readonly min: number;
  readonly max: number;
}

/** Αναφορά σε παραστατικό, όπως τη διαβάζουμε στο κείμενο της τράπεζας (σειρά = `Invoice.series`). */
export interface InvoiceReference {
  readonly series: string;
  readonly number: number;
}

// ============================================================================
// N:M MATCHING TYPES (Phase 2a — SAP/Midday pattern)
// ============================================================================

/** Matchable entity types */
export type MatchableEntityType = 'invoice' | 'journal_entry' | 'efka_payment' | 'tax_payment';

/** Confidence tier classification (Q2 decision) */
export type MatchTier = 'auto_match' | 'suggested' | 'manual_review' | 'no_match';

/** Reference to a matched entity (used in N:M groups) */
export interface MatchedEntityRef {
  /** Entity Firestore document ID */
  entityId: string;
  /** Entity type */
  entityType: MatchableEntityType;
  /** Allocated amount from this entity */
  amount: number;
}

/**
 * Group of candidates that together match one or more transactions (N:M)
 *
 * Used when a single transaction maps to multiple invoices (1:N),
 * or multiple transactions map to one invoice (N:1), or mixed (N:M).
 */
export interface MatchCandidateGroup {
  /** Unique group identifier */
  groupId: string;
  /** Individual candidates in the group */
  candidates: MatchCandidate[];
  /** Combined amount of all candidates */
  totalAmount: number;
  /** Weighted confidence for the group */
  confidence: number;
  /** Human-readable description */
  displayLabel: string;
  /** Match reasons aggregated */
  matchReasons: string[];
  /** Tier classification based on group confidence */
  tier: MatchTier;
}
