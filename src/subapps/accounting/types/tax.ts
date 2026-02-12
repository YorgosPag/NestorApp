/**
 * @fileoverview Accounting Subapp — Tax Engine Types
 * @description Τύποι για τον υπολογισμό φόρου εισοδήματος ελεύθερου επαγγελματία
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { FiscalQuarter, PeriodRange, IncomeCategory, ExpenseCategory } from './common';

// ============================================================================
// TAX BRACKET — Φορολογική Κλίμακα
// ============================================================================

/**
 * Κλίμακα φόρου εισοδήματος
 *
 * Ελληνική κλίμακα 2024+:
 * - 0 - 10.000: 9%
 * - 10.001 - 20.000: 22%
 * - 20.001 - 30.000: 28%
 * - 30.001 - 40.000: 36%
 * - 40.001+: 44%
 */
export interface TaxBracket {
  /** Κάτω όριο (inclusive) */
  from: number;
  /** Άνω όριο (inclusive, null = ανοικτό) */
  to: number | null;
  /** Συντελεστής φόρου (0-100) */
  rate: number;
}

// ============================================================================
// TAX SCALE CONFIG — Ρυθμίσεις Κλίμακας
// ============================================================================

/**
 * Ρυθμίσεις φορολογικής κλίμακας ανά έτος
 *
 * Περιλαμβάνει κλίμακα φόρου, προκαταβολή, τέλος επιτηδεύματος.
 */
export interface TaxScaleConfig {
  /** Φορολογικό έτος */
  year: number;
  /** Κλίμακα φόρου εισοδήματος */
  brackets: TaxBracket[];
  /** Συντελεστής προκαταβολής φόρου (55% για ελ. επαγγελματίες, 80% 1ο έτος) */
  prepaymentRate: number;
  /** Τέλος επιτηδεύματος σε EUR (650 ή 0 αν στα 5 πρώτα χρόνια) */
  professionalTax: number;
  /** Ειδική εισφορά αλληλεγγύης (0% από 2023 αλλά μπορεί να επανέλθει) */
  solidarityRate: number;
}

// ============================================================================
// TAX CALCULATION PARAMS — Παράμετροι Υπολογισμού
// ============================================================================

/** Παράμετροι εισόδου για υπολογισμό ετήσιου φόρου */
export interface TaxCalculationParams {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Σύνολο εσόδων (καθαρά ποσά) */
  totalIncome: number;
  /** Σύνολο εξόδων (εκπεστέα) */
  totalDeductibleExpenses: number;
  /** Σύνολο ΕΦΚΑ (εκπεστέο) */
  totalEfkaContributions: number;
  /** Τέλος επιτηδεύματος (650€ ή 0€) */
  professionalTax: number;
  /** Παρακρατήσεις φόρου (20% σε ΤΠΥ) */
  totalWithholdings: number;
  /** Προκαταβολή φόρου προηγούμενου έτους */
  previousYearPrepayment: number;
  /** Πρώτα 5 έτη δραστηριότητας; (μειωμένη προκαταβολή) */
  isFirstFiveYears: boolean;
}

// ============================================================================
// TAX BRACKET RESULT — Αποτέλεσμα ανά Κλίμακα
// ============================================================================

/** Ανάλυση φόρου ανά κλίμακα */
export interface TaxBracketResult {
  /** Κλίμακα */
  bracket: TaxBracket;
  /** Φορολογητέο ποσό σε αυτή την κλίμακα */
  taxableAmount: number;
  /** Φόρος σε αυτή την κλίμακα */
  taxAmount: number;
}

// ============================================================================
// TAX RESULT — Πλήρες Αποτέλεσμα
// ============================================================================

/**
 * Πλήρες αποτέλεσμα υπολογισμού φόρου
 *
 * Περιλαμβάνει αναλυτική κατανομή ανά κλίμακα, αλληλεγγύη,
 * προκαταβολή, και τελικό ποσό πληρωμής.
 */
