/**
 * @fileoverview Accounting Subapp — VAT Engine Types
 * @description Τύποι για τον υπολογισμό ΦΠΑ (Φόρου Προστιθέμενης Αξίας)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ExpenseCategory, FiscalQuarter, PeriodRange } from './common';

// ============================================================================
// VAT RATE DEFINITIONS
// ============================================================================

/**
 * Συντελεστής ΦΠΑ
 *
 * Ελληνικοί συντελεστές ΦΠΑ:
 * - 24% (κανονικός)
 * - 13% (μειωμένος)
 * - 6% (υπερμειωμένος)
 * - 0% (απαλλαγή)
 */
export interface VATRate {
  /** Μοναδικός κωδικός (π.χ. 'standard_24', 'reduced_13') */
  code: string;
  /** Ποσοστό ΦΠΑ (24, 13, 6, 0) */
  rate: number;
  /** Κατηγορία myDATA ΦΠΑ (1=24%, 2=13%, 3=6%, 8=0%) */
  mydataCategory: number;
  /** Ετικέτα εμφάνισης (π.χ. 'Κανονικός 24%') */
  label: string;
  /** Ημερομηνία έναρξης ισχύος (ISO 8601) */
  validFrom: string;
  /** Ημερομηνία λήξης ισχύος (ISO 8601, null αν ισχύει ακόμα) */
  validTo: string | null;
}

// ============================================================================
// VAT DEDUCTIBILITY RULES
// ============================================================================

/**
 * Κανόνας εκπτωσιμότητας ΦΠΑ ανά κατηγορία δαπάνης
 *
 * Ορισμένες κατηγορίες εξόδων δεν εκπίπτουν πλήρως τον ΦΠΑ:
 * - Καύσιμα: 100% εκπίπτει (επαγγελματικό όχημα)
 * - Ασφάλειες οχήματος: 0% (ΦΠΑ δεν εκπίπτει)
 * - Τηλεπικοινωνίες: 50% (μικτή χρήση)
 */
export interface VATDeductibilityRule {
  /** Κατηγορία δαπάνης */
  category: ExpenseCategory;
  /** Ποσοστό εκπτωσιμότητας (0-100) */
  deductiblePercent: number;
  /** Νομική βάση (π.χ. 'Ν.2859/2000 αρ.30') */
  legalBasis: string;
  /** Σημειώσεις */
  notes: string | null;
}

// ============================================================================
// VAT CALCULATION — OUTPUT (Εκροές)
// ============================================================================

/** Υπολογισμός ΦΠΑ εκροών (πώλησης/εσόδου) */
export interface VATCalculation {
  /** Καθαρό ποσό (χωρίς ΦΠΑ) */
  netAmount: number;
  /** Συντελεστής ΦΠΑ */
  vatRate: number;
  /** Ποσό ΦΠΑ */
  vatAmount: number;
  /** Μικτό ποσό (net + ΦΠΑ) */
  grossAmount: number;
}

// ============================================================================
// VAT CALCULATION — INPUT (Εισροές)
// ============================================================================

/** Υπολογισμός ΦΠΑ εισροών (δαπανών) — επεκτείνει VATCalculation */
export interface VATInputCalculation extends VATCalculation {
  /** Ποσοστό εκπτωσιμότητας (0-100) */
  deductiblePercent: number;
  /** Εκπεστέο ποσό ΦΠΑ */
  deductibleVatAmount: number;
  /** Μη εκπεστέο ποσό ΦΠΑ */
  nonDeductibleVatAmount: number;
}

// ============================================================================
// VAT RATE BREAKDOWN — Ανάλυση ανά συντελεστή
// ============================================================================

/** Ανάλυση ΦΠΑ εκροών ανά συντελεστή */
export interface VATRateBreakdown {
  /** Συντελεστής ΦΠΑ */
  vatRate: number;
  /** Σύνολο καθαρών ποσών */
  totalNetAmount: number;
  /** Σύνολο ΦΠΑ */
  totalVatAmount: number;
  /** Πλήθος εγγραφών */
  entryCount: number;
}

