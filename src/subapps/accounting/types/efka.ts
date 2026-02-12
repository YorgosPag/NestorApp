/**
 * @fileoverview Accounting Subapp — EFKA Contribution Types
 * @description Τύποι για τις εισφορές ΕΦΚΑ ελεύθερου επαγγελματία
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-006 EFKA Contributions
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ============================================================================
// EFKA CATEGORY RATES
// ============================================================================

/**
 * Κατηγορία ασφαλιστικών εισφορών ΕΦΚΑ
 *
 * Οι ελεύθεροι επαγγελματίες επιλέγουν κατηγορία εισφορών.
 * Από 2023+: 6 κατηγορίες κύριας σύνταξης, 3 επικουρικής, 3 εφάπαξ.
 */
export interface EFKACategoryRate {
  /** Κωδικός κατηγορίας (π.χ. 'main_1', 'supplementary_2') */
  code: string;
  /** Ετικέτα εμφάνισης (π.χ. '1η Κατηγορία - 210€') */
  label: string;
  /** Μηνιαίο ποσό εισφοράς σε EUR */
  monthlyAmount: number;
  /** Ετήσιο ποσό (monthly × 12) */
  annualAmount: number;
  /** Τύπος κλάδου */
  branch: 'main_pension' | 'supplementary' | 'lump_sum';
}

// ============================================================================
// EFKA YEAR CONFIG
// ============================================================================

/**
 * Ρυθμίσεις ΕΦΚΑ ανά φορολογικό έτος
 *
 * Τα ποσά αλλάζουν κάθε χρόνο βάσει ΦΕΚ.
 */
export interface EFKAYearConfig {
  /** Φορολογικό έτος */
  year: number;
  /** Κατηγορίες κύριας σύνταξης (6 κατηγορίες) */
  mainPensionCategories: EFKACategoryRate[];
  /** Κατηγορίες επικουρικής (3 κατηγορίες) */
  supplementaryCategories: EFKACategoryRate[];
  /** Κατηγορίες εφάπαξ (3 κατηγορίες) */
  lumpSumCategories: EFKACategoryRate[];
  /** Εισφορά υγείας (σταθερή, ίδια για όλους) */
  healthContributionMonthly: number;
  /** ΦΕΚ αναφοράς */
  legalReference: string;
}

// ============================================================================
// EFKA USER CONFIG
// ============================================================================

/**
 * Προσωπικές ρυθμίσεις ΕΦΚΑ χρήστη
 *
 * Κάθε ελ. επαγγελματίας επιλέγει κατηγορία σε κάθε κλάδο.
 */
export interface EFKAUserConfig {
  /** Επιλεγμένη κατηγορία κύριας σύνταξης */
  selectedMainPensionCode: string;
  /** Επιλεγμένη κατηγορία επικουρικής */
  selectedSupplementaryCode: string;
  /** Επιλεγμένη κατηγορία εφάπαξ */
  selectedLumpSumCode: string;
  /** Κωδικός πληρωμής ΕΦΚΑ (ΑΜΑ) */
  efkaRegistrationNumber: string;
  /** Ημερομηνία έναρξης δραστηριότητας (ISO 8601) */
  activityStartDate: string;
  /** Σημειώσεις */
  notes: string | null;
}

// ============================================================================
// EFKA MONTHLY BREAKDOWN
// ============================================================================

/**
 * Μηνιαία ανάλυση εισφορών ΕΦΚΑ
 *
 * Αναλυτική κατανομή ανά κλάδο ασφάλισης.
 */
export interface EFKAMonthlyBreakdown {
  /** Μήνας (1-12) */
  month: number;
  /** Φορολογικό έτος */
  year: number;
  /** Εισφορά κύριας σύνταξης */
  mainPensionAmount: number;
  /** Εισφορά επικουρικής */
  supplementaryAmount: number;
  /** Εισφορά εφάπαξ */
  lumpSumAmount: number;
  /** Εισφορά υγείας */
  healthAmount: number;
  /** Συνολική μηνιαία εισφορά */
  totalMonthly: number;
}

