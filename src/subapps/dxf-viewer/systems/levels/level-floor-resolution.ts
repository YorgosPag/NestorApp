'use client';

/**
 * ADR-420 / ADR-399 — resolve the viewer Level that owns a wizard-selected floor.
 *
 * The «Εισαγωγή Κάτοψης» wizard lets the user pick company → project → building →
 * floor. Historically the import wrote into whatever level was *currently active*
 * (`currentLevelId`), so importing onto floor B while floor A's tab was active
 * dumped floor B's scene + context onto floor A. Revit-true behaviour: each
 * building storey (`floorId`) maps to its own Level; the import must target the
 * level bound to the selected floor — creating it if it doesn't exist yet.
 *
 * Stable key = `floorId` (IfcBuildingStorey), consistent with the BIM floor-scope
 * SSoT (see `bim/persistence/bim-floor-scope.ts`).
 */
import type { Level } from './config';

export interface LevelFloorResolver {
  readonly levels: Level[];
  readonly addLevel: (name: string, setAsDefault?: boolean, floorId?: string) => Promise<string | null>;
  readonly linkLevelToFloor: (levelId: string, floorId: string | null, buildingId?: string | null) => Promise<void>;
}

export interface ResolveFloorLevelOptions {
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly entityLabel?: string;
  readonly currentLevelId: string | null;
}

/**
 * Find the Level whose `floorId` matches the selected floor; create + link one
 * when absent. Returns the target level id (or `currentLevelId` for floor-less
 * imports — project/building-level canvases, which are not storeys).
 */
export async function findOrCreateLevelForFloor(
  resolver: LevelFloorResolver,
  opts: ResolveFloorLevelOptions,
): Promise<string | null> {
  // No floor selected (project/building-level import) → keep the active level.
  if (!opts.floorId) return opts.currentLevelId;

  const existing = resolver.levels.find((l) => l.floorId === opts.floorId);
  if (existing) return existing.id;

  const newId = await resolver.addLevel(opts.entityLabel || 'Όροφος', false, opts.floorId);
  if (newId) {
    await resolver.linkLevelToFloor(newId, opts.floorId, opts.buildingId ?? null);
  }
  return newId;
}
