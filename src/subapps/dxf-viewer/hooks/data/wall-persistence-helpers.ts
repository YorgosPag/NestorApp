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

import { dequal } from 'dequal';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { WallEntity, WallParams } from '../../bim/types/wall-types';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../bim/validators/wall-validator';
import type { WallDoc, WallUpdateInput } from '../../bim/walls/wall-firestore-service';
import type { BimFamilyType } from '../../bim/types/bim-family-type';
import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { resolveEffectiveWallParams } from '../../bim/family-types/resolve-effective-params';
import { resolveAutoWallTypeId } from '../../bim/family-types/wall-type-auto-assign';
import { mergeDocsIntoScene } from './merge-docs-into-scene';

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
 * Narrow a category-agnostic `BimFamilyType` to a wall type. `getType` returns
 * the union default (`BimFamilyType`); resolution needs `BimFamilyType<'wall'>`.
 * Returns `null` for a non-wall type so resolution degrades to the fast-path.
 */
function asWallType(
  type: BimFamilyType | null,
): BimFamilyType<'wall'> | null {
  return type && type.category === 'wall'
    ? (type as BimFamilyType<'wall'>)
    : null;
}

/**
 * ADR-412 «type always wins» — resolve a typed wall's effective params from the
 * live family-type store. Reads the store statically (`getState().getType`,
 * zustand pattern) so this pure helper can resolve without React scope.
 *
 * Legacy fast-path (ZERO regression): untyped wall OR type not yet loaded →
 * returns the instance's own params untouched (`resolveEffectiveWallParams`
 * short-circuits on `typeId`-absent / `type == null`).
 *
 * @param instance Wall instance: cached `params` + optional `typeId`/`typeOverrides`.
 * @returns The effective `WallParams` for geometry/render.
 */
export function resolveWallParamsFromStore(instance: {
  params: WallParams;
  typeId?: string;
  typeOverrides?: WallEntity['typeOverrides'];
}): WallParams {
  if (!instance.typeId) return instance.params; // legacy fast-path
  const type = asWallType(
    useBimFamilyTypeStore.getState().getType(instance.typeId),
  );
  return resolveEffectiveWallParams(instance, type);
}

/**
 * Re-resolve an in-scene wall against the current family-type store and rebuild
 * its params/geometry/validation cache when the type changed it. Used by the
 * store-version re-resolution effect (a type edit / late type load must re-flow
 * onto placed instances). Untyped walls and walls whose effective params are
 * unchanged return the SAME reference (cheap identity bail = no scene churn).
 *
 * @param wall Existing scene wall.
 * @returns The same `wall` if nothing changed, else a fresh resolved `WallEntity`.
 */
export function reresolveWallEntity(wall: WallEntity): WallEntity {
  if (!wall.typeId) return wall; // legacy fast-path
  const nextParams = resolveWallParamsFromStore(wall);
  if (nextParams === wall.params) return wall;
  return {
    ...wall,
    params: nextParams,
    geometry: computeWallGeometry(nextParams, wall.kind),
    validation: validateWallParams(nextParams).bimValidation,
  };
}

/**
 * Build a scene-side `WallEntity` from a persisted `WallDoc`. Geometry +
 * validation are recomputed via the SSoT pure functions — ADR §G6 stair
 * parallel: geometry is NOT persisted (re-derivable from params).
 *
 * ADR-412 «type always wins»: when the doc carries a `typeId` and the family
 * type is loaded in the store, the type-governed fields are overwritten from the
 * live type (the doc's copy is a drift-tolerant cache). Geometry/validation
 * follow the RESOLVED params. Untyped docs take the legacy fast-path (resolution
 * returns the doc params untouched) — ZERO regression.
 */
