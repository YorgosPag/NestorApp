/**
 * @fileoverview **ΕΙΝΑΙ ΑΥΤΟ ΚΑΝΟΝΑΣ;** — ο ΕΝΑΣ έλεγχος σχήματος για σώμα αιτήματος ΚΑΙ έγγραφο.
 * @related ADR-835 §21 · types/stay-rules.ts · lib/stay/stay-calendar-command.ts ·
 *   lib/stay/stay-calendar-from-document.ts
 * @module lib/stay/stay-rules-shape
 *
 * 🔑 **Μία διατύπωση, δύο σύνορα.** Το σώμα της πράξης `rules` και το αποθηκευμένο πεδίο
 * `stay_calendars.rules` κρίνονται από τις **ίδιες** συναρτήσεις: αλλιώς ο διακομιστής θα
 * μπορούσε να γράψει κάτι που ο ίδιος αργότερα διαβάζει ως χαλασμένο (⇒ `unreadable`).
 *
 * ⚠️ **Αυστηρό**: κάθε άγνωστη τιμή ⇒ `null`. Ποτέ «διόρθωση» (π.χ. κενές μέρες άφιξης ⇒
 * «όλες»): ένας κανόνας που δεν διαβάζεται **δεν** είναι «κανένας κανόνας».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { isMinorAmount, type MinorAmount } from '@/lib/money/money';
import { isRecord } from '@/lib/type-guards';
import {
  ISO_WEEKDAYS,
  normalizeWeeklyHours,
  readWeeklyHours,
  type IsoWeekday,
  type WeeklyHours,
} from '@/lib/calendar/weekly-hours';
import {
  STAY_ADVANCE_NOTICE_DAYS,
  STAY_AVAILABILITY_WINDOW_MONTHS,
  STAY_CUTOFF_HOUR_MAX,
  STAY_DAY_RULE_FIELDS,
  STAY_ORPHAN_GAP_NIGHTS,
  STAY_PREPARATION_NIGHTS,
  STAY_RULE_MAX_NIGHTS,
  type StayAdvanceNotice,
  type StayDayRule,
  type StayOrphanGapRule,
  type StayRules,
} from '@/types/stay-rules';

/** Άνω όριο τιμής νύχτας: 100.000 € — πέρα από αυτό είναι λάθος πληκτρολόγησης. */
export const STAY_NIGHTLY_RATE_MAX_MINOR: MinorAmount = 10_000_000;

function oneOf<T extends number>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'number' && (values as readonly number[]).includes(value);
}

/** Ακέραιες νύχτες κανόνα: 1..365. */
export function isRuleNights(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= STAY_RULE_MAX_NIGHTS;
}

function nullableRuleNights(value: unknown): number | null | undefined {
  if (value === null) return null;
  return isRuleNights(value) ? value : undefined;
}

/** Μέρες εβδομάδας: μη κενό, χωρίς διπλότυπα, ταξινομημένο 1..7. */
function weekdaysFrom(value: unknown): readonly IsoWeekday[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 7) return null;
  const set = new Set<number>();
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > 7) return null;
    set.add(item);
  }
  if (set.size !== value.length) return null;
  return [...set].sort((a, b) => a - b) as IsoWeekday[];
}

function advanceNoticeFrom(value: unknown): StayAdvanceNotice | null {
  if (!isRecord(value) || !oneOf(STAY_ADVANCE_NOTICE_DAYS, value.days)) return null;
  const cutoff = value.sameDayCutoffHour;
  if (cutoff === null) return { days: value.days, sameDayCutoffHour: null };
  // Η αποκοπή έχει νόημα ΜΟΝΟ για «ίδια μέρα».
  if (value.days !== 0) return null;
  if (typeof cutoff !== 'number' || !Number.isInteger(cutoff) || cutoff < 0 || cutoff > STAY_CUTOFF_HOUR_MAX) {
    return null;
  }
  return { days: 0, sameDayCutoffHour: cutoff };
}