export interface TaxResult {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Ακαθάριστα έσοδα */
  grossIncome: number;
  /** Εκπεστέα έξοδα */
  deductibleExpenses: number;
  /** Φορολογητέο εισόδημα (income - expenses - ΕΦΚΑ) */
  taxableIncome: number;

  // — Κύριος Φόρος —
  /** Ανάλυση φόρου ανά κλίμακα */
  bracketBreakdown: TaxBracketResult[];
  /** Κύριος φόρος εισοδήματος */
  incomeTax: number;

  // — Αλληλεγγύη —
  /** Ειδική εισφορά αλληλεγγύης */
  solidarityContribution: number;

  // — Προκαταβολή —
  /** Συντελεστής προκαταβολής (%) */
  prepaymentRate: number;
  /** Ποσό προκαταβολής */
  prepaymentAmount: number;

  // — Τέλος Επιτηδεύματος —
  /** Τέλος επιτηδεύματος */
  professionalTax: number;

  // — Παρακρατήσεις & Πιστώσεις —
  /** Σύνολο παρακρατήσεων (20% ΤΠΥ) */
  totalWithholdings: number;
  /** Προκαταβολή προηγούμενου έτους */
  previousYearPrepayment: number;

  // — Τελικό Αποτέλεσμα —
  /** Συνολική φορολογική υποχρέωση (tax + solidarity + prepayment + prof.tax) */
  totalObligation: number;
  /** Συνολικές πιστώσεις (withholdings + prev. prepayment) */
  totalCredits: number;
  /** Τελικό ποσό πληρωμής (obligation - credits, θετικό = χρεωστικό) */
  finalAmount: number;
  /** Πιστωτικό υπόλοιπο (αν credits > obligation) */
  refundAmount: number;
}

// ============================================================================
// TAX ESTIMATE — Πρόβλεψη Φόρου (Real-time)
// ============================================================================

/**
 * Πρόβλεψη φόρου σε πραγματικό χρόνο
 *
 * Χρησιμοποιείται στο dashboard για real-time projection
 * βασισμένη στα τρέχοντα δεδομένα.
 */
export interface TaxEstimate {
  /** Ημερομηνία πρόβλεψης (ISO 8601) */
  estimatedAt: string;
  /** Περίοδος αναφοράς */
  period: PeriodRange;
  /** Τρέχον τρίμηνο */
  currentQuarter: FiscalQuarter;

  // — Τρέχοντα Δεδομένα —
  /** Έσοδα μέχρι τώρα */
  actualIncome: number;
  /** Έξοδα μέχρι τώρα */
  actualExpenses: number;

  // — Προβολή Ετήσιων —
  /** Προβλεπόμενα ετήσια έσοδα */
  projectedAnnualIncome: number;
  /** Προβλεπόμενα ετήσια έξοδα */
  projectedAnnualExpenses: number;
  /** Προβλεπόμενος ετήσιος φόρος */
  projectedAnnualTax: number;
  /** Προβλεπόμενο τελικό ποσό (με παρακρατήσεις) */
  projectedFinalAmount: number;

  // — Ανάλυση ανά κατηγορία —
  /** Top κατηγορίες εσόδων */
  topIncomeCategories: Array<{ category: IncomeCategory; amount: number }>;
  /** Top κατηγορίες εξόδων */
  topExpenseCategories: Array<{ category: ExpenseCategory; amount: number }>;
}

// ============================================================================
// TAX INSTALLMENT — Δόσεις Φόρου
// ============================================================================

/** Κατάσταση δόσης */
export type TaxInstallmentStatus = 'upcoming' | 'due' | 'paid' | 'overdue';

/**
 * Δόση φόρου εισοδήματος
 *
 * Ο φόρος εξοφλείται σε 3 ή περισσότερες δόσεις:
 * - 1η δόση: με τη δήλωση (Ιούλιος)
 * - 2η δόση: Σεπτέμβριος
 * - 3η δόση: Νοέμβριος
 */
