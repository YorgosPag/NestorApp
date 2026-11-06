/**
 * @fileoverview Έναρξη εργασιών — ο ΕΝΑΣ κριτής εισόδου και ανάγνωσης
 * @description Ό,τι έρχεται από τον πελάτη (PUT setup) ή από αποθηκευμένο έγγραφο περνά από εδώ πριν γίνει
 *   `BusinessStart | null`. Η ημερομηνία κρίνεται από τον κριτή ημερολογιακής ημέρας του έργου (ADR-919)·
 *   η προέλευση από τη ρίζα `BUSINESS_START_ORIGINS` — καμία δεύτερη απαρίθμηση.
 *
 * @see ADR-ACC-023 §1 · ADR-ACC-024 §6.1 α — η μειωμένη προκαταβολή υπολογίζεται από εδώ
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import { isCalendarDay } from '@/lib/date/calendar-day';

import { BUSINESS_START_ORIGINS } from '../../types/company';
import type { BusinessStart, BusinessStartOrigin } from '../../types/company';

/** Αποτέλεσμα ανάλυσης: έγκυρη τιμή (και `null` = «δεν δηλώθηκε») ή απόρριψη. */
export type BusinessStartParse =
  | { readonly kind: 'value'; readonly value: BusinessStart | null }
  | { readonly kind: 'invalid' };

function isOrigin(value: unknown): value is BusinessStartOrigin {
  return typeof value === 'string' && (BUSINESS_START_ORIGINS as readonly string[]).includes(value);
}

/**
 * Αυστηρή ανάλυση εισόδου: `undefined`/`null` ⇒ «δεν δηλώθηκε»· αντικείμενο με υπαρκτή ημέρα `YYYY-MM-DD`
 * και γνωστή προέλευση ⇒ τιμή· οτιδήποτε άλλο ⇒ `invalid` (ο διακομιστής απαντά 400, ποτέ σιωπηλή αποκοπή).
 */
export function parseBusinessStart(raw: unknown): BusinessStartParse {
  if (raw === undefined || raw === null) return { kind: 'value', value: null };
  if (typeof raw !== 'object') return { kind: 'invalid' };
  const { date, origin } = raw as Record<string, unknown>;
  if (!isCalendarDay(date) || !isOrigin(origin)) return { kind: 'invalid' };
  return { kind: 'value', value: { date, origin } };
}

/** Ανάγνωση αποθηκευμένου: ό,τι δεν είναι έγκυρο διαβάζεται ως «δεν δηλώθηκε» (⇒ πλήρης προκαταβολή). */
export function storedBusinessStart(raw: unknown): BusinessStart | null {
  const parsed = parseBusinessStart(raw);
  return parsed.kind === 'value' ? parsed.value : null;
}