// ============================================================================
// EFKA PAYMENT STATUS & RECORDS
// ============================================================================

/**
 * Κατάσταση πληρωμής ΕΦΚΑ
 *
 * - `upcoming`: Δεν έφτασε ακόμα η ημερομηνία
 * - `due`: Οφείλεται (μέσα στην προθεσμία)
 * - `paid`: Πληρώθηκε
 * - `overdue`: Εκπρόθεσμη (προσαυξήσεις)
 * - `keao`: Βεβαιωμένη στο ΚΕΑΟ (σοβαρό!)
 */
export type EFKAPaymentStatus = 'upcoming' | 'due' | 'paid' | 'overdue' | 'keao';

/**
 * Εγγραφή πληρωμής ΕΦΚΑ
 *
 * Κάθε μηνιαία εισφορά αποτελεί μία πληρωμή.
 */
export interface EFKAPayment {
  /** Μοναδικό ID πληρωμής */
  paymentId: string;
  /** Φορολογικό έτος */
  year: number;
  /** Μήνας (1-12) */
  month: number;
  /** Ποσό πληρωμής */
  amount: number;
  /** Ημερομηνία λήξης (ISO 8601, τελευταία εργάσιμη μήνα) */
  dueDate: string;
  /** Κατάσταση */
  status: EFKAPaymentStatus;
  /** Ημερομηνία πληρωμής (ISO 8601, null αν δεν πληρώθηκε) */
  paidDate: string | null;
  /** Αναφορά τραπεζικής συναλλαγής (για αντιστοίχιση) */
  bankTransactionRef: string | null;
  /** ID εταίρου (null = ατομική, backward compatible) */
  partnerId: string | null;
  /** Σημειώσεις */
  notes: string | null;
}

// ============================================================================
// EFKA ANNUAL SUMMARY
// ============================================================================

/**
 * Ετήσια σύνοψη ΕΦΚΑ
 *
 * Συνολικά στοιχεία εισφορών για το φορολογικό έτος.
 * Το ποσό ΕΦΚΑ εκπίπτει πλήρως από τη φορολογητέα βάση.
 */
export interface EFKAAnnualSummary {
  /** Φορολογικό έτος */
  year: number;
  /** Μηνιαία ανάλυση (12 μήνες) */
  monthlyBreakdown: EFKAMonthlyBreakdown[];
  /** Πληρωμές (12 μήνες) */
  payments: EFKAPayment[];
  /** Σύνολο καταβληθεισών εισφορών */
  totalPaid: number;
  /** Σύνολο οφειλομένων εισφορών */
  totalDue: number;
  /** Υπόλοιπο (due - paid) */
  balanceDue: number;
  /** Ποσό εκπεστέο φορολογικά (= totalPaid) */
  taxDeductibleAmount: number;
  /** Αριθμός πληρωμένων μηνών */
  paidMonths: number;
  /** Αριθμός εκπρόθεσμων μηνών */
  overdueMonths: number;
}

// ============================================================================
// EFKA NOTIFICATION
// ============================================================================

// ============================================================================
// PARTNERSHIP EFKA SUMMARY — ΟΕ per-partner
// ============================================================================

/** Σύνοψη ΕΦΚΑ ανά εταίρο */
export interface PartnerEFKASummary {
  partnerId: string;
  partnerName: string;
  summary: EFKAAnnualSummary;
}

/** Σύνοψη ΕΦΚΑ ΟΕ (σύνολα + ανά εταίρο) */
export interface PartnershipEFKASummary {
  year: number;
  partnerSummaries: PartnerEFKASummary[];
  totalAllPartnersPaid: number;
  totalAllPartnersDue: number;
}

// ============================================================================
// EPE EFKA SUMMARY — ΕΠΕ per-manager
// ============================================================================

