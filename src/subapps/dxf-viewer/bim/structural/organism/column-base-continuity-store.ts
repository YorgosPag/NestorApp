/**
 * Column base-continuity store — transient DERIVED transport (ADR-488 §6.1).
 *
 * Μικρό external store που κρατά την τελευταία DERIVED **effective βάση** ανά κολώνα
 * (`columnId → effectiveBaseZmm`, απόλυτο mm = άνω παρειά στηρίζοντος πεδίλου), ώστε το
 * **render path** (`bim-scene-attach-syncs.syncColumns`) — που είναι per-entity & δεν έχει
 * πρόσβαση στον graph — να παίρνει το «πόσο κατεβαίνει η βάση» με ΕΝΑ synchronous read,
 * αντί να ξαναχτίζει τον organism graph σε κάθε render.
 *
 * Ακριβές mirror του `BeamSupportConditionStore` (ADR-486):
 *   · Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events με το
 *     `StructuralDiagnosticsStore`), όχι σε pan/zoom/hover → ADR-040 safe.
 *   · `get`-style synchronous read (ΟΧΙ subscription στο render path). Zero React.
 *   · SSoT writer = `useStructuralOrganism` shell hook. Reader = `syncColumns`.
 *   · DERIVED, ΠΟΤΕ persisted — η αλήθεια ζει στην τοπολογία/πέδιλα· εδώ είναι cache.
 *
 * @see ./derive-column-base-continuity.ts — buildColumnBaseContinuityMap (ο builder)
 * @see ../../../hooks/useStructuralOrganism.ts — ο writer
 * @see ../../../bim-3d/scene/bim-scene-attach-syncs.ts — ο reader (render path)
 */

const EMPTY: ReadonlyMap<string, number> = new Map();

let byColumnId: ReadonlyMap<string, number> = EMPTY;

export const ColumnBaseContinuityStore = {
  /** Αντικατάστησε τον χάρτη DERIVED effective βάσεων (organism pass). */
  set(next: ReadonlyMap<string, number>): void {
    byColumnId = next.size === 0 ? EMPTY : next;
  },
  /**
   * Η DERIVED effective βάση (απόλυτο mm) μιας κολώνας, ή `undefined` αν δεν εδράζεται
   * σε πέδιλο χαμηλότερα από τη nominal βάση της → ο caller κρατά τη nominal βάση.
   */
  get(columnId: string): number | undefined {
    return byColumnId.get(columnId);
  },
} as const;
