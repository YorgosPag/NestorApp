/**
 * @fileoverview **ΑΠΟ ΤΗ ΒΑΣΗ ΣΤΗ ΜΗΧΑΝΗ** — η ΜΙΑ σύνθεση του `StayCalendar` από ό,τι διαβάστηκε.
 * @related ADR-835 §18.1 · §21 · services/stay-calendar/stay-calendar-read.service.ts ·
 *   lib/stay/stay-availability-vocabulary.ts · lib/stay/stay-rules.ts
 * @module lib/stay/stay-calendar-of
 *
 * 🔑 **Ένα σημείο μετάφρασης για τρεις καταναλωτές**: το δημόσιο ημερολόγιο, οι απαντήσεις
 * της αναζήτησης και οι προειδοποιήσεις της χειροκίνητης κράτησης. Αν ο καθένας συνέθετε
 * μόνος του (π.χ. ο ένας ξεχνούσε την προετοιμασία), θα έδιναν τρεις απαντήσεις στο
 * «χωράει;» — και ο επισκέπτης θα έβλεπε ελεύθερο κάτι που ο οικοδεσπότης βλέπει κλειστό.
 *
 * 🔴 **`declaredAt: null` ⇒ `undeclared`** ακόμη κι αν υπάρχουν κανόνες ή blocks: ο
 * οικοδεσπότης δεν είπε «το ημερολόγιο είναι ενημερωμένο» (§20.7).
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { athensClockAt } from '@/lib/calendar/weekly-hours';
import type { StayCalendarEntry, StayCalendarHead } from '@/types/stay-calendar';
import type {
  StayCalendarMonth,
  StayClock,
  StayDayRule,
  StayDayRules,
  StayRules,
} from '@/types/stay-rules';

import type { StayCalendar, StayChannelTrust } from './stay-availability-vocabulary';
import { stayCalendarOccupancies, type StayOccupancySource } from './stay-rules';

/** Ό,τι διάβασε η μία ανάγνωση — δομικό, ώστε η καθαρή μηχανή να μην εξαρτάται από τον διακομιστή. */
export type StayCalendarReading =
  | {
      readonly kind: 'readable';
      readonly head: StayCalendarHead | null;
      readonly entries: readonly StayCalendarEntry[];
      readonly months: readonly StayCalendarMonth[];
      /**
       * **Μιλούν τα κανάλια;** (Στάδιο Γ, §22) — κρίνεται από τον **αναγνώστη**, που
       * έχει το ρολόι· εδώ ταξιδεύει ως **γεγονός**, ώστε η σύνθεση να μένει καθαρή.
       */
      readonly channels: StayChannelTrust;
    }
  | { readonly kind: 'unreadable' };

/** Οι κανόνες ανά ημερομηνία όλων των μηνών σε έναν χάρτη. */
export function stayDayRulesOf(months: readonly StayCalendarMonth[]): StayDayRules {
  const days: Record<string, StayDayRule> = {};
  for (const month of months) Object.assign(days, month.days);
  return days;
}

/** **Το ημερολόγιο της μηχανής** από την ανάγνωση και τη στιγμή της ερώτησης. */
export function stayCalendarOf(
  reading: StayCalendarReading,
  clock: StayClock,
): StayCalendar<StayOccupancySource> {
  if (reading.kind === 'unreadable') return { kind: 'unreadable' };
  const { head } = reading;
  if (head === null || head.declaredAt === null) return { kind: 'undeclared' };
  return declaredStayCalendarOf(reading.entries, head.rules, reading.months, clock, reading.channels);
}

/**
 * **Το ημερολόγιο ΩΣ ΔΗΛΩΜΕΝΟ** — χωρίς να ρωτήσει τη δήλωση. Μόνο για τον ίδιο τον
 * οικοδεσπότη (προειδοποιήσεις της χειροκίνητης κράτησης): οι κανόνες του ισχύουν για τις
 * κρατήσεις του είτε δημοσίευσε το ημερολόγιο είτε όχι. Ο επισκέπτης περνά **πάντα** από
 * το {@link stayCalendarOf}.
 */
export function declaredStayCalendarOf(
  entries: readonly StayCalendarEntry[],
  rules: StayRules,
  months: readonly StayCalendarMonth[],
  clock: StayClock,
  channels: StayChannelTrust,
): StayCalendar<StayOccupancySource> {
  return {
    kind: 'declared',
    occupied: stayCalendarOccupancies(entries, rules.preparationNights),
    rules: { rules, days: stayDayRulesOf(months), clock },
    channels,
  };
}

/**
 * **Η στιγμή ως `StayClock`** — σήμερα και λεπτά σε ώρα Αθήνας (`STAY_CALENDAR_TIMEZONE`).
 * Το ΜΟΝΟ σημείο όπου ο διακομιστής μετατρέπει ρολόι σε είσοδο των καθαρών μηχανών.
 */
export function stayClockAt(instant: Date): StayClock {
  const clock = athensClockAt(instant);
  return { today: clock.dateKey, minutes: clock.minutes };
}
