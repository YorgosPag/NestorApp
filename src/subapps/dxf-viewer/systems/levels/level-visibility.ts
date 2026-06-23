/**
 * Level visibility / eligibility SSoT (ADR-461 / ADR-420).
 *
 * The levels collection is bootstrapped (once per company) with a single default
 * working level «Επίπεδο 1» that carries **no `floorId` and no `buildingId`**
 * (see `LevelOperations.createDefaultLevels`). That is a fine starting surface
 * while the project has no building structure yet.
 *
 * The moment a building exists — i.e. at least one level is bound to a building
 * `floorId` (created by the import wizard via `ensureLevelsForBuilding` /
 * `findOrCreateLevelForFloor`) — that unlinked default becomes a **data-loss
 * landmine**: anything drawn while it is active is persisted with a `floorId`-less
 * scope (ADR-420 `bimScopeWriteFields` only writes `floorId` when present), and on
 * the next `floorId`-scoped reload the subscription queries `where('floorId','==',…)`,
 * the orphaned docs don't match, and they are dropped → permanent data loss
 * (root cause, 2026-06-23 handoff §2).
 *
 * Revit-grade rule: one drawing surface per storey, with a stable identity
 * (`floorId`). So once structure exists the unlinked default must be neither
 * **visible** in the «Στάθμες» panel nor **selectable** as the active level.
 *
 * Pure + dependency-free so it is the single source consumed by:
 *   - `level-display-order.ts`     → hides it from the panel
 *   - `useLevelsFirestoreSync.ts`  → never auto-elects it as active
 *
 * @module systems/levels/level-visibility
 */

import type { Level } from './config';

/**
 * The bootstrap default level that was never linked to a building floor
 * (`isDefault`, no `floorId`, no `buildingId`). This is the orphan surface that
 * silently loses data once a building exists.
 */
export function isUnlinkedDefaultLevel(level: Level): boolean {
  return level.isDefault === true && !level.floorId && !level.buildingId;
}

/** True when building structure exists — at least one level is bound to a floor. */
export function hasFloorLinkedLevel(levels: readonly Level[]): boolean {
  return levels.some((l) => !!l.floorId);
}

/**
 * Levels eligible to be shown / selected as drawing surfaces. When building
 * structure exists, the unlinked bootstrap default is filtered out (data-loss
 * landmine, see module doc). With no structure yet, every level passes through —
 * the default is then the only working surface and must stay.
 *
 * Pure: same input → same output, never mutates the input array. Floor-linked
 * levels are never removed, so the result is non-empty whenever the input is.
 */
export function selectVisibleLevels(levels: readonly Level[]): Level[] {
  if (!hasFloorLinkedLevel(levels)) return [...levels];
  return levels.filter((l) => !isUnlinkedDefaultLevel(l));
}

/**
 * Choose the level to auto-elect as active. Prefers a floor-linked level over the
 * unlinked bootstrap default, so drawing never starts on the orphan surface.
 * Falls back to the raw list only in the degenerate (structure-less) case.
 */
export function pickActiveLevel(levels: readonly Level[]): Level | undefined {
  const visible = selectVisibleLevels(levels);
  const pool = visible.length > 0 ? visible : levels;
  return pool.find((l) => l.isDefault) ?? pool[0];
}
