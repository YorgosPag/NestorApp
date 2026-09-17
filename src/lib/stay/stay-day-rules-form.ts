/**
 * @fileoverview **Η ΦΟΡΜΑ «ΡΥΘΜΙΣΕΙΣ ΓΙΑ ΑΥΤΕΣ ΤΙΣ ΜΕΡΕΣ»** — αρχικές τιμές και η πράξη που παράγει.
 * @related ADR-835 §21 · components/stay-calendar/StayDayRulesForm.tsx · lib/stay/stay-day-restriction.ts
 * @module lib/stay/stay-day-rules-form
 *
 * 🔑 **Κενό πεδίο = «ισχύει ο γενικός κανόνας»** (σημασιολογία extranet): η φόρμα ανοίγει με
 * τις **κοινές** τιμές της επιλογής, άρα ό,τι αδειάσει ο οικοδεσπότης το εννοεί. Όταν οι
 * μέρες **διαφέρουν**, η φόρμα ανοίγει κενή και το λέει (`mixed`) — ποτέ δεν δείχνει την τιμή
 * της πρώτης μέρας σαν να ίσχυε για όλες.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { addDaysToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { majorFromMinor, minorFromMajor } from '@/lib/money/money';
import type { StayDayRule, StayDayRuleField, StayDayRules } from '@/types/stay-rules';
import { STAY_DAY_RULE_FIELDS } from '@/types/stay-rules';

import type { StayCalendarCommand } from './stay-calendar-command';
import { dayRuleOn } from './stay-rules';

/** Οι τιμές της φόρμας, όπως τις γράφει ο άνθρωπος. `null` = κενό. */
export interface StayDayRulesFormValues {
  /** Ευρώ, όπως πληκτρολογούνται· μετατρέπονται σε λεπτά ΜΙΑ φορά στο {@link restrictionFromForm}. */
  readonly priceEuros: number | null;
  readonly minNights: number | null;
  readonly maxNights: number | null;
  readonly closedToArrival: boolean;
  readonly closedToDeparture: boolean;
}

export const EMPTY_DAY_RULES_FORM: StayDayRulesFormValues = {
  priceEuros: null, minNights: null, maxNights: null, closedToArrival: false, closedToDeparture: false,
};

function sameRule(a: StayDayRule, b: StayDayRule): boolean {
  return STAY_DAY_RULE_FIELDS.every((field) => a[field] === b[field]);
}

/** Οι αρχικές τιμές: η **κοινή** υπέρβαση των νυχτών `[from, to)`, ή κενή + `mixed`. */
export function initialDayRulesForm(
  days: StayDayRules,
  from: string,
  to: string,
): { readonly values: StayDayRulesFormValues; readonly mixed: boolean } {
  const first = dayRuleOn(days, from);
  const nights = daysBetweenDateKeys(from, to) ?? 0;
  for (let offset = 1; offset < nights; offset += 1) {
    const date = addDaysToDateKey(from, offset);
    if (date !== null && !sameRule(first, dayRuleOn(days, date))) return { values: EMPTY_DAY_RULES_FORM, mixed: true };
  }
  return {
    values: {
      priceEuros: first.nightlyRateMinor === undefined ? null : majorFromMinor(first.nightlyRateMinor),
      minNights: first.minNights ?? null,
      maxNights: first.maxNights ?? null,
      closedToArrival: first.closedToArrival === true,
      closedToDeparture: first.closedToDeparture === true,
    },
    mixed: false,
  };
}

/**
 * **Η πράξη `restrict`** από τις τιμές: συμπληρωμένα ⇒ `set`, κενά ⇒ `clear`.
 * @returns `null` αν η τιμή δεν γίνεται ποσό (αρνητική, μη πεπερασμένη).
 */
export function restrictionFromForm(
  values: StayDayRulesFormValues,
  from: string,
  to: string,
): Extract<StayCalendarCommand, { action: 'restrict' }> | null {
  const priceMinor = values.priceEuros === null ? null : minorFromMajor(values.priceEuros);
  if (values.priceEuros !== null && priceMinor === null) return null;
  const set: { -readonly [K in keyof StayDayRule]: StayDayRule[K] } = {};
  const clear: StayDayRuleField[] = [];
  if (priceMinor === null) clear.push('nightlyRateMinor');
  else set.nightlyRateMinor = priceMinor;
  if (values.minNights === null) clear.push('minNights');
  else set.minNights = values.minNights;
  if (values.maxNights === null) clear.push('maxNights');
  else set.maxNights = values.maxNights;
  if (values.closedToArrival) set.closedToArrival = true;
  else clear.push('closedToArrival');
  if (values.closedToDeparture) set.closedToDeparture = true;
  else clear.push('closedToDeparture');
  return { action: 'restrict', from, to, set, clear };
}
