/**
 * @fileoverview Accounting Subapp — Entity Type & Partner Types
 * @description Τύποι για μορφές επιχείρησης (Ατομική, ΟΕ, ΕΠΕ, ΑΕ) & εταίρους
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ============================================================================
// ENTITY TYPES — Μορφές Επιχείρησης
// ============================================================================

/**
 * Τύπος νομικής μορφής επιχείρησης
 *
 * - `sole_proprietor`: Ατομική Επιχείρηση
 * - `oe`: Ομόρρυθμη Εταιρεία (General Partnership)
 * - `epe`: Εταιρεία Περιορισμένης Ευθύνης (Ltd) — μελλοντικό
 * - `ae`: Ανώνυμη Εταιρεία (SA) — μελλοντικό
 */
export type EntityType = 'sole_proprietor' | 'oe' | 'epe' | 'ae';

// ============================================================================
// PARTNER EFKA CONFIG — Ρυθμίσεις ΕΦΚΑ ανά Εταίρο
// ============================================================================

/**
 * Ρυθμίσεις ΕΦΚΑ ανά εταίρο
 *
 * Κάθε εταίρος ΟΕ επιλέγει ξεχωριστή κατηγορία ΕΦΚΑ.
 */
export interface PartnerEFKAConfig {
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
// PARTNER — Εταίρος ΟΕ
// ============================================================================

/**
 * Εταίρος Ομόρρυθμης Εταιρείας
 *
 * Κάθε εταίρος ΟΕ φορολογείται ξεχωριστά (pass-through).
 * Firestore path: `accounting_settings/partners`
 */
// ============================================================================
// MEMBER EFKA CONFIG — Ρυθμίσεις ΕΦΚΑ ανά Μέλος ΕΠΕ (διαχειριστές μόνο)
// ============================================================================

/**
 * Ρυθμίσεις ΕΦΚΑ ανά διαχειριστή ΕΠΕ
 *
 * Μόνο οι διαχειριστές (isManager=true) έχουν υποχρέωση ΕΦΚΑ.
 * Ίδια δομή με PartnerEFKAConfig (reuse pattern).
 */
export interface MemberEFKAConfig {
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
// MEMBER — Μέλος ΕΠΕ
// ============================================================================

/**
 * Μέλος Εταιρείας Περιορισμένης Ευθύνης
 *
 * Κάθε μέλος ΕΠΕ κατέχει μερίδια (shares) & δικαιούται μερίσματα.
 * Μόνο οι διαχειριστές (isManager=true) πληρώνουν ΕΦΚΑ.
 * Firestore path: `accounting_settings/members`
 */
export interface Member {
  /** Μοναδικό ID μέλους ('mbr_xxxxx') */
  memberId: string;
  /** Ονοματεπώνυμο μέλους */
  fullName: string;
  /** Προσωπικό ΑΦΜ μέλους */
  vatNumber: string;
  /** ΔΟΥ μέλους */
  taxOffice: string;
  /** Αριθμός μεριδίων */
  sharesCount: number;
  /** Ονομαστική αξία ανά μερίδιο (EUR) */
  shareNominalValue: number;
  /** Κεφαλαιακή εισφορά = sharesCount × shareNominalValue */
  capitalContribution: number;
  /** Ποσοστό μερισμάτων (0-100, βάσει μεριδίων) */
  dividendSharePercent: number;
  /** Είναι διαχειριστής; (true = ΕΦΚΑ υποχρέωση) */
  isManager: boolean;
  /** Ρυθμίσεις ΕΦΚΑ (null αν passive member) */
  efkaConfig: MemberEFKAConfig | null;
  /** Πρώτα 5 χρόνια δραστηριότητας; (μειωμένη προκαταβολή) */
  isFirstFiveYears: boolean;
  /** Ημερομηνία εισόδου (ISO 8601) */
  joinDate: string;
  /** Ημερομηνία εξόδου (ISO 8601, null αν ενεργός) */
  exitDate: string | null;
  /** Ενεργό μέλος */
  isActive: boolean;
}

// ============================================================================
// PARTNER — Εταίρος ΟΕ
// ============================================================================

// ============================================================================
// SHAREHOLDER EFKA CONFIG — Ρυθμίσεις ΕΦΚΑ ανά Μέτοχο ΑΕ (self-employed mode)
// ============================================================================

/**
 * Ρυθμίσεις ΕΦΚΑ μετόχου ΑΕ (self-employed mode)
 *
 * Ίδια δομή με MemberEFKAConfig / PartnerEFKAConfig.
 * Χρησιμοποιείται μόνο όταν efkaMode = 'self_employed'.
 */
export interface ShareholderEFKAConfig {
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
// BOARD ROLE — Ρόλος στο Διοικητικό Συμβούλιο
// ============================================================================

/** Ρόλος μέλους ΔΣ */
export type BoardRole = 'president' | 'vice_president' | 'ceo' | 'member';

/** Καθεστώς ΕΦΚΑ μετόχου ΑΕ */
export type ShareholderEFKAMode = 'employee' | 'self_employed' | 'none';

// ============================================================================
// SHAREHOLDER — Μέτοχος ΑΕ
// ============================================================================

/**
 * Μέτοχος Ανώνυμης Εταιρείας
 *
 * Ενοποιεί μέτοχο + μέλος ΔΣ σε μία εγγραφή.
 * Αν χρειαστεί μέλος ΔΣ χωρίς μετοχές → sharesCount = 0.
 *
 * ΕΦΚΑ Dual-Mode:
 * - employee: isBoardMember && compensation > 0 && shares < 3% συνόλου
 * - self_employed: isBoardMember && compensation > 0 && shares ≥ 3%
 * - none: !isBoardMember || compensation === 0/null
 *
 * @see ADR-ACC-015 AE Setup & Shareholders
 * @see Εγκύκλιοι ΕΦΚΑ 4/2017, 17/2017, Ν.4548/2018
 */
export interface Shareholder {
  /** Μοναδικό ID μετόχου ('shr_xxxxx') */
  shareholderId: string;
  /** Ονοματεπώνυμο μετόχου */
  fullName: string;
  /** Προσωπικό ΑΦΜ μετόχου */
  vatNumber: string;
  /** ΔΟΥ μετόχου */
  taxOffice: string;
  /** Αριθμός μετοχών */
  sharesCount: number;
  /** Ονομαστική αξία μετοχής (€/μετοχή) */
  shareNominalValue: number;
  /** Κεφαλαιακή εισφορά = sharesCount × shareNominalValue */
  capitalContribution: number;
  /** Ποσοστό μερισμάτων (0-100) */
  dividendSharePercent: number;
  /** Είναι μέλος ΔΣ; */
  isBoardMember: boolean;
  /** Ρόλος στο ΔΣ (null αν δεν είναι μέλος) */
  boardRole: BoardRole | null;
  /** Μηνιαία αμοιβή ΔΣ (null αν δεν αμείβεται) */
  monthlyCompensation: number | null;
  /** Καθεστώς ΕΦΚΑ (auto-calculated based on board + shares + compensation) */
  efkaMode: ShareholderEFKAMode;
  /** Ρυθμίσεις ΕΦΚΑ (μόνο self-employed mode) */
  efkaConfig: ShareholderEFKAConfig | null;
  /** Πρώτα 5 χρόνια δραστηριότητας; (μειωμένη προκαταβολή) */
  isFirstFiveYears: boolean;
  /** Ημερομηνία εισόδου (ISO 8601) */
  joinDate: string;
  /** Ημερομηνία εξόδου (ISO 8601, null αν ενεργός) */
  exitDate: string | null;
  /** Ενεργός μέτοχος */
  isActive: boolean;
}

// ============================================================================
// PARTNER — Εταίρος ΟΕ
// ============================================================================

export interface Partner {
  /** Μοναδικό ID εταίρου ('prt_xxxxx') */
  partnerId: string;
  /** Ονοματεπώνυμο εταίρου */
  fullName: string;
  /** Προσωπικό ΑΦΜ εταίρου */
  vatNumber: string;
  /** ΔΟΥ εταίρου */
  taxOffice: string;
  /** Ποσοστό συμμετοχής στα κέρδη (0-100, σύνολο = 100) */
  profitSharePercent: number;
  /** Ρυθμίσεις ΕΦΚΑ εταίρου */
  efkaConfig: PartnerEFKAConfig;
  /** Πρώτα 5 χρόνια δραστηριότητας; (μειωμένη προκαταβολή) */
  isFirstFiveYears: boolean;
  /** Ημερομηνία εισόδου (ISO 8601) */
  joinDate: string;
  /** Ημερομηνία εξόδου (ISO 8601, null αν ενεργός) */
  exitDate: string | null;
  /** Ενεργός εταίρος */
  isActive: boolean;
}
