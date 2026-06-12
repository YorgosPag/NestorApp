/**
 * Associative Grid Hosting — Shared slot→coordinate writers (ADR-441, Slice GEN).
 *
 * Πραγματικό SSoT του follow-on-move: η slot-λογική (start-x/start-y/end-x/end-y για
 * γραμμικά· center-x/center-y για σημειακά + το σταθερό `extend`) είναι **πανομοιότυπη**
 * σε foundation-strip/wall (line) και foundation-pad/column (point). Ζούσε inline στο
 * `derive-params-from-guides.ts` (foundation-only)· εδώ εξάγεται ώστε ΟΛΕΣ οι hosting
 * strategies (foundation/wall/column) να μοιράζονται τον ίδιο, ένα-και-μόνο writer.
 *
 * Pure + immutable + only-changed: επιστρέφει νέες συντεταγμένες ΜΟΝΟ αν άλλαξε ένα
 * τουλάχιστον coordinate, αλλιώς `null` (no-op → ο reconciler δεν γράφει στη σκηνή). Καμία
 * kind-specific γεωμετρία — μόνο coordinate writes· η γεωμετρία βγαίνει μετά από το
 * per-kind SSoT compute της εκάστοτε strategy.
 *
 * @see bim/hosting/guide-binding-types.ts — slot-based hosting model
 * @see bim/hosting/hosting-strategy.ts — per-kind strategy που καλεί αυτά
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { GuideBinding } from './guide-binding-types';

/** Ελάχιστο 2D coordinate contract — preserve extra fields (π.χ. z) στον caller. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Lookup του τρέχοντος offset ενός άξονα. Επιστρέφει `undefined` αν ο άξονας δεν υπάρχει
 * πλέον (διαγραμμένος) ή είναι διαγώνιος (XZ — δεν έχει 1D offset): τότε το αντίστοιχο
 * slot αγνοείται και η entity κρατά το τελευταίο coordinate.
 */
export type GuideOffsetLookup = (guideId: string) => number | undefined;

/**
 * Scene-units μετατόπιση ενός binding endpoint: το `extend` (mm, signed) → scene units
 * μέσω του `scale` (= mm→scene). `undefined` extend → 0 (καμία μετατόπιση).
 */
function extendInSceneUnits(binding: GuideBinding, scale: number): number {
  return binding.extend !== undefined ? binding.extend * scale : 0;
}

/**
 * Re-derive τα start/end coordinates (γραμμικά: strip/tie-beam/wall) από τα τρέχοντα
 * guide offsets. Επιστρέφει νέα x/y per endpoint ΜΟΝΟ αν άλλαξε κάτι, αλλιώς `null`.
 */
export function deriveLineSlots(
  start: Vec2,
  end: Vec2,
  bindings: readonly GuideBinding[],
  getOffset: GuideOffsetLookup,
  scale: number,
): { readonly start: Vec2; readonly end: Vec2 } | null {
  let sx = start.x, sy = start.y, ex = end.x, ey = end.y;
  let changed = false;
  for (const b of bindings) {
    const off = getOffset(b.guideId);
    if (off === undefined) continue;
    const target = off + extendInSceneUnits(b, scale);
    if (b.slot === 'start-x' && sx !== target) { sx = target; changed = true; }
    else if (b.slot === 'start-y' && sy !== target) { sy = target; changed = true; }
    else if (b.slot === 'end-x' && ex !== target) { ex = target; changed = true; }
    else if (b.slot === 'end-y' && ey !== target) { ey = target; changed = true; }
  }
  return changed ? { start: { x: sx, y: sy }, end: { x: ex, y: ey } } : null;
}

/**
 * Re-derive το center/position (σημειακά: pad/column) από τα τρέχοντα guide offsets.
 * Επιστρέφει νέα x/y ΜΟΝΟ αν άλλαξε κάτι, αλλιώς `null`.
 */
export function derivePointSlots(
  pos: Vec2,
  bindings: readonly GuideBinding[],
  getOffset: GuideOffsetLookup,
  scale: number,
): Vec2 | null {
  let x = pos.x, y = pos.y;
  let changed = false;
  for (const b of bindings) {
    const off = getOffset(b.guideId);
    if (off === undefined) continue;
    const target = off + extendInSceneUnits(b, scale);
    if (b.slot === 'center-x' && x !== target) { x = target; changed = true; }
    else if (b.slot === 'center-y' && y !== target) { y = target; changed = true; }
  }
  return changed ? { x, y } : null;
}
