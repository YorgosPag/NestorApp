/**
 * =============================================================================
 * Νόμιμα όρια λήξης — καθαρός υπολογισμός (ADR-915 §14)
 * =============================================================================
 *
 * `όριο + ημερομηνία έκδοσης → η τελευταία ημέρα ισχύος κατά το όριο`, και το αντίστροφο:
 * `κανόνας + ημέρα που χρειάζεται → η νωρίτερη έκδοση που ΕΓΓΥΗΜΕΝΑ την καλύπτει`.
 *
 * 🔑 Ίδια σημασιολογία με το `ruleExpiresOn`: η επιστρεφόμενη ημέρα είναι **μέσα** στην ισχύ.
 * 🔑 `null` = «δεν ξέρουμε» — ποτέ «ισχύει» (ADR-915 §3.3).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι**.
 *
 * @module lib/document-validity/validity-bounds
 */

import { addDaysToDateKey, isDateKey } from '@/lib/calendar/date-key';
import { addMonthsUTC, normalizeToMillisOrNull, utcDateOf } from '@/lib/date-local';
import {
  ENFIA_CENTRAL_ISSUANCE,
  type DocumentValidityRule,
  type ValidityBound,
} from '@/config/document-validity/document-validity';

const pad = (value: number): string => String(value).padStart(2, '0');

/** Έτος και μήνας (1–12) ενός `YYYY-MM-DD`. Το καλούν μόνο αφού το `isDateKey` το επικύρωσε. */
function yearMonthOf(key: string): { readonly year: number; readonly month: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

/** `issuedOn` + N μήνες ημερολογίου — ο ΕΝΑΣ τρόπος (`addMonthsUTC`), ίδιος με τον κανόνα `months`. */
export function addMonthsToDateKey(key: string, months: number): string | null {
  const untilMs = normalizeToMillisOrNull(addMonthsUTC(key, months));
  return untilMs === null ? null : utcDateOf(untilMs);
}

function endOfMonthOf(key: string): string {
  const { year, month } = yearMonthOf(key);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(lastDay)}`;
}

const endOfYearOf = (key: string): string => `${key.slice(0, 4)}-12-31`;

/** Α.1085/2023 άρθρο 1 παρ. 6: πριν την κεντρική έκδοση ⇒ η παραμονή της· από αυτήν και μετά ⇒ 31/12. */
function enfiaCycleEndOf(key: string): string | null {
  const central = ENFIA_CENTRAL_ISSUANCE[yearMonthOf(key).year];
  if (central === undefined) return null;
  return key < central ? addDaysToDateKey(central, -1) : endOfYearOf(key);
}

/** Η τελευταία ημέρα ισχύος κατά το όριο — `null` όταν η έκδοση δεν διαβάζεται ή το όριο δεν είναι γνωστό. */
export function boundExpiresOn(bound: ValidityBound, issuedOn: string | null): string | null {
  if (issuedOn === null || !isDateKey(issuedOn)) return null;
  switch (bound.kind) {
    case 'months': return addMonthsToDateKey(issuedOn, bound.months);
    case 'end-of-month': return endOfMonthOf(issuedOn);
    case 'end-of-year': return endOfYearOf(issuedOn);
    case 'enfia-cycle': return enfiaCycleEndOf(issuedOn);
  }
}

export interface PrintedBounds {
  /** Η νωρίτερη νόμιμη λήξη — `null` = ο νόμος δεν εγγυάται κατώτατο (ή άγνωστο έτος ΕΝΦΙΑ). */
  readonly floor: string | null;
  readonly ceiling: string | null;
}

/** Το νόμιμο εύρος της τυπωμένης λήξης για αυτή την έκδοση — `null` όταν ο κανόνας δεν είναι `printed`. */
export function printedBoundsOf(rule: DocumentValidityRule, issuedOn: string | null): PrintedBounds | null {
  if (rule.kind !== 'printed') return null;
  return {
    floor: rule.floor === null ? null : boundExpiresOn(rule.floor, issuedOn),
    ceiling: boundExpiresOn(rule.ceiling, issuedOn),
  };
}

// =============================================================================
// ΤΟ ΑΝΤΙΣΤΡΟΦΟ — «εκδώστε από X και μετά»
// =============================================================================

/** Η εγγυημένη λήξη μιας έκδοσης — το κατώτατο, ποτέ το ανώτατο (μόνο αυτό υπόσχεται ο νόμος). */
function guaranteedExpiresOn(rule: DocumentValidityRule, issuedOn: string): string | null {
  if (rule.kind === 'months') return addMonthsToDateKey(issuedOn, rule.months);
  if (rule.kind === 'days') return addDaysToDateKey(issuedOn, rule.days);
  if (rule.kind === 'printed' && rule.floor !== null) return boundExpiresOn(rule.floor, issuedOn);
  return null;
}

/** Υποψήφια πρώτη έκδοση: η απόσταση του κανόνα προς τα πίσω· η επαλήθευση γίνεται μετά. */
function candidateIssueOf(rule: DocumentValidityRule, neededOn: string): string | null {
  if (rule.kind === 'months') return addMonthsToDateKey(neededOn, -rule.months);
  if (rule.kind === 'days') return addDaysToDateKey(neededOn, -rule.days);
  if (rule.kind !== 'printed' || rule.floor === null) return null;
  const { floor } = rule;
  if (floor.kind === 'months') return addMonthsToDateKey(neededOn, -floor.months);
  if (floor.kind === 'end-of-month') return `${neededOn.slice(0, 7)}-01`;
  if (floor.kind === 'end-of-year') return `${neededOn.slice(0, 4)}-01-01`;
  const central = ENFIA_CENTRAL_ISSUANCE[yearMonthOf(neededOn).year];
  if (central === undefined) return null;
  return neededOn < central ? `${neededOn.slice(0, 4)}-01-01` : central;
}

/** Μέγιστη διόρθωση της υποψήφιας: η σύμπτυξη ημέρας στο τέλος του μήνα (31 → 28) μετακινεί το πολύ 3 ημέρες. */
const MAX_CLAMP_STEPS = 4;

/**
 * **Η νωρίτερη ημέρα έκδοσης που εγγυημένα καλύπτει την ημέρα που χρειάζεται** — ή `null` όταν ο κανόνας δεν δίνει
 * εγγύηση (`none` · `unverified` · `act_day` · `printed` χωρίς κατώτατο · έτος ΕΝΦΙΑ χωρίς γνωστή κεντρική έκδοση).
 *
 * Έκδοση **από** αυτή την ημέρα ⇒ ισχύει την ημέρα της υπογραφής, όποιες κι αν είναι οι οφειλές του πωλητή.
 */
export function coveringIssueFrom(rule: DocumentValidityRule, neededOn: string): string | null {
  if (!isDateKey(neededOn)) return null;
  let candidate = candidateIssueOf(rule, neededOn);
  for (let step = 0; candidate !== null && step < MAX_CLAMP_STEPS; step += 1) {
    const until = guaranteedExpiresOn(rule, candidate);
    if (until === null) return null;
    if (until >= neededOn) return candidate;
    candidate = addDaysToDateKey(candidate, 1);
  }
  return null;
}
