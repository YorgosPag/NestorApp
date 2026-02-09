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

/** Κατεύθυνση συναλλαγής */
export type TransactionDirection = 'credit' | 'debit';

/**
 * Κατάσταση αντιστοίχισης
 *
 * - `unmatched`: Δεν αντιστοιχίστηκε σε καμία εγγραφή
 * - `auto_matched`: Αυτόματη αντιστοίχιση (βάσει ποσού + ημερομηνίας)
 * - `manual_matched`: Χειροκίνητη αντιστοίχιση
 * - `excluded`: Εξαιρέθηκε (π.χ. μεταφορά μεταξύ λογαριασμών)
 */
export type MatchStatus = 'unmatched' | 'auto_matched' | 'manual_matched' | 'excluded';

// ============================================================================
// BANK ACCOUNT CONFIG
// ============================================================================

/** Τύπος τραπεζικού λογαριασμού */
export type BankAccountType = 'checking' | 'savings' | 'business';

/**
 * Ρύθμιση τραπεζικού λογαριασμού για συμφωνία
 *
 * Firestore path: `accounting_bank_accounts/{accountId}`
 */
export interface BankAccountConfig {
  /** Μοναδικό ID (Firestore doc ID) */
  accountId: string;
  /** Τράπεζα (π.χ. 'Εθνική Τράπεζα') */
  bankName: string;
  /** IBAN (χωρίς κενά) */
  iban: string;
  /** Ετικέτα εμφάνισης (π.χ. 'Κύριος Λογ/μός') */
  label: string;
  /** Τύπος λογαριασμού */
  type: BankAccountType;
  /** Νόμισμα */
  currency: CurrencyCode;
  /** Ενεργός; */
  isActive: boolean;
  /** Κωδικός τράπεζας (SWIFT/BIC) */
  bankCode: string | null;
  /** Σημειώσεις */
  notes: string | null;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
}

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
  matchedEntityType: 'invoice' | 'journal_entry' | 'efka_payment' | 'tax_payment' | null;
  /** Βαθμός εμπιστοσύνης αντιστοίχισης (0-100, null αν χειροκίνητη) */
  matchConfidence: number | null;

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
  entityType: 'invoice' | 'journal_entry' | 'efka_payment' | 'tax_payment';
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
  matchedEntityType: 'invoice' | 'journal_entry' | 'efka_payment' | 'tax_payment' | null;
  /** Βαθμός εμπιστοσύνης */
  confidence: number | null;
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
  /** Εύρος ημερομηνιών */
  dateRange?: PeriodRange;
  /** Ελάχιστο ποσό */
  minAmount?: number;
  /** Μέγιστο ποσό */
  maxAmount?: number;
  /** Αναζήτηση κειμένου (description, counterparty) */
  searchText?: string;
}
