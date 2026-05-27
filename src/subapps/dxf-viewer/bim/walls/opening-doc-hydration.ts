/**
 * Opening doc → entity hydration + type guards.
 * Extracted from `useOpeningPersistence` to keep the hook under the 500-line
 * cap (CLAUDE.md N.7.1). Pure functions, no React state.
 */

import type { AnySceneEntity } from '../../types/entities';
import type { OpeningEntity } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { computeOpeningGeometry } from '../geometry/opening-geometry';
import { validateOpeningParams } from '../validators/opening-validator';
import type { OpeningDoc } from './opening-firestore-service';

export function isOpening(entity: AnySceneEntity): entity is OpeningEntity {
  return (entity as { type?: string }).type === 'opening';
}

export function isWall(entity: AnySceneEntity): entity is WallEntity {
  return (entity as { type?: string }).type === 'wall';
}

/**
 * Build a scene-side `OpeningEntity` από persisted `OpeningDoc` + host wall.
 * Returns `null` όταν ο host wall δεν είναι ακόμα στο scene — caller skips
 * την snapshot entry μέχρι το επόμενο round-trip (re-hydrate).
 */
export function openingDocToEntity(
  doc: OpeningDoc,
  hostWall: WallEntity | null,
): OpeningEntity | null {
  if (!hostWall) return null;
  const validation = doc.validation ?? validateOpeningParams(doc.params, hostWall).bimValidation;
  return {
    id: doc.id,
    type: 'opening',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeOpeningGeometry(doc.params, hostWall, hostWall.params.sceneUnits ?? 'mm'),
    validation,
    visible: true,
  } as OpeningEntity;
}