export interface TaxInstallment {
  /** Αύξων αριθμός δόσης (1, 2, 3, ...) */
  installmentNumber: number;
  /** Ποσό δόσης */
  amount: number;
  /** Ημερομηνία λήξης (ISO 8601) */
  dueDate: string;
  /** Κατάσταση */
  status: TaxInstallmentStatus;
  /** Ημερομηνία πληρωμής (ISO 8601, null αν δεν πληρώθηκε) */
  paidDate: string | null;
  /** Σημειώσεις */
  notes: string | null;
}

// ============================================================================
// TAX PLANNING INSIGHT — AI Φορολογικές Συμβουλές
// ============================================================================

/** Προτεραιότητα φορολογικής συμβουλής */
export type TaxInsightPriority = 'high' | 'medium' | 'low';

/**
 * AI-generated φορολογική συμβουλή
 *
 * Παράγεται από τον Tax Engine με βάση τα τρέχοντα δεδομένα.
 */
export interface TaxPlanningInsight {
  /** Μοναδικό ID */
  insightId: string;
  /** Τίτλος (π.χ. 'Εκκρεμή Τιμολόγια Εξόδων') */
  title: string;
  /** Αναλυτική περιγραφή */
  description: string;
  /** Εκτιμώμενη εξοικονόμηση σε EUR */
  estimatedSaving: number | null;
  /** Προτεραιότητα */
  priority: TaxInsightPriority;
  /** Κατηγορία συμβουλής */
  category: 'expense_optimization' | 'income_timing' | 'prepayment' | 'efka' | 'general';
  /** Ενεργή; */
  isActive: boolean;
}

// ============================================================================
// CORPORATE TAX RESULT — Αποτέλεσμα Εταιρικού Φόρου ΕΠΕ
// ============================================================================

/**
 * Αποτέλεσμα εταιρικού φόρου (22% flat rate)
 *
 * ΕΠΕ φορολογείται ως νομικό πρόσωπο: 22% flat (ΟΧΙ κλιμακωτά).
 */
export interface CorporateTaxResult {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Ακαθάριστα έσοδα */
  grossIncome: number;
  /** Εκπεστέα έξοδα */
  deductibleExpenses: number;
  /** ΕΦΚΑ εκπεστέο (μόνο διαχειριστών) */
  efkaContributions: number;
  /** Φορολογητέο εισόδημα */
  taxableIncome: number;
  /** Εταιρικός φόρος 22% */
  corporateTaxRate: number;
  /** Ποσό εταιρικού φόρου */
  corporateTaxAmount: number;
  /** Τέλος επιτηδεύματος (1.000€) */
  professionalTax: number;
  /** Συντελεστής προκαταβολής (80%) */
  prepaymentRate: number;
  /** Ποσό προκαταβολής */
  prepaymentAmount: number;
  /** Συνολική φορολογική υποχρέωση */
  totalObligation: number;
}

/**
 * Αποτέλεσμα μερισμάτων ανά μέλος
 */
export interface MemberDividendResult {
  /** ID μέλους */
  memberId: string;
  /** Ονοματεπώνυμο */
  memberName: string;
  /** Ποσοστό μερισμάτων */
  dividendSharePercent: number;
  /** Μερίδιο κέρδους (πριν τον φόρο μερισμάτων) */
  grossDividend: number;
  /** Φόρος μερισμάτων 5% */
  dividendTaxRate: number;
  /** Ποσό φόρου μερισμάτων */
  dividendTaxAmount: number;
  /** Καθαρό μέρισμα μετά φόρου */
  netDividend: number;
}

/**
 * Πλήρες αποτέλεσμα φόρου ΕΠΕ
 *
 * Περιλαμβάνει εταιρικό φόρο + μερίσματα + αδιανέμητα κέρδη.
 */
