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
import type { BookCategory, BusinessStart } from './company';
import type { EntityType } from './entity';

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
  /** Τέλος επιτηδεύματος σε EUR (0 για φυσικά πρόσωπα από 2024· νομικά πρόσωπα βλ. tax-config) */
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
  /** Έναρξη εργασιών — από εδώ **υπολογίζεται** η μειωμένη προκαταβολή (`null` ⇒ πλήρης) */
  businessStart: BusinessStart | null;
}

// ============================================================================
// PREPAYMENT BASIS — Εξηγήσιμη προκαταβολή (ADR-ACC-009 · ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α)
// ============================================================================

/**
 * Κανόνας μείωσης κατά νομική φύση:
 * - `natural_person_first_year` — ν.4172/2013 άρθρο 69 §1: μισή, **μόνο** το έτος της πρώτης απόκτησης
 *   επιχειρηματικού εισοδήματος.
 * - `legal_entity_first_three_years` — άρθρο 71 §3: μισή τα **τρία πρώτα** έτη από την έναρξη, όχι για
 *   εταιρείες από μετατροπή/συγχώνευση.
 */
export type PrepaymentReductionRule = 'natural_person_first_year' | 'legal_entity_first_three_years';

/**
 * Γιατί ο συντελεστής βγήκε όπως βγήκε:
 * - `reduced` — εντός παραθύρου, νέα δραστηριότητα ⇒ μισός συντελεστής.
 * - `outside_window` — εκτός παραθύρου (ή έτος πριν την έναρξη) ⇒ πλήρης.
 * - `continuation` — μετατροπή/συγχώνευση ή προηγούμενη δραστηριότητα ⇒ πλήρης.
 * - `missing_start` — δεν έχει δηλωθεί έναρξη ⇒ πλήρης (ποτέ μικρότερη υποχρέωση από την πραγματική).
 */
export type PrepaymentReason = 'reduced' | 'outside_window' | 'continuation' | 'missing_start';

