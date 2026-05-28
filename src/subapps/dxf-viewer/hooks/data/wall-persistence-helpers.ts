/**
 * ADR-363 Phase 1B — Pure helpers for `useWallPersistence`.
 *
 * Zero React deps: legacy param migration + `WallDoc → WallEntity` mapping +
 * scene-entity type guard. Extracted from `useWallPersistence.ts` (N.7.1 file
 * size). Geometry + validation are recomputed via the SSoT pure functions —
 * ADR §G6 stair parallel: geometry is NOT persisted (re-derivable from params).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import type { AnySceneEntity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../bim/validators/wall-validator';
import type { WallDoc } from '../../bim/walls/wall-firestore-service';

/**
 * Migrate legacy WallParams (pre-ADR-363 SSOT fix) from scene-unit storage to mm.
 * Detection: sceneUnits absent AND height < 100 (clearly sub-100m → was in meters).
 * Safe to call on already-migrated params (idempotent: sceneUnits present → no-op).
 */
export function migrateParamsToMm(params: WallDoc['params']): WallDoc['params'] {
  if (params.sceneUnits) return params;
  if (params.height >= 100) return { ...params, sceneUnits: 'mm' };
  const k = 1000;
  return {
    ...params,
    height: params.height * k,
    thickness: params.thickness * k,
    dna: params.dna
      ? {
          ...params.dna,
          totalThickness: params.dna.totalThickness * k,
          layers: params.dna.layers.map((l) => ({ ...l, thickness: l.thickness * k })),
        }
      : undefined,
    sceneUnits: 'mm',
  };
}

/**
 * Build a scene-side `WallEntity` from a persisted `WallDoc`. Geometry +
 * validation are recomputed via the SSoT pure functions — ADR §G6 stair
 * parallel: geometry is NOT persisted (re-derivable from params).
 */
export function docToEntity(doc: WallDoc): WallEntity {
  const params = migrateParamsToMm(doc.params);
  const validation = doc.validation ?? validateWallParams(params).bimValidation;
  return {
    id: doc.id,
    type: 'wall',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params,
    geometry: doc.geometry ?? computeWallGeometry(params, doc.kind),
    validation,
    visible: true,
    editingBy: doc.editingBy,
  } as WallEntity;
}

export function isWall(entity: AnySceneEntity): entity is WallEntity {
  return (entity as { type?: string }).type === 'wall';
}
