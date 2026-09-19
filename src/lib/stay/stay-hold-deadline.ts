/**
 * @fileoverview **ΩΣ ΠΟΤΕ ΚΡΑΤΙΟΥΝΤΑΙ ΟΙ ΜΕΡΕΣ ΕΝΟΣ ΑΙΤΗΜΑΤΟΣ;** — η προθεσμία απάντησης (hold TTL).
 * @related ADR-835 §4.11 · §23.3 · lib/calendar/hours-timeline.ts (`openMinutesElapseIn`) ·
 *   types/stay-booking.ts (`StayHold`) · types/stay-rules.ts (`responseHours`)
 * @module lib/stay/stay-hold-deadline
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΚΛΙΜΑΚΑ ΖΕΙ ΣΕ ΕΝΑΝ ΠΙΝΑΚΑ — ΠΟΤΕ `if` ΣΕ ΣΗΜΕΙΟ ΧΡΗΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πόσο μακριά η άφιξη | Προθεσμία | Γιατί |
 * |---|---|---|
 * | < 48 ώρες | **2 ώρες** | ο επισκέπτης πρέπει να ξέρει **τώρα** |
 * | 48 ώρες – 7 ημέρες | **24 ώρες** | το καθολικό ρολόι της αγοράς (έρευνα 2026-09-18) |
 * | 7 – 30 ημέρες | **48 ώρες** | |
 * | > 30 ημέρες | **72 ώρες** | κανείς δεν βιάζεται |
 *
 * 🔴 Η αρχική κλίμακα του §4.11 **είχε τρύπα** στις 48h–7 ημέρες· γεμίζει με το 24ωρο της αγοράς.
 * Καμία πλατφόρμα δεν κλιμακώνει κατά εγγύτητα — το Airbnb έχει **ένα** 24ωρο για αύριο και για τον Μάιο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΡΙΑ ΤΑΒΑΝΙΑ — ΤΟ ΜΙΚΡΟΤΕΡΟ ΚΕΡΔΙΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Ρολόι ανθρώπου** — οι ώρες απόκρισης του οικοδεσπότη (`responseHours`)· `null` = ρολόι τοίχου,
 *    και τότε το ταβάνι λέγεται **`tier`**, όχι `response-hours`: η οθόνη δεν επικαλείται ώρες που
 *    κανείς δεν δήλωσε (ADR-835 §23.12 Ε1 — μετρημένο ζωντανά).
 * 2. **Ταβάνι τέντωσης** — οι ήσυχες ώρες **το πολύ διπλασιάζουν** την αναμονή. Χωρίς αυτό, ωράριο
 *    «Σάββατο 10–11» θα έκανε 2 ώρες προθεσμίας μια εβδομάδα.
 * 3. **Ταβάνι άφιξης** — ο επισκέπτης μαθαίνει **πριν από το μεσημέρι της άφιξης**, πάντα.
 *
 * Αν μένουν λιγότερα από {@link STAY_HOLD_MIN_WINDOW_MINUTES}, το αίτημα **δεν γεννιέται**
 * (`too-late`) — προθεσμία δέκα λεπτών δεν είναι υπόσχεση, είναι παγίδα.
 *
 * ⚠️ **Δηλωμένο όριο**: οι αποστάσεις μετρώνται σε λεπτά πάνω στη γραμμή της Αθήνας (1440 ανά ημέρα),
 * όπως στο `hours-timeline`· τις δύο νύχτες αλλαγής ώρας η προθεσμία μπορεί να απέχει μία ώρα. Η
 * προθεσμία **αποθηκεύεται** ως στιγμή, άρα ό,τι υποσχέθηκε η οθόνη είναι αυτό που ισχύει.
 *
 * **Layering**: leaf — καθαρή συνάρτηση, μηδέν I/O· το ρολόι έρχεται ως είσοδος (`StayClock`).
 */

import { daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { openMinutesElapseIn } from '@/lib/calendar/hours-timeline';
import { MINUTES_PER_DAY, type WeeklyHours } from '@/lib/calendar/weekly-hours';
import type { StayClock } from '@/types/stay-rules';

const MINUTES_PER_HOUR = 60;

/** Τα ονόματα των βαθμίδων — γράφονται στο hold, ώστε το ίχνος να λέει **γιατί** αυτή η προθεσμία. */
export const STAY_HOLD_TIERS = ['imminent', 'soon', 'upcoming', 'distant'] as const;

export type StayHoldTier = (typeof STAY_HOLD_TIERS)[number];

interface StayHoldTierRule {
  /** Η βαθμίδα ισχύει όσο η άφιξη απέχει **λιγότερο** από αυτό (λεπτά)· `null` = χωρίς όριο. */
  readonly leadBelowMinutes: number | null;
  /** Η προθεσμία απάντησης, σε ώρες **ανοιχτού** χρόνου. */
  readonly responseHours: number;
}

/**
 * **Η κλίμακα** — `Record` πάνω στο κλειστό σύνολο: πέμπτη βαθμίδα δεν μεταγλωττίζεται χωρίς κανόνα.
 * ⚠️ Η σειρά του {@link STAY_HOLD_TIERS} **είναι** συμβόλαιο: η πρώτη βαθμίδα που χωρά κερδίζει.
 */
export const STAY_HOLD_TIER_RULES: Readonly<Record<StayHoldTier, StayHoldTierRule>> = {
  imminent: { leadBelowMinutes: 2 * MINUTES_PER_DAY, responseHours: 2 },
  soon: { leadBelowMinutes: 7 * MINUTES_PER_DAY, responseHours: 24 },
  upcoming: { leadBelowMinutes: 30 * MINUTES_PER_DAY, responseHours: 48 },
  distant: { leadBelowMinutes: null, responseHours: 72 },
};

/** Οι ήσυχες ώρες **το πολύ διπλασιάζουν** την αναμονή. */
export const STAY_HOLD_QUIET_HOURS_STRETCH = 2;

/** Ο επισκέπτης μαθαίνει **το αργότερο** τότε, την ημέρα της άφιξης — 12:00 ώρα Αθήνας. */
export const STAY_HOLD_ARRIVAL_CUTOFF_MINUTES = 12 * MINUTES_PER_HOUR;

/** Κάτω από αυτό η προθεσμία δεν είναι υπόσχεση — το αίτημα δεν γεννιέται. */
export const STAY_HOLD_MIN_WINDOW_MINUTES = 30;

/**
 * **Πώς γράφεται μια προθεσμία** — πάντα **ώρα Αθήνας**, όπως κάθε ώρα του καταλύματος (`weekly-hours`):
 * ο επισκέπτης από το Λονδίνο που διαβάζει «ως 14:00» διαβάζει την ώρα του οικοδεσπότη. Ένα σχήμα για
 * οθόνη **και** email — δύο διατυπώσεις θα έγραφαν κάποτε δύο διαφορετικές ώρες για την ίδια υπόσχεση.
 */
export const STAY_HOLD_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: 'Europe/Athens',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * **Ποιο ταβάνι κέρδισε** — η οθόνη το λέει με λέξεις («ως το μεσημέρι της άφιξης»).
 * `tier` = η βαθμίδα σε ρολόι τοίχου, **χωρίς** δηλωμένες ώρες απόκρισης· `response-hours` = το ρολόι
 * του ανθρώπου που **δήλωσε** ώρες. ⚠️ Μόνο προσθήκη: ο αναγνώστης δέχεται ό,τι είναι σε αυτόν τον πίνακα.
 */
export const STAY_HOLD_BOUNDS = ['response-hours', 'tier', 'stretch', 'arrival'] as const;

export type StayHoldBound = (typeof STAY_HOLD_BOUNDS)[number];

export type StayHoldDeadline =
  | {
      readonly kind: 'held';
      /** ISO — η στιγμή που το αίτημα **παύει** να καταλαμβάνει. */
      readonly expiresAt: string;
      readonly tier: StayHoldTier;
      readonly bound: StayHoldBound;
    }
  /** Δεν μένει χρόνος για τίμια προθεσμία πριν την άφιξη. */
  | { readonly kind: 'too-late' };

export interface StayHoldDeadlineInput {
  readonly clock: StayClock;
  /** `YYYY-MM-DD` — η άφιξη. */
  readonly checkIn: string;
  readonly responseHours: WeeklyHours | null;
}

/** Η βαθμίδα για απόσταση άφιξης `leadMinutes` (από τώρα ως τα μεσάνυχτα της άφιξης). */
export function stayHoldTierOf(leadMinutes: number): StayHoldTier {
  for (const tier of STAY_HOLD_TIERS) {
    const below = STAY_HOLD_TIER_RULES[tier].leadBelowMinutes;
    if (below === null || leadMinutes < below) return tier;
  }
  return 'distant';
}

/** Λεπτά ρολογιού για `wallMinutes` λεπτά ανοιχτού χρόνου — ή `null` όταν δεν συμπληρώνονται. */
function humanClockMinutes(input: StayHoldDeadlineInput, wallMinutes: number): number | null {
  if (input.responseHours === null) return wallMinutes;
  // 🔑 Οι ώρες απόκρισης είναι **εβδομαδιαία δήλωση του ανθρώπου**, όχι ωράριο καταστήματος: οι
  //    αργίες δεν τις «ακυρώνουν» (στο κατάστημα μια αδήλωτη αργία είναι «δεν ξέρουμε»).
  return openMinutesElapseIn(input.responseHours, new Date(input.clock.instant), wallMinutes, {
    holidayOn: () => null,
  });
}

/** **Η προθεσμία ενός αιτήματος** που γεννιέται τη στιγμή `input.clock`. */
export function stayHoldDeadline(input: StayHoldDeadlineInput): StayHoldDeadline {
  const days = daysBetweenDateKeys(input.clock.today, input.checkIn);
  if (days === null || days < 0) return { kind: 'too-late' };

  const tier = stayHoldTierOf(days * MINUTES_PER_DAY - input.clock.minutes);
  const wall = STAY_HOLD_TIER_RULES[tier].responseHours * MINUTES_PER_HOUR;
  const candidates: readonly (readonly [StayHoldBound, number])[] = [
    [input.responseHours === null ? 'tier' : 'response-hours', humanClockMinutes(input, wall) ?? Number.POSITIVE_INFINITY],
    ['stretch', wall * STAY_HOLD_QUIET_HOURS_STRETCH],
    ['arrival', days * MINUTES_PER_DAY + STAY_HOLD_ARRIVAL_CUTOFF_MINUTES - input.clock.minutes],
  ];
  // Σε ισοπαλία κερδίζει το πρώτο — το ρολόι ανθρώπου είναι η «κανονική» απάντηση.
  const [bound, minutes] = candidates.reduce((best, next) => (next[1] < best[1] ? next : best));
  if (minutes < STAY_HOLD_MIN_WINDOW_MINUTES) return { kind: 'too-late' };

  const expiresAt = new Date(Date.parse(input.clock.instant) + minutes * 60_000).toISOString();
  return { kind: 'held', expiresAt, tier, bound };
}
