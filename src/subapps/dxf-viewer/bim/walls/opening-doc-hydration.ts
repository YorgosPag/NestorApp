/**
 * Opening doc → entity hydration + type guards.
 * Extracted from `useOpeningPersistence` to keep the hook under the 500-line
 * cap (CLAUDE.md N.7.1). Pure functions, no React state.
 */

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';
import type { OpeningEntity } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { computeOpeningGeometry } from '../geometry/opening-geometry';
import { validateOpeningParams } from '../validators/opening-validator';
import { inferOpeningIfcType } from '@/services/factories/opening.factory';
// ADR-421 SLICE C — «type always wins» resolution at hydrate time.
import { resolveOpeningEffective, openingEntityDiffersFromDoc } from '../family-types/opening-type-resolution';
import { resolveAutoOpeningTypeId } from '../family-types/auto-opening-type';
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
  // ADR-421 SLICE C follow-up — auto-type-on-load (Revit «Generic»): a legacy
  // untyped opening whose nominal kind+width+height equal the kind default self-
  // links to the read-only built-in opening type on hydrate (custom-dimensioned
  // openings stay ad-hoc). Mirror of `wall-persistence-helpers.ts`
  // (`doc.typeId ?? resolveAutoWallTypeId`). For a built-in match the effective
  // params equal the cache → non-destructive (zero geometry change).
  const typeId = doc.typeId ?? resolveAutoOpeningTypeId(doc.params);
  // ADR-421 SLICE C — resolve EFFECTIVE params («type always wins») before any
  // derivation. Untyped/unresolved-type openings return their cached params
  // unchanged (legacy fast-path = zero regression). For typed openings the
  // type-governed fields (kind/width/height/frame/glazing) + re-derived
  // operationType flow in, so a stale drift-cache doc self-heals on hydrate.
  const params = resolveOpeningEffective(doc.params, {
    typeId,
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
    // `typeId` carries the auto-resolved built-in id for legacy untyped openings
    // (self-heal migration), so they gain «Edit Type» + read-only type-gating.
    ...(typeId !== undefined && { typeId }),
    ...(doc.typeOverrides !== undefined && { typeOverrides: doc.typeOverrides }),
  } as OpeningEntity;
}

/** Minimal level-manager surface used by the opening snapshot merge. */
export interface OpeningMergeLevelManager {
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/** Mutable bookkeeping the opening snapshot merge consults (owned by hook refs). */
export interface OpeningMergeRefs {
  readonly dirty: Set<string>;
  readonly deleted: Set<string>;
  readonly pending: Set<string>;
  readonly lastSavedParams: Map<string, OpeningEntity['params']>;
  readonly lastSavedLink: Map<string, { typeId: OpeningDoc['typeId']; typeOverrides: OpeningDoc['typeOverrides'] }>;
}

/**
 * Diff-merge a Firestore opening snapshot into the active scene (host-aware
 * hydration + selective skip of dirty/pending). Mutates via `lm.setLevelScene`
 * only when the merged set differs. Behavior-identical to the former inline
 * subscribe handler (file-size split).
 */
export function mergeOpeningDocsIntoScene(
  docs: readonly OpeningDoc[],
  levelId: string,
  lm: OpeningMergeLevelManager,
  refs: OpeningMergeRefs,
): void {
  const scene = lm.getLevelScene(levelId);
  if (!scene) return;

  const docsById = new Map<string, OpeningDoc>();
  for (const d of docs) docsById.set(d.id, d);

  const { dirty, deleted, pending, lastSavedParams, lastSavedLink } = refs;
  const wallsById = new Map<string, WallEntity>();
  const sceneOpenings = new Map<string, OpeningEntity>();
  const nonOpenings: AnySceneEntity[] = [];

  for (const e of scene.entities) {
    if (isWall(e)) {
      wallsById.set(e.id, e);
      nonOpenings.push(e);
    } else if (isOpening(e)) {
      sceneOpenings.set(e.id, e);
    } else {
      nonOpenings.push(e);
    }
  }

  const nextOpenings: OpeningEntity[] = [];
  let mutated = false;

  for (const doc of docs) {
    const existing = sceneOpenings.get(doc.id);
    const host = wallsById.get(doc.params.wallId) ?? null;
    if (!existing) {
      if (!dirty.has(doc.id)) {
        const entity = openingDocToEntity(doc, host);
        if (entity) {
          nextOpenings.push(entity);
          mutated = true;
        }
      }
      continue;
    }
    if (dirty.has(doc.id)) {
      nextOpenings.push(existing);
      continue;
    }
    // ADR-421 SLICE C — compare against the EFFECTIVE («type wins») state.
    if (openingEntityDiffersFromDoc(existing, doc)) {
      const entity = openingDocToEntity(doc, host);
      if (entity) {
        nextOpenings.push(entity);
        mutated = true;
      } else {
        nextOpenings.push(existing);
      }
    } else {
      nextOpenings.push(existing);
    }
  }

  // Seed last-saved baselines so loaded openings route through UPDATE (not setDoc).
  for (const doc of docs) {
    if (!lastSavedParams.has(doc.id)) lastSavedParams.set(doc.id, doc.params);
    // ADR-421 SLICE C — track the persisted Family/Type link too.
    if (!lastSavedLink.has(doc.id)) {
      lastSavedLink.set(doc.id, { typeId: doc.typeId, typeOverrides: doc.typeOverrides });
    }
  }

  for (const [id, entity] of sceneOpenings) {
    if (docsById.has(id)) continue;
    if (deleted.has(id)) { mutated = true; continue; }
    // ADR-390 — preserve only dirty / pendingFirstSave openings.
    if (dirty.has(id) || pending.has(id)) {
      nextOpenings.push(entity);
    } else {
      mutated = true;
    }
  }

  if (mutated) {
    lm.setLevelScene(levelId, {
      ...scene,
      entities: [...nonOpenings, ...nextOpenings],
    }, 'remote-echo');
  }
}
