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

import { addDaysToDateKey, addMonthsToDateKey, isDateKey } from '@/lib/calendar/date-key';
import { daysInMonth } from '@/lib/date/calendar-arithmetic';
import { isoCalendarDay } from '@/lib/date/calendar-day';
import {
  ENFIA_CENTRAL_ISSUANCE,
  ENFIA_CENTRAL_ISSUANCE_EXPECTED_BY,
  type DocumentClassification,
  type DocumentValidityRule,
  type ValidityCeiling,
  type ValidityRegime,
} from '@/config/document-validity/document-validity';

/** Έτος και μήνας (1–12) ενός `YYYY-MM-DD`. Το καλούν μόνο αφού το `isDateKey` το επικύρωσε. */
function yearMonthOf(key: string): { readonly year: number; readonly month: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

function endOfMonthOf(key: string): string {
  const { year, month } = yearMonthOf(key);
  return isoCalendarDay(year, month, daysInMonth(year, month));
}

const endOfYearOf = (key: string): string => `${key.slice(0, 4)}-12-31`;

/** Α.1085/2023 άρθρο 1 παρ. 6: πριν την κεντρική έκδοση ⇒ η παραμονή της· από αυτήν και μετά ⇒ 31/12. */
function enfiaCycleEndOf(key: string): string | null {
  const central = ENFIA_CENTRAL_ISSUANCE[yearMonthOf(key).year];
  if (central === undefined) return null;
  return key < central ? addDaysToDateKey(central, -1) : endOfYearOf(key);
}

/**
 * Ξέρουμε την κεντρική έκδοση ΕΝΦΙΑ του έτους της `today`;
 * - `known`    — υπάρχει γραμμή στο `ENFIA_CENTRAL_ISSUANCE`
 * - `awaiting` — δεν υπάρχει, αλλά είναι ακόμη νωρίς (έως `ENFIA_CENTRAL_ISSUANCE_EXPECTED_BY`)
 * - `missing`  — δεν υπάρχει και θα έπρεπε ⇒ τα πιστοποιητικά του έτους δείχνουν σιωπηλά «άγνωστη λήξη» (ADR-915 §17)
 * `null` όταν η `today` δεν είναι ημερομηνία.
 */
export function enfiaCentralIssuanceCoverage(today: string): 'known' | 'awaiting' | 'missing' | null {
  if (!isDateKey(today)) return null;
  if (ENFIA_CENTRAL_ISSUANCE[yearMonthOf(today).year] !== undefined) return 'known';
  return today.slice(5) <= ENFIA_CENTRAL_ISSUANCE_EXPECTED_BY ? 'awaiting' : 'missing';
}

/**
 * Το καθεστώς που ίσχυε την ημέρα έκδοσης — το πρώτο του πίνακα με `from <= issuedOn` (ή χωρίς `from`). Ο πίνακας
 * γράφεται από το νεότερο προς το παλαιότερο· η σειρά δεν μαντεύεται εδώ, την κλειδώνει άγκυρα.
 */
export function regimeOn(regimes: readonly ValidityRegime[], issuedOn: string): ValidityRegime | null {
  return regimes.find((regime) => regime.from === null || issuedOn >= regime.from) ?? null;
}

/** Μήνες για την κατηγορία — ή, με άγνωστη κατηγορία, το **μέγιστο** του καθεστώτος (μόνο ως ανώτατο, βλ. `ValidityCeiling`). */
function classifiedMonthsOf(regime: ValidityRegime, classification: DocumentClassification | null): number {
  return classification === null ? Math.max(...Object.values(regime.months)) : regime.months[classification];
}

/**
 * Η τελευταία ημέρα ισχύος κατά το όριο — `null` όταν η έκδοση δεν διαβάζεται ή το όριο δεν είναι γνωστό.
 * `classification` = η κατάταξη που έγραψε ο εκδότης (ADR-915 §32)· τη ρωτά μόνο το `classified-months`.
 */
export function boundExpiresOn(
  bound: ValidityCeiling,
  issuedOn: string | null,
  classification: DocumentClassification | null = null,
): string | null {
  if (issuedOn === null || !isDateKey(issuedOn)) return null;
  switch (bound.kind) {
    case 'months': return addMonthsToDateKey(issuedOn, bound.months);
    case 'end-of-month': return endOfMonthOf(issuedOn);
    case 'end-of-year': return endOfYearOf(issuedOn);
    case 'enfia-cycle': return enfiaCycleEndOf(issuedOn);
    case 'classified-months': {
      const regime = regimeOn(bound.regimes, issuedOn);
      return regime === null ? null : addMonthsToDateKey(issuedOn, classifiedMonthsOf(regime, classification));
    }
  }
}

export interface PrintedBounds {
  /** Η νωρίτερη νόμιμη λήξη — `null` = ο νόμος δεν εγγυάται κατώτατο (ή άγνωστο έτος ΕΝΦΙΑ). */
  readonly floor: string | null;
  readonly ceiling: string | null;
}

/** Το νόμιμο εύρος της τυπωμένης λήξης για αυτή την έκδοση — `null` όταν ο κανόνας δεν είναι `printed`. */
export function printedBoundsOf(
  rule: DocumentValidityRule,
  issuedOn: string | null,
  classification: DocumentClassification | null = null,
): PrintedBounds | null {
  if (rule.kind !== 'printed') return null;
  return {
    floor: rule.floor === null ? null : boundExpiresOn(rule.floor, issuedOn),
    ceiling: boundExpiresOn(rule.ceiling, issuedOn, classification),
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