/**
 * **Ώρες απόκρισης** (Στάδιο Δ, §23.3). 🔑 **Απών ⇒ `null`**, όχι παραβίαση: κάθε κεφαλή γραμμένη
 * πριν το Στάδιο Δ δεν έχει το πεδίο, και ένα `undefined ⇒ άκυρο` θα έκανε **κάθε υπάρχον
 * ημερολόγιο `unreadable`**. Παρόν ⇒ ο **ΙΔΙΟΣ** κριτής ωραρίου (`readWeeklyHours`), ποτέ δεύτερος.
 * Κανένα άνοιγμα σε όλη την εβδομάδα ⇒ άκυρο: «δεν απαντώ ποτέ» δεν είναι ωράριο.
 */
function responseHoursFrom(value: unknown): WeeklyHours | null | undefined {
  if (value === undefined || value === null) return null;
  const hours = readWeeklyHours(value);
  if (hours === null || ISO_WEEKDAYS.every((weekday) => hours[weekday].length === 0)) return undefined;
  return normalizeWeeklyHours(hours);
}

function orphanGapFrom(value: unknown): StayOrphanGapRule | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !oneOf(STAY_ORPHAN_GAP_NIGHTS, value.maxNights)) return undefined;
  return { maxNights: value.maxNights };
}

/** **Οι κανόνες βάσης** από άγνωστη τιμή — ή `null` αν οτιδήποτε δεν στέκει. */
export function stayRulesFrom(raw: unknown): StayRules | null {
  if (!isRecord(raw)) return null;
  const maxNights = nullableRuleNights(raw.maxNights);
  const advanceNotice = advanceNoticeFrom(raw.advanceNotice);
  const arrivalWeekdays = weekdaysFrom(raw.arrivalWeekdays);
  const departureWeekdays = weekdaysFrom(raw.departureWeekdays);
  const orphanGap = orphanGapFrom(raw.orphanGap);
  const responseHours = responseHoursFrom(raw.responseHours);
  const window = raw.availabilityWindowMonths;
  if (maxNights === undefined || advanceNotice === null || orphanGap === undefined) return null;
  if (responseHours === undefined) return null;
  if (arrivalWeekdays === null || departureWeekdays === null) return null;
  if (!oneOf(STAY_PREPARATION_NIGHTS, raw.preparationNights)) return null;
  if (window !== null && !oneOf(STAY_AVAILABILITY_WINDOW_MONTHS, window)) return null;
  return {
    maxNights,
    advanceNotice,
    preparationNights: raw.preparationNights,
    availabilityWindowMonths: window,
    arrivalWeekdays,
    departureWeekdays,
    orphanGap,
    responseHours,
  };
}

/**
 * **Μία υπέρβαση ημέρας** — ή `null`. Κάθε πεδίο προαιρετικό· **κανένα** άγνωστο πεδίο.
 * Ελάχιστο > μέγιστο στην ίδια μέρα ⇒ `null` (αντίφαση, όχι κανόνας).
 */
export function stayDayRuleFrom(raw: unknown): StayDayRule | null {
  if (!isRecord(raw)) return null;
  const known: readonly string[] = STAY_DAY_RULE_FIELDS;
  if (Object.keys(raw).some((key) => !known.includes(key))) return null;
  const { minNights, maxNights, closedToArrival, closedToDeparture, nightlyRateMinor } = raw;
  if (minNights !== undefined && !isRuleNights(minNights)) return null;
  if (maxNights !== undefined && !isRuleNights(maxNights)) return null;
  if (closedToArrival !== undefined && closedToArrival !== true) return null;
  if (closedToDeparture !== undefined && closedToDeparture !== true) return null;
  if (nightlyRateMinor !== undefined) {
    if (!isMinorAmount(nightlyRateMinor) || nightlyRateMinor > STAY_NIGHTLY_RATE_MAX_MINOR) return null;
  }
  if (typeof minNights === 'number' && typeof maxNights === 'number' && minNights > maxNights) return null;
  return {
    ...(minNights !== undefined ? { minNights } : {}),
    ...(maxNights !== undefined ? { maxNights } : {}),
    ...(closedToArrival === true ? { closedToArrival } : {}),
    ...(closedToDeparture === true ? { closedToDeparture } : {}),
    ...(nightlyRateMinor !== undefined ? { nightlyRateMinor } : {}),
  };
}

/** `true` αν η υπέρβαση δεν λέει τίποτα — τότε η μέρα **σβήνεται** από το έγγραφο. */
export function isEmptyDayRule(rule: StayDayRule): boolean {
  return Object.keys(rule).length === 0;
}
