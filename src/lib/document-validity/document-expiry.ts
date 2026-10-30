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

import { addDaysToDateKey, addMonthsToDateKey, daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import type { DocumentClassification, DocumentValidityRule } from '@/config/document-validity/document-validity';
import { boundExpiresOn, printedBoundsOf } from '@/lib/document-validity/validity-bounds';

/** Ανοχή ασυμφωνίας: μία μέρα (στρογγυλοποίηση εκδότη «έως και» vs «έως»). Πέρα από αυτή, το λέμε. */
const DISCREPANCY_TOLERANCE_DAYS = 1;

/**
 * Έχει το είδος **περιορισμένη** ισχύ; — `true` και για το `unverified` (λήγει, δεν ξέρουμε πότε).
 * Είναι το `expires` του `LegalityClaimKindSpec`, **παραγόμενο** αντί για γραμμένο δεύτερη φορά.
 */
export function ruleExpires(rule: DocumentValidityRule): boolean {
  return rule.kind === 'months' || rule.kind === 'days' || rule.kind === 'unverified' || rule.kind === 'printed';
}

/**
 * Η τελευταία ημέρα ισχύος κατά τον **κανόνα** — `YYYY-MM-DD`, ή `null` όταν ο κανόνας δεν δίνει ημερομηνία
 * (`none` · `act_day` · `unverified`) ή η έκδοση δεν διαβάζεται. `null` σημαίνει «δεν ξέρουμε», **ποτέ** «ισχύει».
 * Για `printed` είναι το **κατώτατο** — το μόνο που εγγυάται ο νόμος χωρίς την τυπωμένη λήξη.
 */
export function ruleExpiresOn(rule: DocumentValidityRule, issuedOn: string | null): string | null {
  if (issuedOn === null || !isDateKey(issuedOn)) return null;
  if (rule.kind === 'days') return addDaysToDateKey(issuedOn, rule.days);
  if (rule.kind === 'months') return addMonthsToDateKey(issuedOn, rule.months);
  if (rule.kind === 'printed') return rule.floor === null ? null : boundExpiresOn(rule.floor, issuedOn);
  return null;
}

/**
 * Από πού ήρθε η ημέρα λήξης. `floor` = το **κατώτατο** ενός κανόνα `printed` χωρίς τυπωμένη λήξη: η ημέρα είναι
 * εγγυημένη, όχι η πραγματική — η διεπαφή λέει «τουλάχιστον έως», ποτέ «λήγει».
 */
export type ExpirySource = 'rule' | 'printed' | 'floor';

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
  /** Η κατάταξη που έγραψε ο εκδότης (ADR-915 §32) — στενεύει το ανώτατο ενός `classified-months`. */
  readonly classification?: DocumentClassification | null;
}

function discrepancyOf(rule: string, printed: string): ExpiryDiscrepancy | null {
  const gap = daysBetweenDateKeys(rule, printed);
  return gap !== null && Math.abs(gap) > DISCREPANCY_TOLERANCE_DAYS ? { rule, printed } : null;
}

const UNKNOWN_EXPIRY: DocumentExpiry = { expiresOn: null, source: null, discrepancy: null };

/**
 * `printed` — η τυπωμένη λήξη **είναι** η αλήθεια, μέσα στα νόμιμα όρια (ADR-915 §14):
 *   χωρίς τυπωμένη                ⇒ το κατώτατο (`floor`), ή άγνωστη
 *   πάνω από το ανώτατο            ⇒ το ανώτατο + ασυμφωνία   (ποτέ «σε ισχύ» πέρα από τον νόμο)
 *   κάτω από το κατώτατο           ⇒ η τυπωμένη + ασυμφωνία   (η νωρίτερη κερδίζει, Α4)
 *   μέσα στα όρια                  ⇒ η τυπωμένη, χωρίς ασυμφωνία (η διάρκεια εξαρτάται από ό,τι ξέρει μόνο το έγγραφο)
 */
function printedRuleExpiry(
  rule: Extract<DocumentValidityRule, { kind: 'printed' }>,
  issuedOn: string | null,
  printed: string | null,
  classification: DocumentClassification | null,
): DocumentExpiry {
  const { floor, ceiling } = printedBoundsOf(rule, issuedOn, classification) ?? { floor: null, ceiling: null };
  if (printed === null) return floor === null ? UNKNOWN_EXPIRY : { expiresOn: floor, source: 'floor', discrepancy: null };
  if (ceiling !== null && printed > ceiling) {
    return { expiresOn: ceiling, source: 'rule', discrepancy: discrepancyOf(ceiling, printed) };
  }
  const belowFloor = floor !== null && printed < floor ? discrepancyOf(floor, printed) : null;
  return { expiresOn: printed, source: 'printed', discrepancy: belowFloor };
}

/** Η ισχύουσα λήξη: η **νωρίτερη** από κανόνα και έγγραφο, με την προέλευσή της και την ασυμφωνία τους. */
export function documentExpiry({
  rule,
  issuedOn,
  printedValidUntil = null,
  classification = null,
}: DocumentExpiryInput): DocumentExpiry {
  const printed = printedValidUntil !== null && isDateKey(printedValidUntil) ? printedValidUntil : null;
  if (rule.kind === 'printed') return printedRuleExpiry(rule, issuedOn, printed, classification);
  const fromRule = ruleExpiresOn(rule, issuedOn);
  if (rule.kind === 'none') return { expiresOn: null, source: null, discrepancy: null };
  if (fromRule === null && printed === null) return { expiresOn: null, source: null, discrepancy: null };
  if (fromRule === null) return { expiresOn: printed, source: 'printed', discrepancy: null };
  if (printed === null) return { expiresOn: fromRule, source: 'rule', discrepancy: null };
  const earlier = printed < fromRule ? printed : fromRule;
  return { expiresOn: earlier, source: earlier === printed ? 'printed' : 'rule', discrepancy: discrepancyOf(fromRule, printed) };
}
