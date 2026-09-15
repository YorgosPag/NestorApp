/**
 * @fileoverview **«ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;» — ΚΛΕΙΔΙΑ ΤΗΣ ΣΕΛΙΔΑΣ ΑΠΑΝΤΗΣΗΣ** (ADR-841 §7 Α21.21 Φάση Β).
 * @related components/mandate/HolidayQuestionContent.tsx · agency-showcase-special-hours-labels.ts (ίδιο πρόθεμα)
 * @module components/mandate/holiday-question-labels
 *
 * ⚠️ **ΠΛΗΡΗ ΚΥΡΙΟΛΕΚΤΙΚΑ, ΠΟΤΕ `${K}` ΑΠΟ ΕΙΣΗΓΜΕΝΗ ΣΤΑΘΕΡΑ** (μάθημα ADR-853 Φ6, `.i18n-shell-slice.json`): ο γεννήτορας
 * του route slice λύνει μόνο σταθερές του ίδιου αρχείου — αλλιώς «0 ns» και ωμά κλειδιά στο πρώτο καρέ.
 *
 * 🔑 **Κανένα δεύτερο «Κλειστά / Κανονικό ωράριο»**: οι επιλογές διαβάζουν το `SHOWCASE_SPECIAL_KIND_KEYS` της φόρμας — η
 * σελίδα και η φόρμα λένε την ίδια λέξη για την ίδια ειδική μέρα. Ονόματα αργιών: `PROFILE_HOLIDAY_KEYS`.
 */

import type { HolidayHoursQuestionRefusal } from '@/types/holiday-hours-question';

export const HOLIDAY_QUESTION_NS = 'property-market';

export const HOLIDAY_QUESTION_KEYS = {
  title: 'property-market:mandate.showcase.holidayQuestion.title',
  /** `{agency}` */
  intro: 'property-market:mandate.showcase.holidayQuestion.intro',
  explain: 'property-market:mandate.showcase.holidayQuestion.explain',
  /** Ομάδα επιλογής για όλες τις γραμμές μαζί. */
  sameForAll: 'property-market:mandate.showcase.holidayQuestion.sameForAll',
  /** `{answer}` — «Πέρσι: Κλειστά». */
  lastYear: 'property-market:mandate.showcase.holidayQuestion.lastYear',
  submit: 'property-market:mandate.showcase.holidayQuestion.submit',
  sending: 'property-market:mandate.showcase.holidayQuestion.sending',
  otherHours: 'property-market:mandate.showcase.holidayQuestion.otherHours',
  otherHoursHint: 'property-market:mandate.showcase.holidayQuestion.otherHoursHint',
  /** `{count}` — ICU plural. */
  remaining: 'property-market:mandate.showcase.holidayQuestion.remaining',
  done: 'property-market:mandate.showcase.holidayQuestion.done',
  /** Η φόρμα κέρδισε — ορατά, όχι σιωπηλά. */
  formWon: 'property-market:mandate.showcase.holidayQuestion.formWon',
} as const;

/** Κάθε λόγος στέλνει τον άνθρωπο σε **άλλη** κίνηση — κλειστός πίνακας, ο μεταγλωττιστής απαιτεί γραμμή για κάθε νέο. */
export const HOLIDAY_QUESTION_REASON_KEYS: Record<HolidayHoursQuestionRefusal | 'unavailable', string> = {
  'link-invalid': 'property-market:mandate.showcase.holidayQuestion.reason.link-invalid',
  'question-unknown': 'property-market:mandate.showcase.holidayQuestion.reason.question-unknown',
  expired: 'property-market:mandate.showcase.holidayQuestion.reason.expired',
  'already-answered': 'property-market:mandate.showcase.holidayQuestion.reason.already-answered',
  'without-showcase': 'property-market:mandate.showcase.holidayQuestion.reason.without-showcase',
  'special-hours-invalid': 'property-market:mandate.showcase.holidayQuestion.reason.special-hours-invalid',
  unavailable: 'property-market:mandate.showcase.holidayQuestion.reason.unavailable',
};
