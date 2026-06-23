/**
 * Level display-order SSoT (ADR-461 — DXF «Στάθμες» panel ordering).
 *
 * The panel must show levels in a STABLE physical order, not creation order
 * (`Level.order`) which is what `LevelOperations.getLevelsSortedByOrder` and the
 * 3D `sortLevelsTopDown` give. Giorgio's spec (2026-06-16), top → bottom:
 *
 *   «Επίπεδο 1» (the default working level)   ← top (see visibility note below)
 *   Απόληξη Κλιμακοστασίου (stair-penthouse)   ← directly below «Επίπεδο 1»
 *   Δώμα (roof)                                ← physically below the penthouse
 *   …3ος, 2ος, 1ος, Ισόγειο…                   ← counted storeys, number DESC
 *   …Υπόγειο −1, −2…                           ← basements, number DESC
 *   Θεμελίωση (foundation)                     ← ALWAYS bottom
 *
 * Read bottom → top this is the real building stack (foundation, −2, −1, ground,
 * 1, 2, 3, roof, penthouse), with the abstract «Επίπεδο 1» pinned above it.
 *
 * Visibility (ADR-420, 2026-06-23): the «Επίπεδο 1» pin only applies while the
 * project has NO building structure. Once at least one level is bound to a floor,
 * the unlinked bootstrap default is a data-loss landmine and is filtered OUT here
 * via the `selectVisibleLevels` SSoT — so it is neither shown nor (via the same
 * predicate in `useLevelsFirestoreSync`) auto-elected as active.
 *
 * `Level` itself carries no kind/elevation — those live on the linked building
 * `Floor` (ProjectHierarchyContext, ADR-461). Callers pass a resolver that maps a
 * level to its floor classification; pure + resolver-injected so it stays free of
 * React/context and is unit-testable.
 *
 * @see utils/floor-naming.ts — FloorKind + SPECIAL_LEVEL_KINDS SSoT
 * @see ui/components/LevelFloorLink.tsx — same `selectedBuilding.floors` source
 */

import type { Level } from './config';
import type { FloorKind } from '@/utils/floor-naming';
import { selectVisibleLevels } from './level-visibility';

/** Minimal linked-floor classification needed to place a level in the panel. */
export interface LevelFloorClass {
  readonly kind?: FloorKind;
  /** Storey number (… −2, −1, 0=ground, 1, 2 …). */
  readonly number?: number;
}

/** Resolve a level's linked-floor classification, or `undefined` when unlinked. */
export type LevelFloorResolver = (level: Level) => LevelFloorClass | undefined;

// Tier = vertical band in the panel. HIGHER tier ⇒ HIGHER in the list (index 0 = top).
const TIER_DEFAULT = 6; // «Επίπεδο 1» — pinned top
const TIER_STAIR_PENTHOUSE = 5; // Απόληξη Κλιμακοστασίου — just under «Επίπεδο 1»
const TIER_ROOF = 4; // Δώμα
const TIER_STOREY = 3; // ground / standard / mezzanine / basement — ordered by number DESC
const TIER_UNLINKED = 2; // floorless non-default level (no classification, not foundation)
const TIER_FOUNDATION = 1; // Θεμελίωση — pinned bottom

function tierFor(level: Level, cls: LevelFloorClass | undefined): number {
  if (level.isDefault) return TIER_DEFAULT;
  switch (cls?.kind) {
    case 'stair-penthouse':
      return TIER_STAIR_PENTHOUSE;
    case 'roof':
      return TIER_ROOF;
    case 'foundation':
      return TIER_FOUNDATION;
    case undefined:
      // A linked floor we couldn't classify (e.g. another building) still belongs in
      // the storey band; a truly floorless extra level sinks just above foundation.
      return level.floorId ? TIER_STOREY : TIER_UNLINKED;
    default:
      // basement / ground / standard / mezzanine
      return TIER_STOREY;
  }
}

/**
 * Order levels for the «Στάθμες» panel per the spec above. Pure: same inputs →
 * same output. Ties (same tier, same storey number) preserve creation order so the
 * list never jumps around between renders.
 */
export function orderLevelsForPanel(
  levels: readonly Level[],
  resolveFloor: LevelFloorResolver,
): Level[] {
  // ADR-420 — drop the unlinked bootstrap default once building structure exists
  // (it would silently lose any geometry drawn on it). SSoT predicate so the panel
  // and the active-level election stay in lock-step.
  return selectVisibleLevels(levels)
    .map((level, index) => ({ level, index, cls: resolveFloor(level) }))
    .sort((a, b) => {
      const tierA = tierFor(a.level, a.cls);
      const tierB = tierFor(b.level, b.cls);
      if (tierA !== tierB) return tierB - tierA; // higher tier first → nearer top

      // Within the storey band, higher floor number is higher in the list
      // (3ος above Ισόγειο above −2). Missing number ⇒ ground (0).
      if (tierA === TIER_STOREY) {
        const numA = a.cls?.number ?? 0;
        const numB = b.cls?.number ?? 0;
        if (numA !== numB) return numB - numA;
      }

      // Stable fallback: creation order, then original index.
      return a.level.order - b.level.order || a.index - b.index;
    })
    .map((entry) => entry.level);
}
