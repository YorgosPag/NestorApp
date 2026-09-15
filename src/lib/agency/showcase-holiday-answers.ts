/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΤΟΥ EMAIL ΓΙΝΕΤΑΙ ΕΙΔΙΚΗ ΜΕΡΑ** — με τον ίδιο κριτή που φυλά τη φόρμα (ADR-841 §7 Α21.21 Φάση Β).
 * @related lib/calendar/holiday-question.ts · lib/agency/showcase-card-form.ts (`formLocationHours`) ·
 *   services/mandate/holiday-hours-question-decision.ts (ο καλών, μέσα σε συναλλαγή)
 * @module lib/agency/showcase-holiday-answers
 *
 * 🔑 **Κάθε απάντηση ξαναρωτά τον κριτή τη στιγμή που γράφεται**: από την αποστολή ως το κλικ μπορεί να πέρασαν μέρες.
 *   - η μέρα δηλώθηκε στο μεταξύ **στη φόρμα** ⇒ `already-answered` — **η φόρμα κερδίζει**, το email δεν την πατά·
 *   - σβήστηκε το εβδομαδιαίο ωράριο ή η μέρα έγινε κλειστή ⇒ `no-longer-needed`·
 *   - σβήστηκε το κατάστημα ⇒ `location-gone`.
 * Και το σύνολο περνά από το `formLocationHours` (ταβάνι 30 · ορίζοντας · κλάδεμα) — **καμία** παράκαμψη.
 *
 * **Layering**: καθαρή συνάρτηση — το ρολόι εγχέεται.
 */

import { formLocationHours, type CardRejection } from '@/lib/agency/showcase-card-form';
import {
  pendingHolidayItems,
  type HolidayAnswerKind,
  type HoursOfLocation,
} from '@/lib/calendar/holiday-question';
import type { TimelineOptions } from '@/lib/calendar/hours-timeline';
import type { SpecialDay } from '@/lib/calendar/special-hours';
import { athensClockAt } from '@/lib/calendar/weekly-hours';

export interface HolidayAnswer {
  readonly locationId: string;
  readonly date: string;
  readonly kind: HolidayAnswerKind;
}

export type HolidayAnswerOutcome = 'applied' | 'already-answered' | 'no-longer-needed' | 'location-gone';

export type AppliedHolidayAnswers<L extends HoursOfLocation> =
  | {
      readonly kind: 'applied';
      readonly locations: readonly L[];
      readonly outcomes: readonly { readonly answer: HolidayAnswer; readonly outcome: HolidayAnswerOutcome }[];
    }
  | ({ readonly kind: 'rejected' } & CardRejection);

function outcomeOf(location: HoursOfLocation | undefined, answer: HolidayAnswer, instant: Date, options: Pick<TimelineOptions, 'holidayOn'>): HolidayAnswerOutcome {
  if (location === undefined) return 'location-gone';
  if (pendingHolidayItems(location, instant, options).some(({ date }) => date === answer.date)) return 'applied';
  return location.specialHours.some(({ date }) => date === answer.date) ? 'already-answered' : 'no-longer-needed';
}

/**
 * **Εφάρμοσε τις απαντήσεις** — ή ονομασμένη άρνηση, και **τίποτα** δεν αλλάζει.
 *
 * Οι απαντήσεις εφαρμόζονται **με τη σειρά**: δεύτερη απάντηση για την ίδια μέρα βρίσκει την πρώτη ήδη γραμμένη ⇒
 * `already-answered`, ποτέ διπλή εγγραφή.
 */
export function applyHolidayAnswers<L extends HoursOfLocation>(
  locations: readonly L[],
  answers: readonly HolidayAnswer[],
  instant: Date,
  options: Pick<TimelineOptions, 'holidayOn'> = {},
): AppliedHolidayAnswers<L> {
  const current = new Map<string, L>(locations.map((location) => [location.id, location]));
  const outcomes: { answer: HolidayAnswer; outcome: HolidayAnswerOutcome }[] = [];
  for (const answer of answers) {
    const location = current.get(answer.locationId);
    const outcome = outcomeOf(location, answer, instant, options);
    outcomes.push({ answer, outcome });
    if (outcome !== 'applied' || location === undefined) continue;
    const declared: SpecialDay = { date: answer.date, kind: answer.kind };
    current.set(location.id, { ...location, specialHours: [...location.specialHours, declared] });
  }
  const todayKey = athensClockAt(instant).dateKey;
  const formed: L[] = [];
  for (const location of current.values()) {
    const hours = formLocationHours(location.hours, location.specialHours, todayKey);
    if ('reason' in hours) return { kind: 'rejected', reason: hours.reason };
    formed.push({ ...location, specialHours: hours.specialHours });
  }
  return { kind: 'applied', locations: formed, outcomes };
}
