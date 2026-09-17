/**
 * @fileoverview **ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ ΚΑΤΑΛΥΜΑΤΟΣ** — βάση ανά ακίνητο + υπερβάσεις ανά ημερομηνία.
 * @related ADR-835 §21 (Στάδιο Β) · types/stay-calendar.ts · lib/stay/stay-rules.ts ·
 *   types/property-offers.ts (`ShortLeaseOffer`)
 * @module types/stay-rules
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΣΤΡΩΜΑΤΑ — Η ΠΡΑΚΤΙΚΗ ΤΗΣ ΑΓΟΡΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Στρώμα | Πού ζει | Πρότυπο |
 * |---|---|---|
 * | {@link StayRules} — βάση | `stay_calendars/{propertyId}.rules` | Airbnb «Availability settings» |
 * | {@link StayDayRule} — ανά ημερομηνία | `stay_calendar_days/{propertyId}_{YYYY-MM}` | Booking.com extranet (min LOS · No arrivals · No departures · τιμή ανά ημέρα) |
 *
 * ⛔ **ΚΑΝΕΝΑ `minNights` / `nightlyRate` / `maxGuests` ΣΤΗ ΒΑΣΗ.** Είναι **δημοσιευμένοι
 * όροι** της διάθεσης (`ShortLeaseOffer`), προβάλλονται στο `PublicListing.stay` και στην
 * κάρτα. Δεύτερο πεδίο εδώ θα ήταν δύο αλήθειες για την ίδια ερώτηση — η μέρα που θα
 * διαφωνούσαν είναι ερώτημα **πότε**, όχι **αν**.
 *
 * 🔑 **Οι ελάχιστες/μέγιστες νύχτες κρίνονται ΑΝΑ ΗΜΕΡΑ ΑΦΙΞΗΣ** («min stay arrival»), όχι
 * «through». Όλα τα κανάλια δέχονται την πρώτη (Channex · Guesty), η Airbnb τη χρησιμοποιεί,
 * και το Στάδιο Γ (iCal/κανάλια) τη χρειάζεται για να μη λέμε κάτι που δεν μεταφέρεται.
 *
 * **Layering**: leaf — τύποι + σταθερές.
 */

import type { IsoWeekday } from '@/lib/calendar/weekly-hours';
import { ISO_WEEKDAYS } from '@/lib/calendar/weekly-hours';
import type { MinorAmount } from '@/lib/money/money';

// =============================================================================
// 1. ΟΙ ΚΛΕΙΣΤΕΣ ΤΙΜΕΣ — όπως τις προσφέρει η αγορά
// =============================================================================

/** Ημέρες ειδοποίησης (Airbnb: same day · 1 · 2 · 3 · 7). */
export const STAY_ADVANCE_NOTICE_DAYS = [0, 1, 2, 3, 7] as const;
export type StayAdvanceNoticeDays = (typeof STAY_ADVANCE_NOTICE_DAYS)[number];

/** Νύχτες προετοιμασίας πριν/μετά από κάθε διαμονή (Airbnb: 0 · 1 · 2). */
export const STAY_PREPARATION_NIGHTS = [0, 1, 2] as const;
export type StayPreparationNights = (typeof STAY_PREPARATION_NIGHTS)[number];

/** Πόσους μήνες μπροστά δέχεται κρατήσεις (Airbnb: 3 · 6 · 9 · 12 · 24). */
export const STAY_AVAILABILITY_WINDOW_MONTHS = [3, 6, 9, 12, 24] as const;
export type StayAvailabilityWindowMonths = (typeof STAY_AVAILABILITY_WINDOW_MONTHS)[number];

/** Μέγιστο μήκος «ορφανού» κενού που χαλαρώνει τις ελάχιστες νύχτες (PriceLabs: 1–3). */
export const STAY_ORPHAN_GAP_NIGHTS = [1, 2, 3] as const;
export type StayOrphanGapNights = (typeof STAY_ORPHAN_GAP_NIGHTS)[number];

/** Άνω όριο για νύχτες σε κανόνα (μία διαμονή βραχυχρόνιας δεν ξεπερνά το έτος). */
export const STAY_RULE_MAX_NIGHTS = 365;

/** Τελευταία ώρα αποκοπής «ίδιας μέρας» (0–23, ώρα Αθήνας). */
export const STAY_CUTOFF_HOUR_MAX = 23;

// =============================================================================
// 2. Η ΒΑΣΗ
// =============================================================================

/**
 * **Προειδοποίηση πριν την άφιξη.**
 *
 * `days: 0` + `sameDayCutoffHour: 18` ⇒ κράτηση για σήμερα ως τις 18:00 ώρα Αθήνας. Το
 * `sameDayCutoffHour` έχει νόημα **μόνο** όταν `days === 0` — αλλιώς είναι `null`.
 */
export interface StayAdvanceNotice {
  readonly days: StayAdvanceNoticeDays;
  readonly sameDayCutoffHour: number | null;
}

/** Χαλάρωση ελαχίστων νυχτών μέσα σε μικρά κενά ανάμεσα σε κατειλημμένες νύχτες. */
export interface StayOrphanGapRule {
  readonly maxNights: StayOrphanGapNights;
}

