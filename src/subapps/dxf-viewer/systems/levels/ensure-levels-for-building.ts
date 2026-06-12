'use client';

/**
 * ADR-448 Phase 3 — «Φόρτωσε ΟΛΟΥΣ τους ορόφους».
 *
 * When the «Εισαγωγή Κάτοψης» wizard targets a *building*, the engineer wants the
 * whole storey stack open at once (foundation → basement → ground → upper floors),
 * Revit-true, so erection of a multi-storey building is a single step — not one
 * import per floor. This module is the pure, unit-testable **loop** over the
 * per-floor SSoT: it calls `findOrCreateLevelForFloor` once per floor and never
 * re-implements level creation/linking.
 *
 * Idempotent: a floor that already owns a Level is skipped (the per-floor SSoT
 * matches on `floorId`), so re-importing the same building creates no duplicates.
 * Serial `await` keeps the Firestore writes deterministic and the creation order
 * stable (basement → roof), avoiding the level-store race a parallel burst causes.
 *
 * @module systems/levels/ensure-levels-for-building
 * @see systems/levels/level-floor-resolution.ts (the per-floor SSoT it loops)
 */

import { findOrCreateLevelForFloor, type LevelFloorResolver } from './level-floor-resolution';

/** Minimal floor shape the loop needs — a structural subset of `FloorOption`. */
export interface BuildingFloorInput {
  readonly id: string;
  /** Storey number (basement < 0 < upper) — drives the deterministic order. */
  readonly number?: number;
  /** Human label for the created Level (floor long-name / name). */
  readonly label?: string;
}

export interface EnsureLevelResult {
  readonly floorId: string;
  readonly levelId: string | null;
  /** True when this call created a new Level (false = already linked / reused). */
  readonly created: boolean;
}

/**
 * Ensure every floor of `buildingId` owns a viewer Level (find-or-create + link),
 * processed basement → roof for stable creation order. Returns one result per
 * floor. Idempotent: floors that already map to a Level are reused, not doubled.
 */
export async function ensureLevelsForBuilding(
  resolver: LevelFloorResolver,
  floors: ReadonlyArray<BuildingFloorInput>,
  buildingId: string | null,
): Promise<EnsureLevelResult[]> {
  const ordered = [...floors]
    .filter((f) => !!f.id)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  // Snapshot of floors that already own a Level — used only to report `created`.
  const linkedFloorIds = new Set(resolver.levels.map((l) => l.floorId).filter(Boolean));

  const results: EnsureLevelResult[] = [];
  for (const floor of ordered) {
    const created = !linkedFloorIds.has(floor.id);
    const levelId = await findOrCreateLevelForFloor(resolver, {
      floorId: floor.id,
      buildingId: buildingId ?? undefined,
      entityLabel: floor.label,
      currentLevelId: null,
    });
    if (levelId) linkedFloorIds.add(floor.id);
    results.push({ floorId: floor.id, levelId, created });
  }
  return results;
}
