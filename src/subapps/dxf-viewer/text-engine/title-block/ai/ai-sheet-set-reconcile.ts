/**
 * ADR-651 Φάση Μ — **reconciliation**: AI structured output → **έγκυρο** σχέδιο σετ φύλλων.
 *
 * Καθαρή συνάρτηση (κανένα I/O, καμία γνώση δικτύου/UI) ⇒ unit-testable, ίδιο μοτίβο με το
 * `reconcileAiTitleBlock` (Φάση Δ): **δεν εμπιστεύεται το LLM**. Κάθε `levelId` που προτείνει το AI
 * περνά από τον έλεγχο «υπάρχει όντως αυτός ο όροφος;» — ό,τι δεν ανήκει στους πραγματικούς ορόφους
 * (hallucination ή typo) **πέφτει** και καταγράφεται στο `droppedLevelIds`.
 *
 * ⚠️ **Ντετερμινισμός**: το AI δίνει μόνο **πρόθεση** (ποιοι όροφοι, τι πρόθεμα/αρχικός αριθμός).
 * Η **σειρά** του σετ ΔΕΝ ορίζεται από το AI — ακολουθεί τη **σειρά των ορόφων** (το display-order
 * SSoT του panel «Στάθμες»), ώστε δύο κλήσεις με το ίδιο input να δίνουν την ίδια αρίθμηση. Οι
 * ίδιοι οι αριθμοί (Α-1, Α-2…) παράγονται από το `sheet-numbering.ts` — εδώ ζει μόνο το πρόθεμα +
 * ο αρχικός αριθμός που θα του δώσει η μαζική επαναρίθμηση.
 *
 * @see ./ai-sheet-set-schema.ts — το raw AI σχήμα
 * @see ../sheet-numbering.ts — η ντετερμινιστική αρίθμηση (autoSheetNumber)
 * @see ../sheet-edits.ts — `renumberSheets` (ο τελικός καταναλωτής prefix/start)
 */

import type { AiSheetSetPlan } from './ai-sheet-set-schema';

/** Ένας υποψήφιος όροφος-φύλλο, όπως τον βλέπει το AI (ταυτότητα + ανθρώπινες ετικέτες). */
export interface SheetSetPlanLevel {
  readonly id: string;
  /** Το όνομα του ορόφου (π.χ. «Ισόγειο», «1ος όροφος») — το κύριο σημασιολογικό σήμα για το AI. */
  readonly name: string;
  /** Η ετικέτα φύλλου του ορόφου (αν έχει οριστεί)· αλλιώς κενή. */
  readonly label: string;
}

/** Η υπόδειξη αρίθμησης, πάντα πλήρης μετά το reconcile (defaults εφαρμοσμένα). */
export interface SheetSetPlanNumbering {
  readonly prefix: string;
  readonly start: number;
}

/** Το **έγκυρο** σχέδιο σετ που καταναλώνει το UI (οδηγεί το `useSheetSetEdits.applyPlan`). */
export interface SheetSetPlan {
  /** Τα ids των ορόφων που θα μπουν στο σετ, στη **σειρά των ορόφων** (όχι στη σειρά του AI). */
  readonly selectedLevelIds: readonly string[];
  /** Τα ids που πρότεινε το AI αλλά δεν αντιστοιχούν σε πραγματικό όροφο (διαφάνεια στο UI). */
  readonly droppedLevelIds: readonly string[];
  /** Πρόθεμα + αρχικός αριθμός για τη μαζική επαναρίθμηση (defaults αν το AI δεν έδωσε). */
  readonly numbering: SheetSetPlanNumbering;
  readonly confidence: number;
  readonly notes: string;
}

/** Κενό/whitespace πρόθεμα ⇒ πέφτει πίσω στο πρόθεμα της γλώσσας (καθαρή σημασιολογία). */
function resolvePrefix(aiPrefix: string | null, defaultPrefix: string): string {
  return aiPrefix?.trim() || defaultPrefix;
}

/** Έγκυρος θετικός ακέραιος αρχικός αριθμός, αλλιώς 1 (ο μηχανικός ξεκινά συχνά αλλού). */
function resolveStart(aiStart: number | null): number {
  return typeof aiStart === 'number' && Number.isFinite(aiStart) && aiStart >= 1
    ? Math.floor(aiStart)
    : 1;
}

/**
 * AI σχέδιο → **έγκυρο** `SheetSetPlan`. Φιλτράρει άγνωστα ids, κρατά τη σειρά των ορόφων, εφαρμόζει
 * ντετερμινιστικά defaults στην αρίθμηση. Ίδιο input ⇒ ίδιο output (καμία τυχαιότητα, καμία σειρά AI).
 */
export function reconcileSheetSetPlan(
  ai: AiSheetSetPlan,
  levels: readonly SheetSetPlanLevel[],
  defaultPrefix: string,
): SheetSetPlan {
  const requested = new Set(ai.selectedLevelIds);
  const knownIds = new Set(levels.map((level) => level.id));

  // Σειρά ορόφων (όχι σειρά AI) ⇒ ντετερμινιστική αρίθμηση, όπως το `renumberSheets`.
  const selectedLevelIds = levels
    .filter((level) => requested.has(level.id))
    .map((level) => level.id);

  // Ό,τι πρότεινε το AI αλλά δεν είναι πραγματικός όροφος (hallucination) — για διαφάνεια στο UI.
  const droppedLevelIds = ai.selectedLevelIds.filter((id) => !knownIds.has(id));

  return {
    selectedLevelIds,
    droppedLevelIds,
    numbering: {
      prefix: resolvePrefix(ai.numberingPrefix, defaultPrefix),
      start: resolveStart(ai.startNumber),
    },
    confidence: ai.confidence,
    notes: ai.notes,
  };
}