/** Ανάλυση ΦΠΑ εισροών ανά συντελεστή — με εκπτωσιμότητα */
export interface VATInputRateBreakdown extends VATRateBreakdown {
  /** Σύνολο εκπεστέου ΦΠΑ */
  totalDeductibleVat: number;
  /** Σύνολο μη εκπεστέου ΦΠΑ */
  totalNonDeductibleVat: number;
}

// ============================================================================
// VAT QUARTER STATUS
// ============================================================================

/**
 * Κατάσταση τριμηνιαίας δήλωσης ΦΠΑ
 *
 * - `open`: Τρέχον τρίμηνο, ακόμα δέχεται εγγραφές
 * - `calculated`: Υπολογίστηκε, αναμένει υποβολή
 * - `submitted`: Υποβλήθηκε στην ΑΑΔΕ
 * - `paid`: Πληρώθηκε
 */
export type VATQuarterStatus = 'open' | 'calculated' | 'submitted' | 'paid';

// ============================================================================
// VAT QUARTER SUMMARY — Τριμηνιαία Δήλωση
// ============================================================================

/**
 * Τριμηνιαία σύνοψη ΦΠΑ
 *
 * Η βασική μονάδα υπολογισμού ΦΠΑ στην Ελλάδα (Φ2 δήλωση).
 * Υπολογίζεται ανά τρίμηνο: Q1 (Ιαν-Μαρ), Q2 (Απρ-Ιουν), κ.λπ.
 */
export interface VATQuarterSummary {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Τρίμηνο */
  quarter: FiscalQuarter;
  /** Περίοδος */
  period: PeriodRange;
  /** Κατάσταση δήλωσης */
  status: VATQuarterStatus;

  // — Εκροές (ΦΠΑ που χρεώνουμε) —
  /** Ανάλυση ΦΠΑ εκροών ανά συντελεστή */
  outputBreakdown: VATRateBreakdown[];
  /** Σύνολο ΦΠΑ εκροών */
  totalOutputVat: number;

  // — Εισροές (ΦΠΑ που πληρώνουμε) —
  /** Ανάλυση ΦΠΑ εισροών ανά συντελεστή */
  inputBreakdown: VATInputRateBreakdown[];
  /** Σύνολο ΦΠΑ εισροών (πριν εκπτωσιμότητα) */
  totalInputVat: number;
  /** Σύνολο εκπεστέου ΦΠΑ εισροών */
  totalDeductibleInputVat: number;

  // — Υπολογισμός —
  /** ΦΠΑ προς απόδοση (output - deductibleInput) */
  vatPayable: number;
  /** Πιστωτικό υπόλοιπο (αν εισροές > εκροές) */
  vatCredit: number;

  // — Metadata —
  /** Ημερομηνία υπολογισμού (ISO 8601) */
  calculatedAt: string;
  /** Ημερομηνία υποβολής (ISO 8601, null αν δεν υποβλήθηκε) */
  submittedAt: string | null;
}

// ============================================================================
// VAT ANNUAL SUMMARY — Ετήσια Σύνοψη
// ============================================================================

/**
 * Ετήσια σύνοψη ΦΠΑ
 *
 * Περιέχει τα 4 τρίμηνα + ετήσια εκκαθάριση.
 */
export interface VATAnnualSummary {
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Τα 4 τρίμηνα */
  quarters: VATQuarterSummary[];
  /** Σύνολο ΦΠΑ εκροών (ετήσιο) */
  annualOutputVat: number;
  /** Σύνολο εκπεστέου ΦΠΑ εισροών (ετήσιο) */
  annualDeductibleInputVat: number;
  /** Ετήσιος ΦΠΑ προς απόδοση */
  annualVatPayable: number;
  /** Ετήσιο πιστωτικό υπόλοιπο */
  annualVatCredit: number;
  /** Ήδη αποδοθέν ΦΠΑ (από τριμηνιαίες δηλώσεις) */
  totalVatPaid: number;
  /** Υπόλοιπο εκκαθάρισης (payable - paid) */
  settlementAmount: number;
}
