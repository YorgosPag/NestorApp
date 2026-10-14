/**
 * =============================================================================
 * Λήξη εγγράφου — ο ΕΝΑΣ υπολογισμός (ADR-915 Φ1)
 * =============================================================================
 *
 * `κανόνας + ημερομηνία έκδοσης (+ λήξη τυπωμένη στο έγγραφο) → ημέρα λήξης`
 *
 * Τον καλούν η αγγελία (`certificateValidUntil`), η μεταβίβαση (`deriveChecklist`) και, μέσω της αγγελίας, η απάντηση
 * νομιμότητας. Ίδια είσοδος ⇒ ίδια ημέρα, παντού (άγκυρα ισοτιμίας).
 *
 * 🔑 **Η τελευταία μέρα είναι ΜΕΣΑ**: `expiresOn` = η τελευταία ημέρα σε ισχύ, ίδια σημασιολογία με το `isExpiredOn`
 * (`lib/legality/legality-signal.ts`) και το `expiresOn < today` του καταλόγου.
 *
 * 🏆 **Τυπωμένη λήξη vs κανόνας** (ADR-915 Α4 — δεν το βρήκαμε σε κανέναν μεγάλο): το ίδιο το έγγραφο γράφει ως πότε
 * ισχύει (π.χ. «Ημερομηνία Ισχύος» στο ΠΕΑ). Όταν υπάρχουν και τα δύο, ισχύει η **νωρίτερη** — ποτέ «σε ισχύ» όταν μία
 * πηγή λέει «έληξε» — και η διαφορά δεν σβήνει σιωπηλά: επιστρέφεται ως `discrepancy` για τον ελεγκτή.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, **μηδέν ρολόι**.
 *
 * @module lib/document-validity/document-expiry
 */

import { addDaysToDateKey, daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import { addMonthsUTC, normalizeToMillisOrNull, utcDateOf } from '@/lib/date-local';
import type { DocumentValidityRule } from '@/config/document-validity/document-validity';

/** Ανοχή ασυμφωνίας: μία μέρα (στρογγυλοποίηση εκδότη «έως και» vs «έως»). Πέρα από αυτή, το λέμε. */
const DISCREPANCY_TOLERANCE_DAYS = 1;

/**
 * Έχει το είδος **περιορισμένη** ισχύ; — `true` και για το `unverified` (λήγει, δεν ξέρουμε πότε).
 * Είναι το `expires` του `LegalityClaimKindSpec`, **παραγόμενο** αντί για γραμμένο δεύτερη φορά.
 */
export function ruleExpires(rule: DocumentValidityRule): boolean {
  return rule.kind === 'months' || rule.kind === 'days' || rule.kind === 'unverified';
}

/**
 * Η τελευταία ημέρα ισχύος κατά τον **κανόνα** — `YYYY-MM-DD`, ή `null` όταν ο κανόνας δεν δίνει ημερομηνία
 * (`none` · `act_day` · `unverified`) ή η έκδοση δεν διαβάζεται. `null` σημαίνει «δεν ξέρουμε», **ποτέ** «ισχύει».
 */
export function ruleExpiresOn(rule: DocumentValidityRule, issuedOn: string | null): string | null {
  if (issuedOn === null || !isDateKey(issuedOn)) return null;
  if (rule.kind === 'days') return addDaysToDateKey(issuedOn, rule.days);
  if (rule.kind !== 'months') return null;
  const untilMs = normalizeToMillisOrNull(addMonthsUTC(issuedOn, rule.months));
  return untilMs === null ? null : utcDateOf(untilMs);
}

/** Από πού ήρθε η ημέρα λήξης. */
export type ExpirySource = 'rule' | 'printed';

export interface ExpiryDiscrepancy {
  readonly rule: string;
  readonly printed: string;
}

export interface DocumentExpiry {
  /** Η ισχύουσα τελευταία ημέρα — `null` = άγνωστη. */
  readonly expiresOn: string | null;
  readonly source: ExpirySource | null;
  /** Κανόνας και έγγραφο διαφωνούν κατά > 1 ημέρα — ποτέ σιωπηλά. */
  readonly discrepancy: ExpiryDiscrepancy | null;
}

export interface DocumentExpiryInput {
  readonly rule: DocumentValidityRule;
  readonly issuedOn: string | null;
  /** Ό,τι γράφει το ίδιο το έγγραφο (`YYYY-MM-DD`), αν το διαβάσαμε. */
  readonly printedValidUntil?: string | null;
}

function discrepancyOf(rule: string, printed: string): ExpiryDiscrepancy | null {
  const gap = daysBetweenDateKeys(rule, printed);
  return gap !== null && Math.abs(gap) > DISCREPANCY_TOLERANCE_DAYS ? { rule, printed } : null;
}

/** Η ισχύουσα λήξη: η **νωρίτερη** από κανόνα και έγγραφο, με την προέλευσή της και την ασυμφωνία τους. */
export function documentExpiry({ rule, issuedOn, printedValidUntil = null }: DocumentExpiryInput): DocumentExpiry {
  const fromRule = ruleExpiresOn(rule, issuedOn);
  const printed = printedValidUntil !== null && isDateKey(printedValidUntil) ? printedValidUntil : null;
  if (rule.kind === 'none') return { expiresOn: null, source: null, discrepancy: null };
  if (fromRule === null && printed === null) return { expiresOn: null, source: null, discrepancy: null };
  if (fromRule === null) return { expiresOn: printed, source: 'printed', discrepancy: null };
  if (printed === null) return { expiresOn: fromRule, source: 'rule', discrepancy: null };
  const earlier = printed < fromRule ? printed : fromRule;
  return { expiresOn: earlier, source: earlier === printed ? 'printed' : 'rule', discrepancy: discrepancyOf(fromRule, printed) };
}
