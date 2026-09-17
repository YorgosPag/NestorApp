/**
 * @fileoverview **Η ΡΥΘΜΙΣΗ ΗΜΕΡΩΝ** — `set`/`clear` πάνω σε ένα εύρος, η ΜΙΑ συγχώνευση.
 * @related ADR-835 §21 · services/stay-calendar/stay-calendar-rules-write.ts ·
 *   lib/stay/stay-calendar-optimistic.ts · lib/stay/stay-rules-shape.ts
 * @module lib/stay/stay-day-restriction
 *
 * 🔑 **Δύο καταναλωτές, μία διατύπωση**: η συναλλαγή του διακομιστή και η αισιόδοξη πρόβλεψη
 * της οθόνης. Αν η οθόνη συγχώνευε αλλιώς, η πρόβλεψη θα «πηδούσε» στην επιβεβαίωση.
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O.
 */

import { addDaysToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import type { StayDayRule, StayDayRuleField, StayDayRules } from '@/types/stay-rules';

import { isEmptyDayRule, stayDayRuleFrom } from './stay-rules-shape';

/** Τι γράφει και τι σβήνει μια ρύθμιση ημερών. */
export interface StayDayRestriction {
  readonly from: string;
  readonly to: string;
  readonly set: StayDayRule;
  readonly clear: readonly StayDayRuleField[];
}

export type StayDayRestrictionOutcome =
  | { readonly kind: 'ok'; readonly days: StayDayRules; readonly touched: readonly string[] }
  /** Η πρώτη μέρα που θα έμενε με ελάχιστες > μέγιστες νύχτες. */
  | { readonly kind: 'contradictory'; readonly date: string };

/** Η υπέρβαση μιας ημέρας μετά το `set`/`clear` — ή `null` αν γίνεται αντιφατική. */
function nextDayRule(current: StayDayRule | undefined, restriction: StayDayRestriction): StayDayRule | null {
  const merged: Record<string, unknown> = { ...(current ?? {}), ...restriction.set };
  for (const field of restriction.clear) delete merged[field];
  return stayDayRuleFrom(merged);
}

/**
 * **Εφάρμοσε τη ρύθμιση στις νύχτες `[from, to)`.** Μέρα που δεν λέει πια τίποτα **σβήνεται**.
 * @returns τις νέες μέρες και ποιες ημερομηνίες άγγιξε (για να ξέρει ο γραφέας ποιους μήνες).
 */
export function restrictDays(days: StayDayRules, restriction: StayDayRestriction): StayDayRestrictionOutcome {
  const next: Record<string, StayDayRule> = { ...days };
  const touched: string[] = [];
  const nights = daysBetweenDateKeys(restriction.from, restriction.to) ?? 0;
  for (let offset = 0; offset < nights; offset += 1) {
    const date = addDaysToDateKey(restriction.from, offset);
    if (date === null) continue;
    const rule = nextDayRule(next[date], restriction);
    if (rule === null) return { kind: 'contradictory', date };
    if (isEmptyDayRule(rule)) delete next[date];
    else next[date] = rule;
    touched.push(date);
  }
  return { kind: 'ok', days: next, touched };
}
