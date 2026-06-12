/**
 * ADR-412 — Pure helpers for `useSlabPersistence` (slab analogue of
 * `wall-persistence-helpers.ts`).
 *
 * Zero React deps: `SlabDoc → SlabEntity` mapping with family-type resolution
 * («type always wins»), scene-entity type guard, and the store-version
 * re-resolution SSoT. Geometry + validation are recomputed via the SSoT pure
 * functions — geometry is NOT persisted (re-derivable from params).
 *
 * @see ./wall-persistence-helpers.ts — the wall sibling
 * @see ../../bim/family-types/resolve-effective-params.ts
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.4
 */

import { dequal } from 'dequal';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SlabEntity, SlabParams } from '../../bim/types/slab-types';
import { computeSlabGeometry } from '../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../bim/validators/slab-validator';
import type { SlabDoc } from '../../bim/slabs/slab-firestore-service';
import type { BimFamilyType } from '../../bim/types/bim-family-type';
import { useBimFamilyTypeStore } from '../../bim/family-types/bim-family-type-store';
import { resolveEffectiveSlabParams } from '../../bim/family-types/resolve-effective-params';
import { resolveAutoSlabTypeId } from '../../bim/family-types/slab-type-auto-assign';

/**
 * Narrow a category-agnostic `BimFamilyType` to a slab type. Returns `null` for
 * a non-slab type so resolution degrades to the fast-path.
 */
function asSlabType(type: BimFamilyType | null): BimFamilyType<'slab'> | null {
  return type && type.category === 'slab'
    ? (type as BimFamilyType<'slab'>)
    : null;
}

/**
 * ADR-412 «type always wins» — resolve a typed slab's effective params from the
 * live family-type store. Reads the store statically (`getState().getType`) so
 * this pure helper can resolve without React scope.
 *
 * Legacy fast-path (ZERO regression): untyped slab OR type not yet loaded →
 * returns the instance's own params untouched.
 */
export function resolveSlabParamsFromStore(instance: {
  params: SlabParams;
  typeId?: string;
  typeOverrides?: SlabEntity['typeOverrides'];
}): SlabParams {
  if (!instance.typeId) return instance.params; // legacy fast-path
  const type = asSlabType(
    useBimFamilyTypeStore.getState().getType(instance.typeId),
  );
  return resolveEffectiveSlabParams(instance, type);
}

/**
 * Re-resolve an in-scene slab against the current family-type store and rebuild
 * its params/geometry/validation cache when the type changed it. Used by the
 * store-version re-resolution effect (a type edit / late type load must re-flow
 * onto placed instances). Untyped slabs and slabs whose effective params are
 * unchanged return the SAME reference (cheap identity bail = no scene churn).
 */
export function reresolveSlabEntity(slab: SlabEntity): SlabEntity {
  if (!slab.typeId) return slab; // legacy fast-path
  const nextParams = resolveSlabParamsFromStore(slab);
  if (nextParams === slab.params) return slab;
  return {
    ...slab,
    params: nextParams,
    geometry: computeSlabGeometry(nextParams),
    validation: validateSlabParams(nextParams).bimValidation,
  };
}

/**
 * Build a scene-side `SlabEntity` from a persisted `SlabDoc`. Geometry +
 * validation are recomputed via the SSoT pure functions.
 *
 * ADR-412 «type always wins» + «re-materialise on load»: when the doc carries a
 * `typeId` (or its cross-section still matches a kind default, lazily linking it
 * to the read-only built-in type), the type-governed fields are overwritten from
 * the live type. Geometry/validation follow the RESOLVED params. Untyped docs
 * take the legacy fast-path — ZERO regression.
 */
export function docToEntity(doc: SlabDoc): SlabEntity {
  const cachedParams = doc.params;
  const typeId = doc.typeId ?? resolveAutoSlabTypeId(cachedParams);
  const params = resolveSlabParamsFromStore({
    params: cachedParams,
    typeId,
    typeOverrides: doc.typeOverrides,
  });
  const validation = doc.validation ?? validateSlabParams(params).bimValidation;
  return {
    id: doc.id,
    type: 'slab',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params,
    // Phase 3.8: always recompute geometry (ensures `maxFreeSpanM`; follows the
    // resolved params for typed slabs).
    geometry: computeSlabGeometry(params),
    validation,
    visible: true,
    ...(typeId !== undefined && { typeId }),
    ...(doc.typeOverrides !== undefined && { typeOverrides: doc.typeOverrides }),
    // ADR-441 Slice GEN-SLAB — re-hydrate grid hosting bindings so floor/roof bays
    // keep following the grid after reload (mirror foundation/beam round-trip).
    ...(doc.guideBindings !== undefined && { guideBindings: doc.guideBindings }),
  } as SlabEntity;
}

export function isSlab(entity: AnySceneEntity): entity is SlabEntity {
  return (entity as { type?: string }).type === 'slab';
}

/** ADR-412 — the family-type link of a slab (instance ↔ type FK + overrides). */
export interface SlabTypeLink {
  readonly typeId?: string;
  readonly typeOverrides?: SlabEntity['typeOverrides'];
}

/**
 * ADR-412 — has a slab's family-type link changed since it was last saved?
 * Detaching a typed slab keeps its params identical (non-destructive, Q6), so
 * the params-only auto-save diff would miss it — the trigger ORs this in.
 */
export function slabTypeLinkChanged(
  lastSaved: SlabTypeLink | undefined,
  slab: SlabTypeLink,
): boolean {
  const prevId = lastSaved?.typeId;
  return prevId !== slab.typeId || !dequal(lastSaved?.typeOverrides, slab.typeOverrides);
}

/**
 * Subscribe diff-merge predicate: does an incoming `SlabDoc` differ from the
 * in-scene `SlabEntity` it would replace?
 *
 * ADR-412 — compares against the doc's EFFECTIVE (type-resolved) params, NOT the
 * raw `doc.params`. For a typed slab the scene entity already holds type-resolved
 * params, so diffing against raw `doc.params` would re-map on every snapshot.
 * Untyped slabs take the fast-path (effective === cached) — unchanged behaviour.
 */
export function slabEntityDiffersFromDoc(
  existing: SlabEntity,
  doc: SlabDoc,
): boolean {
  const effective = resolveSlabParamsFromStore({
    params: doc.params,
    typeId: doc.typeId ?? resolveAutoSlabTypeId(doc.params),
    typeOverrides: doc.typeOverrides,
  });
  return !dequal(existing.params, effective);
}

/**
 * ADR-412 «type always wins» — re-resolve every typed slab in a scene against
 * the current family-type store and return a fresh scene only when at least one
 * slab's effective params changed. Used by the store-version re-resolution
 * effect.
 *
 * Locally dirty slabs (in `dirtyIds`) are skipped — local edits win. Untyped
 * slabs and slabs whose resolved params are unchanged keep their identity (no
 * scene churn = ZERO regression for the legacy path).
 */
export function reresolveSceneSlabs(
  scene: SceneModel,
  dirtyIds: ReadonlySet<string>,
): SceneModel {
  let mutated = false;
  const nextEntities = scene.entities.map((e) => {
    if (!isSlab(e) || !e.typeId || dirtyIds.has(e.id)) return e;
    const resolved = reresolveSlabEntity(e);
    if (resolved !== e) mutated = true;
    return resolved;
  });
  return mutated ? { ...scene, entities: nextEntities } : scene;
}
