/**
 * ADR-421 SLICE C — Opening «type always wins» resolution + scene re-resolution.
 *
 * Pure SSoT shared by the opening persistence layer (hydration + diff-merge) and
 * the catalog-bump re-resolution hook. The opening analogue of the wall pieces in
 * `wall-persistence-helpers.ts`, kept here (family-types home) so `opening-doc-
 * hydration.ts` and `useOpeningTypeReresolution.ts` import it WITHOUT a
 * `bim → hooks` dependency.
 *
 * Catalog reads go through `useBimFamilyTypeStore.getState()` (imperative store
 * read, not React state) — exactly the wall `resolveWallParamsFromStore` idiom.
 * Untyped openings take the legacy fast-path (params unchanged) — zero regression.
 *
 * @see ./resolve-effective-params.ts §resolveEffectiveOpeningParams
 * @see ../walls/opening-doc-hydration.ts — consumer (hydration)
 * @see ../../hooks/data/useOpeningTypeReresolution.ts — consumer (catalog bump)
 */

import { dequal } from 'dequal';

import type { SceneModel } from '../../types/entities';
import { isWallHostedOpening, type OpeningEntity, type OpeningParams } from '../types/opening-types';
import type { OpeningTypeParams } from '../types/bim-family-type';
import type { WallEntity } from '../types/wall-types';
import { computeOpeningGeometry } from '../geometry/opening-geometry';
import { resolveOperationType } from '../types/opening-operation-types';
import { useBimFamilyTypeStore } from './bim-family-type-store';
import { asOpeningFamilyType } from './family-type-ui-helpers';
import { resolveEffectiveOpeningParams } from './resolve-effective-params';

/** The Family/Type link fields carried by an opening doc / entity. */
export interface OpeningTypeLink {
  readonly typeId?: string;
  readonly typeOverrides?: Partial<OpeningTypeParams>;
}

/**
 * Resolve the EFFECTIVE params of an opening from its cached params + type link,
 * reading the live catalog. Untyped (no `typeId`) or unresolved-type openings
 * return their cached params UNCHANGED (legacy fast-path). For typed openings the
 * type-governed fields win and `operationType` is re-derived from the (possibly
 * type-governed) `kind` + instance `handing` — a family swap via the Type must
 * re-flow the IFC operation.
 */
export function resolveOpeningEffective(
  cached: OpeningParams,
  link: OpeningTypeLink,
): OpeningParams {
  if (!link.typeId) return cached;
  const type = asOpeningFamilyType(useBimFamilyTypeStore.getState().getType(link.typeId));
  if (!type) return cached;
  const effective = resolveEffectiveOpeningParams(
    { params: cached, typeId: link.typeId, typeOverrides: link.typeOverrides },
    type,
  );
  return { ...effective, operationType: resolveOperationType(effective.kind, effective.handing) };
}

/**
 * True when an in-scene opening entity differs from the EFFECTIVE state of an
 * incoming doc (params resolved «type wins», plus the type-link fields). Compares
 * against the resolved doc — NOT the raw cached `doc.params` — so a stale
 * drift-tolerant cache never triggers a spurious re-hydrate after the type has
 * re-flowed onto the live entity.
 */
export function openingEntityDiffersFromDoc(
  existing: OpeningEntity,
  doc: { params: OpeningParams } & OpeningTypeLink,
): boolean {
  const resolved = resolveOpeningEffective(doc.params, doc);
  return (
    !dequal(existing.params, resolved) ||
    (existing.typeId ?? null) !== (doc.typeId ?? null) ||
    !dequal(existing.typeOverrides ?? null, doc.typeOverrides ?? null)
  );
}

/**
 * True when the Family/Type link of an opening changed vs its last-saved link —
 * ORed into the auto-save trigger so a pure detach (params unchanged, `typeId`
 * cleared) or an override-only edit still persists.
 */
export function openingTypeLinkChanged(
  lastSaved: OpeningTypeLink | undefined,
  opening: OpeningTypeLink,
): boolean {
  return (
    (lastSaved?.typeId ?? null) !== (opening.typeId ?? null) ||
    !dequal(lastSaved?.typeOverrides ?? null, opening.typeOverrides ?? null)
  );
}

/**
 * The Firestore update patch for an opening's type link: a value to write, or
 * `null` to clear the field (detach / reset overrides). Mirrors `wallUpdatePatch`.
 */
export function openingUpdateLinkPatch(
  entity: OpeningTypeLink,
): { typeId: string | null; typeOverrides: Partial<OpeningTypeParams> | null } {
  return {
    typeId: entity.typeId ?? null,
    typeOverrides: entity.typeOverrides ?? null,
  };
}

/**
 * Re-resolve a single typed opening entity against the live catalog, recomputing
 * its geometry from the host wall. Returns the SAME entity reference when nothing
 * changed (identity bail → no needless scene churn). Untyped openings + openings
 * whose host wall is missing return unchanged.
 */
export function reresolveOpeningEntity(
  entity: OpeningEntity,
  hostWall: WallEntity | null,
): OpeningEntity {
  if (!entity.typeId || !hostWall) return entity;
  const params = resolveOpeningEffective(entity.params, entity);
  if (dequal(params, entity.params)) return entity;
  const geometry = computeOpeningGeometry(params, hostWall, hostWall.params.sceneUnits ?? 'mm');
  return { ...entity, kind: params.kind, params, geometry };
}

/**
 * Re-resolve every typed opening in a scene against the live catalog (driven by a
 * family-type store `version` bump). Locally-dirty openings are skipped (local
 * edits win). Returns the SAME scene reference when nothing changed.
 */
export function reresolveSceneOpenings(
  scene: SceneModel,
  dirtyIds: ReadonlySet<string>,
): SceneModel {
  const wallsById = new Map<string, WallEntity>();
  for (const e of scene.entities) {
    if ((e as { type?: string }).type === 'wall') wallsById.set(e.id, e as unknown as WallEntity);
  }

  let mutated = false;
  const nextEntities = scene.entities.map((e) => {
    if ((e as { type?: string }).type !== 'opening') return e;
    const opening = e as unknown as OpeningEntity;
    if (!opening.typeId || dirtyIds.has(opening.id)) return e;
    // ADR-615 — a self-hosted opening carries no `wallId`; `null` host is normal.
    const host = isWallHostedOpening(opening) ? wallsById.get(opening.params.wallId) ?? null : null;
    const next = reresolveOpeningEntity(opening, host);
    if (next !== opening) mutated = true;
    return next;
  });

  return mutated ? { ...scene, entities: nextEntities } : scene;
}