export function docToEntity(doc: WallDoc): WallEntity {
  const cachedParams = migrateParamsToMm(doc.params);
  // ADR-412/414 — «re-materialise on load»: an untyped legacy doc whose cross
  // section still matches the category default is lazily linked to the read-only
  // built-in type (in-scene, drift-tolerant — persisted on the next auto-save,
  // NOT a destructive backfill). Customised/manual walls return undefined and
  // keep the legacy fast-path. Effective === cached for a match → zero visual
  // change and no spurious re-map (`wallEntityDiffersFromDoc` diffs effective).
  const typeId = doc.typeId ?? resolveAutoWallTypeId(cachedParams);
  const params = resolveWallParamsFromStore({
    params: cachedParams,
    typeId,
    typeOverrides: doc.typeOverrides,
  });
  // Validation/geometry follow the effective params. Reuse the persisted copies
  // only when nothing was resolved (untyped/unresolved → identity-equal params).
  const resolved = params !== cachedParams;
  const validation = !resolved && doc.validation
    ? doc.validation
    : validateWallParams(params).bimValidation;
  return {
    id: doc.id,
    type: 'wall',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params,
    geometry: !resolved && doc.geometry
      ? doc.geometry
      : computeWallGeometry(params, doc.kind),
    validation,
    visible: true,
    editingBy: doc.editingBy,
    ...(typeId !== undefined && { typeId }),
    ...(doc.typeOverrides !== undefined && { typeOverrides: doc.typeOverrides }),
    // ADR-441 Slice WALL — restore grid hosting bindings so the reconciler keeps the
    // wall following its axes after reload.
    ...(doc.guideBindings !== undefined && { guideBindings: doc.guideBindings }),
  } as WallEntity;
}

export function isWall(entity: AnySceneEntity): entity is WallEntity {
  return (entity as { type?: string }).type === 'wall';
}

/** ADR-412 — the family-type link of a wall (instance ↔ type FK + overrides). */
export interface WallTypeLink {
  readonly typeId?: string;
  readonly typeOverrides?: WallEntity['typeOverrides'];
}

/**
 * ADR-412 — build the `updateWall` patch for a re-edited wall. Always carries the
 * family-type link so a clear/detach persists (`null` → `deleteField()`); an
 * untyped wall sends `null`, an idempotent no-op on Firestore. The auto-save
 * trigger is the gate — this only runs once a change was detected.
 */
export function wallUpdatePatch(entity: WallEntity): WallUpdateInput {
  return {
    params: entity.params,
    validation: entity.validation,
    geometry: entity.geometry,
    layerId: entity.layerId,
    typeId: entity.typeId ?? null,
    typeOverrides: entity.typeOverrides ?? null,
  };
}

/**
 * ADR-412 — has a wall's family-type link changed since it was last saved?
 * Detaching a typed wall keeps its params identical (non-destructive, Q6), so the
 * params-only auto-save diff would miss it — the trigger ORs this in.
 */
export function wallTypeLinkChanged(
  lastSaved: WallTypeLink | undefined,
  wall: WallTypeLink,
): boolean {
  const prevId = lastSaved?.typeId;
  return prevId !== wall.typeId || !dequal(lastSaved?.typeOverrides, wall.typeOverrides);
}

/**
 * Subscribe diff-merge predicate: does an incoming `WallDoc` differ from the
 * in-scene `WallEntity` it would replace?
 *
 * ADR-412 — compares against the doc's EFFECTIVE (type-resolved) params, NOT the
 * raw cached `doc.params`. For a typed wall the scene entity already holds
 * type-resolved params, so diffing against raw `doc.params` would (a) re-map on
 * every snapshot when the type already overwrote the cache, and (b) miss the
 * fact that a cached-param change resolving to the same effective value is a
 * no-op. Untyped walls take the fast-path (effective === cached) — unchanged
 * behaviour = ZERO regression.
 *
 * @param existing The current scene wall (type-resolved params).
 * @param doc      The incoming persisted doc.
 * @returns `true` when params or soft-lock changed (caller should re-map).
 */
export function wallEntityDiffersFromDoc(
  existing: WallEntity,
  doc: WallDoc,
): boolean {
  const effective = resolveWallParamsFromStore({
    params: migrateParamsToMm(doc.params),
    typeId: doc.typeId,
    typeOverrides: doc.typeOverrides,
  });
  return (
    !dequal(existing.params, effective) ||
    !dequal(existing.editingBy, doc.editingBy)
  );
}

