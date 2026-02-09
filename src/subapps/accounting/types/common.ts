/**
 * @fileoverview Accounting Subapp — Shared Types
 * @description Κοινοί τύποι που χρησιμοποιούνται σε όλα τα accounting modules
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @see ADR-ACC-002 Invoicing System
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ============================================================================
// FISCAL PERIOD TYPES
// ============================================================================

/** Φορολογικό τρίμηνο (1 = Ιαν-Μαρ, 2 = Απρ-Ιουν, 3 = Ιουλ-Σεπ, 4 = Οκτ-Δεκ) */
export type FiscalQuarter = 1 | 2 | 3 | 4;

/** Εύρος ημερομηνιών για περιοδικές αναφορές */
export interface PeriodRange {
  /** Ημερομηνία έναρξης (ISO 8601 string) */
  from: string;
  /** Ημερομηνία λήξης (ISO 8601 string) */
  to: string;
}

// ============================================================================
// ENTRY TYPE
// ============================================================================

/** Τύπος εγγραφής: Έσοδο ή Έξοδο */
export type EntryType = 'income' | 'expense';

// ============================================================================
// INCOME CATEGORIES (ADR-ACC-001 §4.1 — 5 κατηγορίες)
// ============================================================================

/**
 * Κατηγορίες εσόδων μηχανικού/κατασκευαστικής εταιρείας
 *
 * - `service_income`: Αμοιβές υπηρεσιών (μελέτες, ΠΕΑ, άδειες, επιβλέψεις)
 * - `construction_income`: Κατασκευαστικά έσοδα (μη οικιστικά)
 * - `construction_res_income`: Κατασκευαστικά (οικιστικά)
 * - `asset_sale_income`: Πώληση παγίου (εξοπλισμός, Η/Υ)
 * - `other_income`: Λοιπά έσοδα (τόκοι, αποζημιώσεις)
 */
export type IncomeCategory =
  | 'service_income'
  | 'construction_income'
  | 'construction_res_income'
  | 'asset_sale_income'
  | 'other_income';

// ============================================================================
// EXPENSE CATEGORIES (ADR-ACC-001 §4.1 — 19 κατηγορίες)
// ============================================================================

/**
 * Κατηγορίες εξόδων μηχανικού/κατασκευαστικής εταιρείας
 *
 * Κάθε κατηγορία αντιστοιχεί σε myDATA classification code και E3 φορολογικό κωδικό.
 */
export type ExpenseCategory =
  | 'third_party_fees'
  | 'rent'
  | 'utilities'
  | 'telecom'
  | 'fuel'
  | 'vehicle_expenses'
  | 'vehicle_insurance'
  | 'office_supplies'
  | 'software'
  | 'equipment'
  | 'travel'
  | 'training'
  | 'advertising'
  | 'efka'
  | 'professional_tax'
  | 'bank_fees'
  | 'tee_fees'
  | 'depreciation'
  | 'other_expense';

/** Ενοποιημένος τύπος κατηγορίας (έσοδα + έξοδα) */
export type AccountCategory = IncomeCategory | ExpenseCategory;

// ============================================================================
// MYDATA CLASSIFICATION CODES (ΑΑΔΕ)
// ============================================================================

/**
 * myDATA κωδικοί εσόδων (category1_x)
 * @see https://www.aade.gr/mydata
 */
export type MyDataIncomeType =
  | 'category1_1'  // Πώληση αγαθών
  | 'category1_3'  // Παροχή υπηρεσιών
  | 'category1_4'  // Πώληση παγίων
  | 'category1_5'; // Λοιπά έσοδα

/**
 * myDATA κωδικοί εξόδων (category2_x)
 * @see https://www.aade.gr/mydata
 */
export type MyDataExpenseType =
  | 'category2_2'   // Αγορές Α' υλών
  | 'category2_3'   // Λήψη υπηρεσιών
  | 'category2_4'   // Γενικά έξοδα
  | 'category2_5'   // Λοιπά έξοδα
  | 'category2_6'   // Αμοιβές προσωπικού
  | 'category2_7'   // Αγορές παγίων
  | 'category2_11'  // Αποσβέσεις
  | 'category2_12'  // Λοιπές εκπιπτόμενες δαπάνες
  | 'category2_14'; // Πληροφοριακά

/**
 * myDATA κατάσταση παραστατικού
 * @see ADR-ACC-003 §4
 */
export type MyDataDocumentStatus =
  | 'draft'      // Πρόχειρο (δεν έχει υποβληθεί)
  | 'sent'       // Υποβλήθηκε στο myDATA
  | 'accepted'   // Αποδεκτό από ΑΑΔΕ (MARK αποδοχή)
  | 'rejected'   // Απορρίφθηκε από ΑΑΔΕ
  | 'cancelled'; // Ακυρωμένο

// ============================================================================
// PAYMENT METHODS (ADR-ACC-002 §3.3)
// ============================================================================

/**
 * Τρόποι πληρωμής
 *
 * **ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ**: Μετρητά (cash) >500€ ΑΠΑΓΟΡΕΥΟΝΤΑΙ (Ν.4446/2016)
 */
export type PaymentMethod =
  | 'cash'           // Μετρητά (max 500€)
  | 'bank_transfer'  // Τραπεζική κατάθεση/μεταφορά
  | 'card'           // Κάρτα (χρεωστική/πιστωτική)
  | 'check'          // Επιταγή
  | 'credit'         // Πίστωση (πληρωμή αργότερα)
  | 'mixed';         // Μικτός τρόπος
