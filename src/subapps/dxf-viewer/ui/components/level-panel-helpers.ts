/**
 * LevelPanel — pure helpers.
 * Extracted from `LevelPanel.tsx` for file-size compliance (<500 lines);
 * behavior-preserving.
 *
 * @module ui/components/level-panel-helpers
 * @see ./LevelPanel.tsx
 */

import { ENTITY_TYPES, type EntityType } from '@/config/domain-constants';
import type { FloorplanType } from '../../systems/levels/config';
import type { DuplicateDestinationFloor } from '@/features/floorplan-import';

/** Map a navigation entity type → floorplan type (undefined for non-spatial). */
export function entityTypeToFloorplanType(entityType: EntityType): FloorplanType | undefined {
  switch (entityType) {
    case ENTITY_TYPES.PROJECT: return 'project';
    case ENTITY_TYPES.BUILDING: return 'building';
    case ENTITY_TYPES.FLOOR: return 'floor';
    case ENTITY_TYPES.PROPERTY: return 'unit';
    default: return undefined;
  }
}

/** Minimal building-floor shape needed to build duplicate destinations. */
interface DuplicateFloorLike {
  readonly id: string;
  readonly name?: string;
  readonly number: number;
}

/**
 * ADR-465 — destination floors for the cross-floor duplicate dialog: every building
 * floor except the source. Pure (label fallback via the injected translator).
 */
export function buildDuplicateDestinations(
  buildingFloors: readonly DuplicateFloorLike[],
  sourceFloorId: string | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): DuplicateDestinationFloor[] {
  if (!sourceFloorId) return [];
  return buildingFloors
    .filter((f) => f.id !== sourceFloorId)
    .map((f) => ({ id: f.id, name: f.name || t('panels.levels.defaultLevelName', { number: f.number }) }));
}