/**
 * ADR-412 «type always wins» — re-resolve every typed wall in a scene against
 * the current family-type store and return a fresh scene only when at least one
 * wall's effective params changed. Used by the store-version re-resolution
 * effect (a type edit / late type load must re-flow onto placed instances).
 *
 * Locally dirty walls (in `dirtyIds`) are skipped — local edits win, mirroring
 * the Firestore subscribe selective-skip. Untyped walls and walls whose resolved
 * params are unchanged keep their identity (no scene churn = ZERO regression for
 * the legacy path).
 *
 * @param scene    The active level scene.
 * @param dirtyIds Wall ids with un-persisted local edits (skipped).
 * @returns A new `SceneModel` when something changed, else the SAME `scene`.
 */
export function reresolveSceneWalls(
  scene: SceneModel,
  dirtyIds: ReadonlySet<string>,
): SceneModel {
  let mutated = false;
  const nextEntities = scene.entities.map((e) => {
    if (!isWall(e) || !e.typeId || dirtyIds.has(e.id)) return e;
    const resolved = reresolveWallEntity(e);
    if (resolved !== e) mutated = true;
    return resolved;
  });
  return mutated ? { ...scene, entities: nextEntities } : scene;
}

/** Minimal level-manager surface used by the wall snapshot merge. */
export interface WallMergeLevelManager {
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/** Mutable bookkeeping the wall snapshot merge consults (owned by the hook refs). */
export interface WallMergeRefs {
  readonly dirty: Set<string>;
  readonly deleted: Set<string>;
  readonly pending: Set<string>;
  readonly lastSavedParams: Map<string, WallEntity['params']>;
  readonly lastSavedType: Map<string, WallTypeLink>;
  readonly isWithinGrace: (id: string) => boolean;
}

/**
 * Diff-merge a Firestore wall snapshot into the active scene (selective skip of
 * dirty/pending/grace walls + ADR-412 family-type baseline seed). Thin wall adapter
 * πάνω από το `mergeDocsIntoScene` SSoT (μηδέν copy-pasted loop):
 *   - `differs` = `wallEntityDiffersFromDoc` (ADR-412 «type always wins» — diff vs
 *     EFFECTIVE type-resolved params· reuse, ΟΧΙ re-implement).
 *   - `seedExtraBaseline` = seed του δεύτερου `lastSavedType` map (family-type link).
 *   - `shouldDropOrphan` = deleted-wins (ADR-390: deleted ORphan drop πριν το
 *     dirty/pending keep — byte-equivalent με το πρώην inline loop).
 */
export function mergeWallDocsIntoScene(
  docs: readonly WallDoc[],
  levelId: string,
  lm: WallMergeLevelManager,
  refs: WallMergeRefs,
): void {
  mergeDocsIntoScene<WallDoc, WallEntity, WallEntity['params']>(
    docs,
    levelId,
    lm,
    {
      isEntity: isWall,
      docToEntity: (doc) => docToEntity(doc),
      entityComparable: (e) => e.params, // unused (differs override provided)
      docComparable: (d) => d.params, // baseline seed = raw cached doc.params
      differs: (existing, doc) => wallEntityDiffersFromDoc(existing, doc),
      seedExtraBaseline: (doc) => {
        // ADR-412 — seed the family-type link so a later detach is detectable.
        if (!refs.lastSavedType.has(doc.id)) {
          refs.lastSavedType.set(doc.id, { typeId: doc.typeId, typeOverrides: doc.typeOverrides });
        }
      },
      shouldDropOrphan: (id, r) =>
        r.deleted.has(id) || (!r.dirty.has(id) && !r.pending.has(id)),
    },
    {
      dirty: refs.dirty,
      deleted: refs.deleted,
      pending: refs.pending,
      isWithinGrace: refs.isWithinGrace,
      lastSavedBaseline: refs.lastSavedParams,
    },
  );
}
