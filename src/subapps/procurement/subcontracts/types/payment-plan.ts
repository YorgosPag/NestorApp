/**
 * @fileoverview **Σχέδιο πληρωμών — τρεις συνθέσιμοι άξονες** (ADR-928 §5.4.1, Δ4).
 * @module subapps/procurement/subcontracts/types/payment-plan
 *
 * Τι πληρώνεται (`basis`) · πότε (`schedule`) · με τι (`settlement`). Ορίζονται στο συμφωνητικό και
 * **υπερβαίνονται ανά γραμμή** (Procore: κράτηση ανά γραμμή). Το κείμενο του εγγράφου («κάθε 15 ημέρες, τη 2η
 * Παρασκευή…») **παράγεται** από αυτά τα δεδομένα, ώστε κείμενο και υπολογισμός να μη διαφωνούν ποτέ.
 *
 * ⚖️ Κανένας αριθμός νόμου εδώ: το όριο μετρητών (500 € σήμερα) είναι **παράμετρος ρήτρας** της εταιρείας,
 * όχι σταθερά κώδικα (ADR-928 §4 «κανόνας σχεδίασης»).
 */

import type { MinorAmount } from '@/lib/money/money';
import type { BasisPoints } from '@/lib/pricing/discount-rule';
import type { IsoWeekday } from '@/lib/calendar/weekly-hours';
import type { ProjectMilestoneKey } from './clause-parameter';

// ── Άξονας 1 — τι πληρώνεται ────────────────────────────────────────────────

export const PAYMENT_BASES = [
  'measured_progress',      // επιμετρημένες ποσότητες × τιμή μονάδας
  'stage_completion',       // ποσοστό ανά στάδιο της γραμμής
  'milestone',              // σταθερό ποσό ή % με την επίτευξη ορόσημου
  'time_and_materials',     // ημερομίσθια/ώρες × τιμή (απολογιστικά)
  'labor_advance_capped',   // προκαταβολή μεροκάματα × ημερομίσθιο, με ανώτατο το παραχθέν
  'lump_sum_on_completion', // όλο το ποσό με το πέρας
  'advance_payment',        // προκαταβολή με συμψηφισμό
] as const;
export type PaymentBasis = (typeof PAYMENT_BASES)[number];

export interface MilestonePayment {
  readonly milestone: ProjectMilestoneKey;
  /** Ακριβώς ένα από τα δύο. */
  readonly amount: { readonly kind: 'fixed'; readonly value: MinorAmount } | { readonly kind: 'percent'; readonly value: BasisPoints };
}

export interface AdvancePaymentTerms {
  readonly amount: MinorAmount;
  /** Συμψηφισμός: ποσοστό ανά λογαριασμό, ή όλο στην εκκαθάριση. */
  readonly recovery: { readonly kind: 'per_payment'; readonly rate: BasisPoints } | { readonly kind: 'on_final' };
}

// ── Άξονας 2 — πότε πληρώνεται ──────────────────────────────────────────────

export const RECURRENCE_UNITS = ['day', 'week', 'month'] as const;
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number];

/** Άγκυρα επανάληψης: «κάθε 2η Παρασκευή» · «στις 5 και στις 20» · «από την ημερομηνία έναρξης». */
export type RecurrenceAnchor =
  | { readonly kind: 'weekday'; readonly weekday: IsoWeekday }
  | { readonly kind: 'month_days'; readonly days: readonly number[] }
  | { readonly kind: 'start_date' };

/** Αργία ή Κυριακή ⇒ προηγούμενη / επόμενη εργάσιμη (ελληνικό ημερολόγιο, κινητές εορτές του Πάσχα). */
export const HOLIDAY_SHIFTS = ['previous_business_day', 'next_business_day', 'none'] as const;
export type HolidayShift = (typeof HOLIDAY_SHIFTS)[number];

export type PaymentSchedule =
  | { readonly kind: 'on_completion' }
  | { readonly kind: 'on_milestones' }
  | { readonly kind: 'on_request' }
  | {
      readonly kind: 'recurring';
      readonly every: number;
      readonly unit: RecurrenceUnit;
      readonly anchor: RecurrenceAnchor;
      readonly holidayShift: HolidayShift;
    };

/** Το συμβάν της εκκαθάρισης (τελικής πληρωμής). */
export type FinalSettlementTrigger =
  | { readonly kind: 'milestone'; readonly milestone: ProjectMilestoneKey }
  | { readonly kind: 'final_acceptance' }
  | { readonly kind: 'days_after_completion'; readonly days: number };

// ── Άξονας 3 — με τι πληρώνεται ─────────────────────────────────────────────

export const SETTLEMENT_INSTRUMENTS = ['bank_transfer', 'cheque', 'cash', 'set_off'] as const;
export type SettlementInstrument = (typeof SETTLEMENT_INSTRUMENTS)[number];

/** Μερίδιο πληρωμής. Τα μερίδια ενός σχεδίου αθροίζουν **ακριβώς** 10.000 μονάδες βάσης (100%). */
export interface SettlementShare {
  readonly instrument: SettlementInstrument;
  readonly share: BasisPoints;
  /** Μόνο για `cheque`: ημέρες λήξης (π.χ. 120 = «επιταγή 4 μηνών»). */
  readonly chequeMaturityDays?: number;
}

export interface SettlementPlan {
  /** Ανά πληρωμή. */
  readonly regular: readonly SettlementShare[];
  /** Μόνο για την εκκαθάριση· `null` = ίδιο με το `regular`. */
  readonly final: readonly SettlementShare[] | null;
}

// ── Κράτηση καλής εκτέλεσης ─────────────────────────────────────────────────

/** Δόση απόδοσης της κράτησης (π.χ. 50% στην προσωρινή παραλαβή, 50% 12 μήνες μετά). */
export interface RetentionReleaseInstallment {
  readonly share: BasisPoints;
  readonly trigger:
    | { readonly kind: 'provisional_acceptance' }
    | { readonly kind: 'final_acceptance' }
    | { readonly kind: 'months_after'; readonly event: 'provisional_acceptance' | 'final_acceptance'; readonly months: number };
}

export interface RetentionTerms {
  readonly rate: BasisPoints;
  readonly release: readonly RetentionReleaseInstallment[];
}

// ── Το σχέδιο ───────────────────────────────────────────────────────────────

export interface PaymentPlan {
  readonly basis: PaymentBasis;
  readonly schedule: PaymentSchedule;
  readonly finalSettlement: FinalSettlementTrigger;
  readonly settlement: SettlementPlan;
  /** «Ποτέ πάνω από το παραχθέν έργο» (2009) — καθολικός, ρυθμιζόμενος. */
  readonly capAtEarnedValue: boolean;
  readonly milestones: readonly MilestonePayment[];
  readonly advance: AdvancePaymentTerms | null;
  readonly retention: RetentionTerms | null;
}

/** Υπέρβαση ανά γραμμή — μόνο ό,τι αλλάζει· τα υπόλοιπα κληρονομούνται από το συμφωνητικό. */
export type PaymentPlanLineOverride = Partial<Pick<PaymentPlan, 'basis' | 'retention' | 'capAtEarnedValue'>>;
