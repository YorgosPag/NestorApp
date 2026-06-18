/**
 * Beam support-condition store — transient DERIVED transport (ADR-486).
 *
 * Μικρό external store που κρατά τον τελευταίο DERIVED τύπο στήριξης ανά δοκάρι
 * (`beamId → BeamSupportType`), ώστε το **render path** (`active-reinforcement.ts`)
 * — που είναι per-entity & pure, χωρίς πρόσβαση στον graph — να παίρνει τον topology-
 * aware τύπο με ΕΝΑ synchronous read, αντί να ξαναχτίζει τον graph σε κάθε render.
 *
 * Low-frequency: γράφεται ΜΟΝΟ στο organism recompute pass (ίδια structural events με
 * το `StructuralDiagnosticsStore`), όχι σε pan/zoom/hover → ADR-040 safe. `getState`-style
 * synchronous read (ΟΧΙ subscription στο render path). Zero React.
 *
 * SSoT writer = `useStructuralOrganism` shell hook. Readers = `active-reinforcement.ts`.
 * DERIVED, ΠΟΤΕ persisted (όπως ο graph) — η αλήθεια ζει στην τοπολογία, εδώ είναι cache.
 *
 * @see ./derive-beam-support.ts — buildBeamSupportTypeMap (ο builder)
 * @see ../../../hooks/useStructuralOrganism.ts — ο writer
 * @see ../active-reinforcement.ts — ο reader (render path)
 */

import type { BeamSupportType } from '../../types/beam-types';

const EMPTY: ReadonlyMap<string, BeamSupportType> = new Map();

let byBeamId: ReadonlyMap<string, BeamSupportType> = EMPTY;

export const BeamSupportConditionStore = {
  /** Αντικατάστησε τον χάρτη DERIVED τύπων στήριξης (organism pass). */
  set(next: ReadonlyMap<string, BeamSupportType>): void {
    byBeamId = next.size === 0 ? EMPTY : next;
  },
  /**
   * Ο DERIVED τύπος στήριξης ενός δοκαριού, ή `undefined` αν δεν έχει υπολογιστεί
   * (π.χ. δοκάρι εκτός οργανισμού) → ο caller κάνει fallback στο stored.
   */
  get(beamId: string): BeamSupportType | undefined {
    return byBeamId.get(beamId);
  },
} as const;
