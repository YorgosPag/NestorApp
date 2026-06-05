/**
 * ADR-417 §10 #3 — Pure helpers for `useRoofPersistence` (roof analogue of
 * `slab-persistence-helpers.ts`).
 *
 * Zero React deps: `RoofDoc → RoofEntity` mapping with family-type resolution
 * («type always wins»), scene-entity type guard, the store-version re-resolution
 * SSoT, and the type-link change predicate. Geometry + validation are recomputed
 * via the SSoT pure functions — geometry is NOT persisted (re-derivable).
 *
 * @see ./slab-persistence-helpers.ts — the slab sibling
 * @see ../../bim/family-types/resolve-effective-params.ts
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #3
 */

import { dequal } from 'dequal';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { RoofEntity, RoofParams } from '../../bim/types/roof-types';
import {
  computeRoofGeometry,
  validateRoofParams,
} from '../../bim/geometry/roof-geometry';
import type { RoofDoc } from '../../bim/roofs/roof-firestore-service';
import type { BimFamilyType } from '../../bim/types/bim-family-type';
import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { resolveEffectiveRoofParams } from '../../bim/family-types/resolve-effective-params';
import { resolveAutoRoofTypeId } from '../../bim/family-types/roof-type-auto-assign';

/**
 * Narrow a category-agnostic `BimFamilyType` to a roof type. Returns `null` for
 * a non-roof type so resolution degrades to the fast-path.
 */
function asRoofType(type: BimFamilyType | null): BimFamilyType<'roof'> | null {
  return type && type.category === 'roof'
    ? (type as BimFamilyType<'roof'>)
    : null;
}

/**
 * ADR-412 «type always wins» — resolve a typed roof's effective params from the
 * live family-type store. Reads the store statically (`getState().getType`) so
 * this pure helper can resolve without React scope.
 *
 * Legacy fast-path (ZERO regression): untyped roof OR type not yet loaded →
 * returns the instance's own params untouched.
 */
export function resolveRoofParamsFromStore(instance: {
  params: RoofParams;
  typeId?: string;
  typeOverrides?: RoofEntity['typeOverrides'];
}): RoofParams {
  if (!instance.typeId) return instance.params; // legacy fast-path
  const type = asRoofType(
    useBimFamilyTypeStore.getState().getType(instance.typeId),
  );
  return resolveEffectiveRoofParams(instance, type);
}

/**
 * Re-resolve an in-scene roof against the current family-type store and rebuild
 * its params/geometry/validation cache when the type changed it. Untyped roofs
 * and roofs whose effective params are unchanged return the SAME reference
 * (cheap identity bail = no scene churn).
 */
export function reresolveRoofEntity(roof: RoofEntity): RoofEntity {
  if (!roof.typeId) return roof; // legacy fast-path
  const nextParams = resolveRoofParamsFromStore(roof);
  if (nextParams === roof.params) return roof;
  return {
    ...roof,
    params: nextParams,
    geometry: computeRoofGeometry(nextParams),
    validation: validateRoofParams(nextParams).bimValidation,
  };
}

/**
 * Build a scene-side `RoofEntity` from a persisted `RoofDoc`. Geometry +
 * validation are recomputed via the SSoT pure functions.
 *
 * ADR-412 «type always wins» + «re-materialise on load»: when the doc carries a
 * `typeId` (or its cross-section still matches a built-in build-up, lazily
 * linking it to the read-only built-in type), the type-governed fields are
 * overwritten from the live type. Geometry/validation follow the RESOLVED
 * params. Untyped docs take the legacy fast-path — ZERO regression.
 */
export function docToEntity(doc: RoofDoc): RoofEntity {
  const cachedParams = doc.params;
  const typeId = doc.typeId ?? resolveAutoRoofTypeId(cachedParams);
  const params = resolveRoofParamsFromStore({
    params: cachedParams,
    typeId,
    typeOverrides: doc.typeOverrides,
  });
  const validation = doc.validation ?? validateRoofParams(params).bimValidation;
  return {
    id: doc.id,
    type: 'roof',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params,
    geometry: computeRoofGeometry(params),
    validation,
    visible: true,
    ...(typeId !== undefined && { typeId }),
    ...(doc.typeOverrides !== undefined && { typeOverrides: doc.typeOverrides }),
  } as RoofEntity;
}

export function isRoof(entity: AnySceneEntity): entity is RoofEntity {
  return (entity as { type?: string }).type === 'roof';
}

/** ADR-417 §10 #3 — the family-type link of a roof (instance ↔ type FK + overrides). */
export interface RoofTypeLink {
  readonly typeId?: string;
  readonly typeOverrides?: RoofEntity['typeOverrides'];
}

/**
 * Has a roof's family-type link changed since it was last saved? Detaching a
 * typed roof keeps its params identical (non-destructive), so the params-only
 * auto-save diff would miss it — the trigger ORs this in.
 */
export function roofTypeLinkChanged(
  lastSaved: RoofTypeLink | undefined,
  roof: RoofTypeLink,
): boolean {
  const prevId = lastSaved?.typeId;
  return prevId !== roof.typeId || !dequal(lastSaved?.typeOverrides, roof.typeOverrides);
}

/**
 * Subscribe diff-merge predicate: does an incoming `RoofDoc` differ from the
 * in-scene `RoofEntity` it would replace? Compares against the doc's EFFECTIVE
 * (type-resolved) params, NOT the raw `doc.params` — for a typed roof the scene
 * entity already holds type-resolved params, so diffing against raw `doc.params`
 * would re-map on every snapshot. Untyped roofs take the fast-path.
 */
export function roofEntityDiffersFromDoc(
  existing: RoofEntity,
  doc: RoofDoc,
): boolean {
  const effective = resolveRoofParamsFromStore({
    params: doc.params,
    typeId: doc.typeId ?? resolveAutoRoofTypeId(doc.params),
    typeOverrides: doc.typeOverrides,
  });
  return !dequal(existing.params, effective);
}

/**
 * ADR-412 «type always wins» — re-resolve every typed roof in a scene against
 * the current family-type store and return a fresh scene only when at least one
 * roof's effective params changed. Locally dirty roofs (in `dirtyIds`) are
 * skipped — local edits win.
 */
export function reresolveSceneRoofs(
  scene: SceneModel,
  dirtyIds: ReadonlySet<string>,
): SceneModel {
  let mutated = false;
  const nextEntities = scene.entities.map((e) => {
    if (!isRoof(e) || !e.typeId || dirtyIds.has(e.id)) return e;
    const resolved = reresolveRoofEntity(e);
    if (resolved !== e) mutated = true;
    return resolved;
  });
  return mutated ? { ...scene, entities: nextEntities } : scene;
}
