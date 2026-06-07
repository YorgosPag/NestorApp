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
// ADR-421 SLICE C — «type always wins» resolution at hydrate time.
import { resolveOpeningEffective } from '../family-types/opening-type-resolution';
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
  // ADR-421 SLICE C — resolve EFFECTIVE params («type always wins») before any
  // derivation. Untyped/unresolved-type openings return their cached params
  // unchanged (legacy fast-path = zero regression). For typed openings the
  // type-governed fields (kind/width/height/frame/glazing) + re-derived
  // operationType flow in, so a stale drift-cache doc self-heals on hydrate.
  const params = resolveOpeningEffective(doc.params, {
    typeId: doc.typeId,
    typeOverrides: doc.typeOverrides,
  });
  const typeResolved = params !== doc.params;
  const validation = (!typeResolved && doc.geometry ? doc.validation : undefined)
    ?? validateOpeningParams(params, hostWall).bimValidation;
  // ADR-363 §5.4 — `params.kind` is the SINGLE source of truth; top-level `kind`
  // (+ `ifcType`) are DERIVED mirrors. Legacy docs whose top-level `doc.kind`
  // diverged self-heal here.
  const kind = params.kind;
  return {
    id: doc.id,
    type: 'opening',
    kind,
    layerId: doc.layerId ?? '0',
    params,
    // Reuse the cached geometry only for untyped docs (params unchanged); typed
    // openings recompute from the resolved (type-governed) params.
    geometry:
      !typeResolved && doc.geometry
        ? doc.geometry
        : computeOpeningGeometry(params, hostWall, hostWall.params.sceneUnits ?? 'mm'),
    validation,
    ifcType: inferOpeningIfcType(kind),
    visible: true,
    ...(doc.typeId !== undefined && { typeId: doc.typeId }),
    ...(doc.typeOverrides !== undefined && { typeOverrides: doc.typeOverrides }),
  } as OpeningEntity;
}
