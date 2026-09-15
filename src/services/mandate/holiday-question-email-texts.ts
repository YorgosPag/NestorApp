/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΤΗΣ ΕΡΩΤΗΣΗΣ ΑΡΓΙΩΝ** — ανά γλώσσα, χωρίς i18next (ADR-841 §7 Α21.21 Φάση Β).
 * @related services/mandate/mandate-email-texts.ts (το πρότυπο και το σκεπτικό) ·
 *   services/mandate/holiday-hours-question-notifier.ts · server/notifications/notification-email-render.ts (τα κουμπιά)
 * @module services/mandate/holiday-question-email-texts
 *
 * 🔑 **Πίνακας με παράμετρο, όχι `t()`**: μία διεργασία στέλνει σε **πολλούς** παραλήπτες στο ίδιο πέρασμα — η καθολική
 * γλώσσα του i18next θα έγραφε το email του ενός στη γλώσσα του άλλου (§8.29). **Δεν** είναι εξαίρεση του N.11:
 * περιεχόμενο μηνύματος, εκτός React (ίδια απόφαση με `MANDATE_TEXTS` · `EMAIL_TEXTS`).
 *
 * ⛔ **Τα ονόματα των αργιών ΔΕΝ ξαναγράφονται εδώ**: διαβάζονται από το **ίδιο** locale που δείχνει η κάρτα
 * (`property-market` → `mandate.profile.holiday`). Δεύτερος κατάλογος ονομάτων θα απέκλινε από την κάρτα.
 */

import elMarket from '@/i18n/locales/el/property-market.json';
import enMarket from '@/i18n/locales/en/property-market.json';
import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import type { GreekPublicHolidayId } from '@/lib/calendar/greek-public-holidays';
import type { HolidayAnswerKind, HolidayQuestionItem } from '@/lib/calendar/holiday-question';
import { formatCalendarDay } from '@/lib/intl-formatting';

/** Τα λόγια της ερώτησης, σε **μία** γλώσσα. */
export interface HolidayQuestionWording {
  readonly subject: (agency: string) => string;
  readonly reminderSubject: (agency: string) => string;
  readonly intro: (agency: string) => string;
  /** Τι βλέπει ο πελάτης **χωρίς** απάντηση — ο λόγος να απαντήσει, όχι απειλή. */
  readonly withoutAnswer: string;
  readonly answerAll: Record<HolidayAnswerKind, string>;
  readonly otherHours: string;
  readonly lastYear: Record<HolidayAnswerKind, string>;
}

const WORDING: Record<HumanLanguage, HolidayQuestionWording> = {
  el: {
    subject: (agency) => `${agency}: θα είστε ανοιχτά στις επόμενες αργίες;`,
    reminderSubject: (agency) => `Υπενθύμιση — ${agency}: θα είστε ανοιχτά στις επόμενες αργίες;`,
    intro: (agency) => `Πλησιάζουν αργίες που το «${agency}» θα ήταν κανονικά ανοιχτό:`,
    withoutAnswer: 'Όσο δεν απαντάτε, η δημόσια κάρτα σας γράφει «το ωράριο ίσως διαφέρει» αυτές τις μέρες.',
    answerAll: { closed: 'Κλειστά', regular: 'Κανονικό ωράριο' },
    otherHours: 'Άλλο ωράριο',
    lastYear: { closed: 'πέρσι: κλειστά', regular: 'πέρσι: κανονικά' },
  },
  en: {
    subject: (agency) => `${agency}: will you be open on the upcoming public holidays?`,
    reminderSubject: (agency) => `Reminder — ${agency}: will you be open on the upcoming public holidays?`,
    intro: (agency) => `Public holidays are coming up on days when "${agency}" is normally open:`,
    withoutAnswer: 'Until you answer, your public card says "hours may differ" on these days.',
    answerAll: { closed: 'Closed', regular: 'Regular hours' },
    otherHours: 'Different hours',
    lastYear: { closed: 'last year: closed', regular: 'last year: regular' },
  },
};

const HOLIDAY_NAMES: Record<HumanLanguage, Record<GreekPublicHolidayId, string>> = {
  el: elMarket.mandate.profile.holiday,
  en: enMarket.mandate.profile.holiday,
};

export function holidayQuestionWording(language: unknown): HolidayQuestionWording {
  return WORDING[resolveHumanLanguage(language)];
}

/** «Παρ 25 Δεκ — Χριστούγεννα» — ημερομηνία στη γλώσσα **του παραλήπτη**, όνομα από το locale της κάρτας. */
export function holidayQuestionLine(language: unknown, item: Pick<HolidayQuestionItem, 'date' | 'holiday'>): string {
  const human = resolveHumanLanguage(language);
  return `${formatCalendarDay(item.date, false, human)} — ${HOLIDAY_NAMES[human][item.holiday]}`;
}

/**
 * **Το σώμα του email** (απλό κείμενο — ο αγωγός το στέλνει ως `content`): εισαγωγή, **μία** γραμμή ανά ημερομηνία
 * (τα καταστήματα του ίδιου γραφείου ρωτιούνται μαζί), και τι βλέπει ο πελάτης χωρίς απάντηση.
 */
export function holidayQuestionBody(language: unknown, agency: string, items: readonly HolidayQuestionItem[]): string {
  const wording = holidayQuestionWording(language);
  const seen = new Set<string>();
  const lines = items
    .filter(({ date }) => (seen.has(date) ? false : (seen.add(date), true)))
    .map((item) => `  • ${holidayQuestionLine(language, item)}`);
  return [wording.intro(agency), '', ...lines, '', wording.withoutAnswer].join('\n');
}
