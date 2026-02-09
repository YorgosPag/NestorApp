/**
 * @fileoverview Accounting Subapp — Journal Entry Types
 * @description Τύποι για το Βιβλίο Εσόδων-Εξόδων (Β' κατηγορίας)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts §4.2, §4.3
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type {
  AccountCategory,
  EntryType,
  FiscalQuarter,
  IncomeCategory,
  ExpenseCategory,
  MyDataIncomeType,
  MyDataExpenseType,
  PaymentMethod,
  PeriodRange,
} from './common';

// ============================================================================
// CATEGORY DEFINITION (ADR-ACC-001 §4.2)
// ============================================================================

/**
 * Ορισμός κατηγορίας λογιστικού σχεδίου
 *
 * Κάθε κατηγορία εσόδων/εξόδων φέρει πλήρη metadata:
 * myDATA classification, E3 φορολογικό κωδικό, ΦΠΑ, ΚΑΔ κ.λπ.
 *
 * @example
 * ```typescript
 * const serviceIncome: CategoryDefinition = {
 *   code: 'service_income',
 *   type: 'income',
 *   label: 'Αμοιβές Υπηρεσιών',
 *   description: 'Μελέτες, ΠΕΑ, άδειες, ρυθμίσεις, επιβλέψεις',
 *   mydataCode: 'category1_3',
 *   e3Code: '561_003',
 *   defaultVatRate: 24,
 *   vatDeductible: false,
 *   vatDeductiblePercent: 0,
 *   isActive: true,
 *   sortOrder: 1,
 *   icon: 'Briefcase',
 *   kadCode: '71112000',
 * };
 * ```
 */
export interface CategoryDefinition {
  /** Μοναδικός κωδικός κατηγορίας */
  code: AccountCategory;
  /** Τύπος: έσοδο ή έξοδο */
  type: EntryType;
  /** Ελληνικό label για UI */
  label: string;
  /** Αναλυτική περιγραφή */
  description: string;
  /** myDATA classification code (category1_x ή category2_x) */
  mydataCode: MyDataIncomeType | MyDataExpenseType;
  /** E3 φορολογικός κωδικός (π.χ. '561_003', '585_001') */
  e3Code: string;
  /** Προεπιλεγμένος συντελεστής ΦΠΑ (24, 13, 6 ή 0) */
  defaultVatRate: number;
  /** Εκπίπτει ο ΦΠΑ; (μόνο για έξοδα) */
  vatDeductible: boolean;
  /** Ποσοστό έκπτωσης ΦΠΑ (100, 50 ή 0) */
  vatDeductiblePercent: number;
  /** Ενεργή κατηγορία; */
  isActive: boolean;
  /** Σειρά εμφάνισης στο UI (1-28) */
  sortOrder: number;
  /** Lucide icon name (π.χ. 'Briefcase', 'Building') */
  icon: string;
  /** ΚΑΔ κωδικός (μόνο για έσοδα, null για έξοδα) */
  kadCode: string | null;
}

// ============================================================================
// JOURNAL ENTRY — Εγγραφή Βιβλίου Ε-Ε
// ============================================================================

/**
 * Μία εγγραφή στο Βιβλίο Εσόδων-Εξόδων
 *
 * Firestore path: `accounting_journal_entries/{entryId}`
 *
 * @example
 * ```typescript
 * const entry: JournalEntry = {
 *   entryId: 'je_2026_001',
 *   date: '2026-02-09',
 *   type: 'income',
 *   category: 'service_income',
 *   description: 'ΠΕΑ - Διαμέρισμα Κηφισιάς',
 *   netAmount: 300,
 *   vatRate: 24,
 *   vatAmount: 72,
 *   grossAmount: 372,
 *   vatDeductible: false,
 *   paymentMethod: 'bank_transfer',
 *   contactId: 'contact_abc',
 *   contactName: 'Νίκος Παπαδόπουλος',
 *   invoiceId: 'inv_2026_042',
 *   mydataCode: 'category1_3',
 *   e3Code: '561_003',
 *   fiscalYear: 2026,
 *   quarter: 1,
 *   notes: null,
 *   createdAt: '2026-02-09T10:00:00Z',
 *   updatedAt: '2026-02-09T10:00:00Z',
 * };
 * ```
 */
export interface JournalEntry {
  /** Μοναδικό αναγνωριστικό εγγραφής */
  entryId: string;
  /** Ημερομηνία εγγραφής (ISO 8601 date string, π.χ. '2026-02-09') */
  date: string;
  /** Τύπος: έσοδο ή έξοδο */
  type: EntryType;
  /** Κατηγορία εσόδου/εξόδου */
  category: AccountCategory;
  /** Περιγραφή εγγραφής */
  description: string;
  /** Καθαρό ποσό (χωρίς ΦΠΑ) σε EUR */
  netAmount: number;
  /** Συντελεστής ΦΠΑ (24, 13, 6 ή 0) */
  vatRate: number;
  /** Ποσό ΦΠΑ σε EUR */
  vatAmount: number;
  /** Μικτό ποσό (net + ΦΠΑ) σε EUR */
  grossAmount: number;
  /** Εκπίπτει ο ΦΠΑ αυτής της εγγραφής; */
  vatDeductible: boolean;
  /** Τρόπος πληρωμής */
  paymentMethod: PaymentMethod;
  /** Αναφορά σε contact (Firestore doc ID) */
  contactId: string | null;
  /** Όνομα επαφής (denormalized για γρήγορη εμφάνιση) */
  contactName: string | null;
  /** Αναφορά σε τιμολόγιο (Firestore doc ID) */
  invoiceId: string | null;
  /** myDATA classification code */
  mydataCode: MyDataIncomeType | MyDataExpenseType;
  /** E3 φορολογικός κωδικός */
  e3Code: string;
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Τρίμηνο */
  quarter: FiscalQuarter;
  /** Σημειώσεις (προαιρετικό) */
  notes: string | null;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// JOURNAL ENTRY FILTERS
// ============================================================================

/** Φίλτρα αναζήτησης για εγγραφές Ε-Ε */
export interface JournalEntryFilters {
  /** Φίλτρο τύπου (income/expense) */
  type?: EntryType;
  /** Φίλτρο κατηγορίας */
  category?: AccountCategory;
  /** Εύρος ημερομηνιών */
  period?: PeriodRange;
  /** Φορολογικό έτος */
  fiscalYear?: number;
  /** Τρίμηνο */
  quarter?: FiscalQuarter;
  /** Τρόπος πληρωμής */
  paymentMethod?: PaymentMethod;
  /** Αναζήτηση κειμένου (description) */
  searchText?: string;
  /** Φίλτρο επαφής */
  contactId?: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input για δημιουργία νέας εγγραφής Ε-Ε
 * Εξαιρεί τα πεδία που δημιουργούνται αυτόματα
 */
export type CreateJournalEntryInput = Omit<
  JournalEntry,
  'entryId' | 'createdAt' | 'updatedAt'
>;

/**
 * Input για ενημέρωση εγγραφής Ε-Ε
 * Όλα τα πεδία προαιρετικά εκτός του entryId
 */
export type UpdateJournalEntryInput = Partial<
  Omit<JournalEntry, 'entryId' | 'createdAt' | 'updatedAt'>
>;

// Re-export used types for convenience
export type { IncomeCategory, ExpenseCategory };