/** Η βάση της προκαταβολής — κάθε αποτέλεσμα φόρου τη φέρει, ώστε η οθόνη να εξηγεί τον αριθμό. */
export interface PrepaymentBasis {
  /** Εφαρμοζόμενος συντελεστής (%) */
  rate: number;
  /** Βασικός συντελεστής της νομικής μορφής πριν από κάθε μείωση (%) */
  baseRate: number;
  /** Κανόνας μείωσης που εξετάστηκε */
  rule: PrepaymentReductionRule;
  /** Αιτία του αποτελέσματος */
  reason: PrepaymentReason;
  /** Μήκος παραθύρου μείωσης σε φορολογικά έτη (1 ή 3) */
  windowYears: number;
  /** Έτος έναρξης (`null` αν δεν δηλώθηκε) */
  startYear: number | null;
  /** Ποιο έτος από την έναρξη είναι το φορολογικό (1 = έτος έναρξης· `null` αν δεν δηλώθηκε ή πριν την έναρξη) */
  yearSinceStart: number | null;
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
  /** Συντελεστής προκαταβολής (%) — ίσος με `prepaymentBasis.rate` */
  prepaymentRate: number;
  /** Ποσό προκαταβολής */
  prepaymentAmount: number;
  /** Γιατί ο συντελεστής βγήκε έτσι */
  prepaymentBasis: PrepaymentBasis;

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
// ENTITY TAX INPUT — Είσοδος φόρου οντότητας (ΟΕ/ΕΠΕ/ΑΕ)
// ============================================================================

/** Νομικά πρόσωπα/οντότητες — ό,τι φορολογείται ως οντότητα (όλες οι μορφές πλην ατομικής). */
export type LegalEntityType = Exclude<EntityType, 'sole_proprietor'>;

/** Κοινή είσοδος του φόρου οντότητας — ΕΝΑ σχήμα για ΟΕ, ΕΠΕ και ΑΕ. */
export interface EntityTaxInput {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Σύνολο εσόδων */
  totalIncome: number;
  /** Σύνολο εκπιπτόμενων εξόδων */
  totalExpenses: number;
  /** Εκπιπτόμενες εισφορές ΕΦΚΑ (κανόνας ανά μορφή: `entity-tax-profile`) */
  deductibleEfka: number;
  /** Έναρξη εργασιών — από εδώ η μειωμένη προκαταβολή */
  businessStart: BusinessStart | null;
  /** Κατηγορία βιβλίων — καθορίζει την παρακράτηση στη διανομή της ΟΕ */
  bookCategory: BookCategory;
  /** Ποσοστό διανομής των κερδών μετά φόρου (0-100, προεπιλογή 100) */
  distributionPercent?: number;
}

/** Δικαιούχος διανομής (εταίρος / μέλος / μέτοχος) — ουδέτερο σχήμα για τη μηχανή. */
export interface EntityHolder {
  id: string;
  name: string;
  /** Ποσοστό στη διανομή (0-100) */
  sharePercent: number;
}

// ============================================================================
// CORPORATE TAX RESULT — Αποτέλεσμα Εταιρικού Φόρου ΕΠΕ
// ============================================================================

/**
 * Αποτέλεσμα φόρου νομικού προσώπου/οντότητας (22% flat rate)
 *
 * ΟΕ/ΕΠΕ/ΑΕ φορολογούνται ως οντότητα: 22% flat (ΟΧΙ κλιμακωτά) — ν.4172/2013 άρθρα 45, 47, 58.
 */
export interface CorporateTaxResult {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Ακαθάριστα έσοδα */
  grossIncome: number;
  /** Εκπεστέα έξοδα */
  deductibleExpenses: number;
  /** ΕΦΚΑ εκπεστέο (ΟΕ: όλων των εταίρων · ΕΠΕ: διαχειριστών · ΑΕ: μελών ΔΣ αυτοαπασχολούμενων) */
  efkaContributions: number;
  /** Φορολογητέο εισόδημα */
  taxableIncome: number;
  /** Εταιρικός φόρος 22% */
  corporateTaxRate: number;
  /** Ποσό εταιρικού φόρου */
  corporateTaxAmount: number;
  /** Τέλος επιτηδεύματος (1.000€) */
  professionalTax: number;
  /** Συντελεστής προκαταβολής (80%, 40% τα 3 πρώτα έτη) — ίσος με `prepaymentBasis.rate` */
  prepaymentRate: number;
  /** Ποσό προκαταβολής */
  prepaymentAmount: number;
  /** Γιατί ο συντελεστής βγήκε έτσι */
  prepaymentBasis: PrepaymentBasis;
  /** Συνολική φορολογική υποχρέωση */
  totalObligation: number;
}

/**
 * Πόσο από τη διανομή καλύπτουν οι δηλωμένοι δικαιούχοι (εταίροι / μέλη / μέτοχοι).
 *
 * Η παρακράτηση στη διανομή **δεν** είναι ιδιότητα της εταιρείας αλλά του δικαιούχου (φυσικό ή νομικό
 * πρόσωπο, κάτοικος ή μη — ν.4172/2013 άρθρα 48, 64). Χωρίς δικαιούχους δεν υπάρχει ποσό να υπολογιστεί·
 * το «0 €» θα ήταν ψέμα. Το αποτέλεσμα το **λέει**, όπως η `PrepaymentBasis` λέει γιατί αυτή η προκαταβολή.
 *
 * - `complete` — τα ποσοστά αθροίζουν σε 100% (`isCompleteShareSum`)
 * - `partial` — αθροίζουν σε λιγότερο/περισσότερο: τα ποσά αφορούν μόνο το `declaredPercent`
 * - `none` — κανένας δικαιούχος: η παρακράτηση δεν υπολογίζεται
 */
export type DistributionCoverageStatus = 'complete' | 'partial' | 'none';

export interface DistributionCoverage {
  readonly status: DistributionCoverageStatus;
  /** Άθροισμα των δηλωμένων ποσοστών (0 όταν `none`). */
  readonly declaredPercent: number;
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
  /** Πόσο από τη διανομή καλύπτουν τα δηλωμένα μέλη */
  distributionCoverage: DistributionCoverage;
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
  /** Πόσο από τη διανομή καλύπτουν οι δηλωμένοι μέτοχοι */
  distributionCoverage: DistributionCoverage;
}

// ============================================================================
// PARTNERSHIP TAX RESULT — Αποτέλεσμα Φόρου ΟΕ
// ============================================================================

/**
 * Διανομή κερδών ανά εταίρο ΟΕ.
 *
 * Η ΟΕ φορολογείται ως **οντότητα** (22%)· ο εταίρος λαμβάνει το μερίδιό του από τα κέρδη μετά φόρου.
 * Παρακράτηση: 0% με απλογραφικά (τα κέρδη φορολογούνται μόνο στο όνομα της εταιρείας — ΠΟΛ.1042/2015),
 * 5% με διπλογραφικά (ν.4172/2013 άρθρο 36 §1, άρθρο 64 §1α). @see ADR-ACC-024 §6.1 γ
 */
export interface PartnerDistributionResult {
  /** ID εταίρου */
  partnerId: string;
  /** Ονοματεπώνυμο */
  partnerName: string;
  /** Ποσοστό συμμετοχής στα κέρδη */
  profitSharePercent: number;
  /** Μερίδιο διανεμόμενων κερδών (πριν από την παρακράτηση) */
  grossDistribution: number;
  /** Συντελεστής παρακράτησης (%) */
  withholdingRate: number;
  /** Ποσό παρακράτησης */
  withholdingAmount: number;
  /** Καθαρό ποσό στον εταίρο */
  netDistribution: number;
}

/**
 * Πλήρες αποτέλεσμα φόρου ΟΕ — ίδιος υπολογισμός με ΕΠΕ/ΑΕ (`TaxEngine.calculateCorporateTax`),
 * εταίροι αντί μελών. @see ADR-ACC-024 §6 · ADR-ACC-012
 */
export interface PartnershipTaxResult {
  /** Φόρος της οντότητας */
  corporateTax: CorporateTaxResult;
  /** Κέρδη μετά φόρου */
  profitAfterTax: number;
  /** Ποσό διανεμόμενων κερδών */
  distributedProfits: number;
  /** Αδιανέμητα κέρδη */
  retainedEarnings: number;
  /** Διανομή ανά εταίρο */
  partnerDistributions: PartnerDistributionResult[];
  /** Συνολική παρακράτηση στη διανομή */
  totalDistributionWithholding: number;
  /** Πόσο από τη διανομή καλύπτουν οι δηλωμένοι εταίροι */
  distributionCoverage: DistributionCoverage;
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