/**
 * **Οι κανόνες βάσης** — ισχύουν για κάθε ημέρα, εκτός αν μια {@link StayDayRule} πει άλλο.
 *
 * ⚠️ **`null` = «δεν περιορίζει»**, με όνομα και όχι σιωπηλή προεπιλογή: `maxNights: null`
 * είναι «καμία μέγιστη», `availabilityWindowMonths: null` είναι «χωρίς όριο».
 */
export interface StayRules {
  readonly maxNights: number | null;
  readonly advanceNotice: StayAdvanceNotice;
  readonly preparationNights: StayPreparationNights;
  readonly availabilityWindowMonths: StayAvailabilityWindowMonths | null;
  /** Μέρες εβδομάδας που επιτρέπεται **άφιξη**. Ποτέ κενό (αλλιώς δεν κρατιέται ποτέ). */
  readonly arrivalWeekdays: readonly IsoWeekday[];
  /** Μέρες εβδομάδας που επιτρέπεται **αναχώρηση**. Ποτέ κενό. */
  readonly departureWeekdays: readonly IsoWeekday[];
  readonly orphanGap: StayOrphanGapRule | null;
}

/**
 * **Κανένας περιορισμός** — η ονομασμένη απάντηση για κεφαλή που δεν όρισε ποτέ κανόνες.
 *
 * 🔑 Ειδοποίηση `0` χωρίς αποκοπή = «και σήμερα», όπως ίσχυε ως το Στάδιο Α (κανένας κανόνας).
 */
export const STAY_RULES_NONE: StayRules = {
  maxNights: null,
  advanceNotice: { days: 0, sameDayCutoffHour: null },
  preparationNights: 0,
  availabilityWindowMonths: null,
  arrivalWeekdays: ISO_WEEKDAYS,
  departureWeekdays: ISO_WEEKDAYS,
  orphanGap: null,
};

// =============================================================================
// 3. ΑΝΑ ΗΜΕΡΟΜΗΝΙΑ
// =============================================================================

/**
 * **Υπέρβαση για ΜΙΑ ημερομηνία** — κάθε πεδίο απών = «ισχύει η βάση».
 *
 * - `minNights` / `maxNights`: για διαμονή που **ξεκινά** αυτή τη μέρα.
 * - `closedToArrival`: δεν ξεκινά διαμονή αυτή τη μέρα.
 * - `closedToDeparture`: δεν τελειώνει διαμονή αυτή τη μέρα (η μέρα **αναχώρησης**, όχι νύχτα).
 * - `nightlyRateMinor`: τιμή **της νύχτας** που ξεκινά αυτή τη μέρα, σε λεπτά.
 */
export interface StayDayRule {
  readonly minNights?: number;
  readonly maxNights?: number;
  readonly closedToArrival?: true;
  readonly closedToDeparture?: true;
  readonly nightlyRateMinor?: MinorAmount;
}

/** Τα πεδία μιας {@link StayDayRule} — το κλειστό σύνολο για «καθάρισε». */
export const STAY_DAY_RULE_FIELDS = [
  'minNights',
  'maxNights',
  'closedToArrival',
  'closedToDeparture',
  'nightlyRateMinor',
] as const satisfies readonly (keyof StayDayRule)[];

export type StayDayRuleField = (typeof STAY_DAY_RULE_FIELDS)[number];

/** Οι υπερβάσεις όλων των ημερών, με κλειδί `YYYY-MM-DD`. */
export type StayDayRules = Readonly<Record<string, StayDayRule>>;

/**
 * **Το αποθηκευμένο έγγραφο ενός μήνα** — `stay_calendar_days/{propertyId}_{YYYY-MM}`.
 *
 * Γιατί ανά μήνα και όχι έγγραφα-εύρη: η ρύθμιση μιας ημέρας **αντικαθιστά** την
 * προηγούμενη (σημασιολογία extranet), χωρίς αμφισημία επικαλυπτόμενων ευρών· ≤31
 * καταχωρίσεις ανά έγγραφο· μια συναλλαγή αγγίζει μόνο τους μήνες της επιλογής.
 */
export interface StayCalendarMonth {
  readonly propertyId: string;
  readonly authorUserId: string;
  /** `YYYY-MM`. */
  readonly month: string;
  readonly days: StayDayRules;
  readonly updatedAt: string;
}

// =============================================================================
// 4. ΤΟ «ΤΩΡΑ» ΩΣ ΕΙΣΟΔΟΣ
// =============================================================================

/**
 * **Η στιγμή της ερώτησης, στη ζώνη του καταλύματος.** Οι καθαρές μηχανές δεν διαβάζουν
 * ρολόι· ο διακομιστής το δίνει από το `athensClockAt`.
 */
export interface StayClock {
  /** `YYYY-MM-DD` — σήμερα, ώρα Αθήνας. */
  readonly today: string;
  /** Λεπτά από τα μεσάνυχτα Αθήνας (0–1439). */
  readonly minutes: number;
}

/** Ό,τι χρειάζεται η μηχανή για να κρίνει κανόνες — μαζί, ποτέ μισό. */
export interface StayRulesInput {
  readonly rules: StayRules;
  readonly days: StayDayRules;
  readonly clock: StayClock;
}