/** Σύνοψη ΕΦΚΑ ανά διαχειριστή ΕΠΕ */
export interface ManagerEFKASummary {
  memberId: string;
  memberName: string;
  summary: EFKAAnnualSummary;
}

/** Σύνοψη ΕΦΚΑ ΕΠΕ (μόνο διαχειριστές, σύνολα) */
export interface EPEEFKASummary {
  year: number;
  managerSummaries: ManagerEFKASummary[];
  totalAllManagersPaid: number;
  totalAllManagersDue: number;
}

// ============================================================================
// EFKA NOTIFICATION
// ============================================================================

// ============================================================================
// AE EFKA SUMMARY — ΑΕ Board Member EFKA (Dual-Mode)
// ============================================================================

/**
 * ΕΦΚΑ μέλους ΔΣ ΑΕ — Employee mode (μισθωτός)
 *
 * Όταν μέλος ΔΣ κατέχει <3% μετοχών και λαμβάνει αμοιβή.
 * Εισφορές: 33,60% (12,47% ασφαλισμένος + 21,13% εργοδότης)
 *
 * @see Εγκύκλιος ΕΦΚΑ 4/2017, 17/2017
 */
export interface EmployeeBoardMemberEFKA {
  /** ID μετόχου */
  shareholderId: string;
  /** Ονοματεπώνυμο */
  shareholderName: string;
  /** Μηνιαία αμοιβή ΔΣ */
  monthlyCompensation: number;
  /** Εισφορά ασφαλισμένου (12,47% × αμοιβή × 12) */
  employeeContribution: number;
  /** Εισφορά εργοδότη (21,13% × αμοιβή × 12) */
  employerContribution: number;
  /** Ετήσιο σύνολο ΕΦΚΑ */
  totalAnnual: number;
}

/**
 * Σύνοψη ΕΦΚΑ ΑΕ (dual-mode: employee + self-employed)
 *
 * @see ADR-ACC-017 Board of Directors & EFKA
 */
export interface AEEFKASummary {
  /** Φορολογικό έτος */
  year: number;
  /** Μέλη ΔΣ σε καθεστώς μισθωτού (<3% μετοχών) */
  employeeBoardMembers: EmployeeBoardMemberEFKA[];
  /** Μέλη ΔΣ σε καθεστώς αυτοαπασχολούμενου (≥3% μετοχών) — reuse ManagerEFKASummary */
  selfEmployedBoardMembers: ManagerEFKASummary[];
  /** Σύνολο ΕΦΚΑ εργοδότη (employee board members) */
  totalEmployeeEFKA: number;
  /** Σύνολο ΕΦΚΑ αυτοαπασχολούμενων */
  totalSelfEmployedEFKA: number;
  /** Γενικό σύνολο ΕΦΚΑ ΑΕ */
  totalAllEFKA: number;
}

// ============================================================================
// EFKA NOTIFICATION
// ============================================================================

/** Τύπος ειδοποίησης ΕΦΚΑ */
export type EFKANotificationType = 'payment_due' | 'payment_overdue' | 'keao_warning' | 'rate_change';

/**
 * Ειδοποίηση/Υπενθύμιση ΕΦΚΑ
 *
 * Ενημερώνει τον χρήστη για πληρωμές, προθεσμίες, αλλαγές.
 */
export interface EFKANotification {
  /** Μοναδικό ID */
  notificationId: string;
  /** Τύπος ειδοποίησης */
  type: EFKANotificationType;
  /** Τίτλος */
  title: string;
  /** Μήνυμα */
  message: string;
  /** Ημερομηνία αναφοράς (π.χ. λήξη πληρωμής) */
  referenceDate: string;
  /** Ποσό αναφοράς (αν σχετίζεται με πληρωμή) */
  referenceAmount: number | null;
  /** Αναγνώστηκε; */
  isRead: boolean;
  /** Ημερομηνία δημιουργίας (ISO 8601) */
  createdAt: string;
}