export interface EPETaxResult {
  /** Εταιρικός φόρος */
  corporateTax: CorporateTaxResult;
  /** Κέρδη μετά φόρου (disponible for dividends) */
  profitAfterTax: number;
  /** Ποσό διανεμόμενων μερισμάτων (100% ή custom) */
  distributedDividends: number;
  /** Αδιανέμητα κέρδη (retained earnings) */
  retainedEarnings: number;
  /** Αναλυτικά μερίσματα ανά μέλος */
  memberDividends: MemberDividendResult[];
  /** Συνολικός φόρος μερισμάτων (5% επί διανεμόμενων) */
  totalDividendTax: number;
}

// ============================================================================
// SHAREHOLDER DIVIDEND RESULT — Μέρισμα ανά Μέτοχο ΑΕ
// ============================================================================

/**
 * Αποτέλεσμα μερισμάτων ανά μέτοχο (ΑΕ)
 *
 * Ίδια δομή/λογική με MemberDividendResult, αλλά
 * χρησιμοποιεί shareholderId αντί memberId.
 */
export interface ShareholderDividendResult {
  /** ID μετόχου */
  shareholderId: string;
  /** Ονοματεπώνυμο */
  shareholderName: string;
  /** Ποσοστό μερισμάτων */
  dividendSharePercent: number;
  /** Μερίδιο κέρδους (πριν τον φόρο μερισμάτων) */
  grossDividend: number;
  /** Φόρος μερισμάτων 5% */
  dividendTaxRate: number;
  /** Ποσό φόρου μερισμάτων */
  dividendTaxAmount: number;
  /** Καθαρό μέρισμα μετά φόρου */
  netDividend: number;
}

/**
 * Πλήρες αποτέλεσμα φόρου ΑΕ
 *
 * Ίδια φορολόγηση με ΕΠΕ (22% flat, 5% μερίσματα, 80% προκαταβολή)
 * αλλά μέτοχοι αντί μελών.
 *
 * @see ADR-ACC-016 AE Corporate Tax & Dividends
 */
export interface AETaxResult {
  /** Εταιρικός φόρος */
  corporateTax: CorporateTaxResult;
  /** Κέρδη μετά φόρου */
  profitAfterTax: number;
  /** Ποσό διανεμόμενων μερισμάτων */
  distributedDividends: number;
  /** Αδιανέμητα κέρδη (retained earnings) */
  retainedEarnings: number;
  /** Αναλυτικά μερίσματα ανά μέτοχο */
  shareholderDividends: ShareholderDividendResult[];
  /** Συνολικός φόρος μερισμάτων */
  totalDividendTax: number;
}

// ============================================================================
// PARTNERSHIP TAX RESULT — Αποτέλεσμα Φόρου ΟΕ
// ============================================================================

/** Αποτέλεσμα φόρου ανά εταίρο */
export interface PartnerTaxResult {
  partnerId: string;
  partnerName: string;
  profitSharePercent: number;
  profitShare: number;
  taxResult: TaxResult;
}

/** Συνολικό αποτέλεσμα φόρου ΟΕ */
export interface PartnershipTaxResult {
  fiscalYear: number;
  totalEntityIncome: number;
  totalEntityExpenses: number;
  totalEntityProfit: number;
  entityProfessionalTax: number;
  partnerResults: PartnerTaxResult[];
}

// ============================================================================
// WITHHOLDING RECONCILIATION — Αντιστοίχιση Παρακρατήσεων
// ============================================================================

export interface WithholdingReconciliation {
  /** ID τιμολογίου */
  invoiceId: string;
  /** Αριθμός τιμολογίου (display) */
  invoiceNumber: string;
  /** Πελάτης */
  customerName: string;
  /** ΑΦΜ πελάτη */
  customerVatNumber: string;
  /** Καθαρό ποσό τιμολογίου */
  invoiceNetAmount: number;
  /** Ποσό παρακράτησης (20%) */
  withholdingAmount: number;
  /** Αντιστοιχισμένο; (με βεβαίωση αποδοχών) */
  isReconciled: boolean;
  /** Ημερομηνία αντιστοίχισης (ISO 8601) */
  reconciledAt: string | null;
  /** Σημειώσεις */
  notes: string | null;
}
