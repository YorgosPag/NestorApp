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
import { inferOpeningIfcType } from '@/services/factories/opening.factory';
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
  // ADR-363 §5.4 — `params.kind` is the SINGLE source of truth for the opening
  // type. The top-level `kind` (+ `ifcType`) are purely DERIVED mirrors. Legacy
  // docs whose top-level `doc.kind` diverged from `params.kind` (e.g. a door
  // re-typed to a window without updating the denormalized copy) self-heal here
  // — the renderer + IFC export read the correct kind on the next hydrate.
  const kind = doc.params.kind;
  return {
    id: doc.id,
    type: 'opening',
    kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeOpeningGeometry(doc.params, hostWall, hostWall.params.sceneUnits ?? 'mm'),
    validation,
    ifcType: inferOpeningIfcType(kind),
    visible: true,
  } as OpeningEntity;
}
