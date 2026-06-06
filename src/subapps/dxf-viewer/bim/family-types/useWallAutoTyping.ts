'use client';

/**
 * useWallAutoTyping — auto-type-on-create host (Revit «Generic Wall», ADR-412).
 *
 * Returns `ensureAutoWallType(entity)`: the single authority that gives EVERY
 * freshly-drawn wall a shared family type before it is inserted into the scene.
 * Called by the draw tool's `onWallCreated` convergence (which feeds all six
 * creation paths: straight / curved / polyline / on-entity / region / perimeter),
 * so the policy lives in ONE place (N.0.2).
 *
 * Flow (synchronous stamp, async persist — no flicker, no extra undo step):
 *   1. Wall already typed (2-click default → built-in, or a copy) → no-op.
 *   2. Thickness matches a category built-in default → reuse the read-only
 *      built-in (cross-method grouping with default walls).
 *   3. Else find an existing `'auto'` type of the same signature in the store
 *      (sync read → idempotent within a draw batch) → reuse.
 *   4. Else mint one: enterprise id (N.6) → optimistic `setTypes` (immediately
 *      resolvable + visible in «Edit Type») → fire-and-forget persist + audit.
 *   5. Resolve effective params («type always wins») + recompute geometry so the
 *      generic DNA is applied (non-destructive: nominal thickness unchanged).
 *
 * @see ./auto-wall-type.ts — pure policy SSoT
 * @see ../walls/add-wall-to-scene.ts — the insertion the wrapped callback feeds
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { generateBimFamilyTypeId } from '@/services/enterprise-id.service';
import type { WallEntity } from '../types/wall-types';
import type { BimFamilyType } from '../types/bim-family-type';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { validateWallParams } from '../validators/wall-validator';
import { resolveEffectiveWallParams } from './resolve-effective-params';
import { asWallFamilyType } from './family-type-ui-helpers';
import { recordFamilyTypeChange } from './bim-family-type-audit-client';
import { useBimFamilyTypeStore } from './bim-family-type-store';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from './bim-family-type-service';
import {
  buildAutoWallType,
  findAutoWallType,
  resolveAutoWallTypeIdForSignature,
} from './auto-wall-type';

export interface UseWallAutoTypingResult {
  /**
   * Resolve a freshly-built wall to its shared family type, minting + persisting
   * a generic «auto» type when needed. Returns the entity stamped with `typeId`
   * and re-resolved params/geometry, or the entity unchanged when it is already
   * typed or auth is not yet ready (graceful — stays ad-hoc, no throw).
   */
  readonly ensureAutoWallType: (entity: WallEntity) => WallEntity;
}

export function useWallAutoTyping(): UseWallAutoTypingResult {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const userId = user?.uid ?? null;

  const service: BimFamilyTypeService | null = useMemo(
    () =>
      companyId && userId
        ? createBimFamilyTypeService({ companyId, userId })
        : null,
    [companyId, userId],
  );

  const ensureAutoWallType = useCallback(
    (entity: WallEntity): WallEntity => {
      // 1. Already typed (built-in default via buildWallEntity, or a copy) → keep.
      if (entity.typeId) return entity;
      const { category, thickness } = entity.params;
      if (!category || !(thickness > 0)) return entity;

      const store = useBimFamilyTypeStore.getState();
      let type: BimFamilyType<'wall'> | null = null;
      let typeId: string | undefined;

      // 2. Built-in match (cross-method grouping with default walls).
      const builtInId = resolveAutoWallTypeIdForSignature(category, thickness);
      if (builtInId) {
        type = asWallFamilyType(store.getType(builtInId));
        if (!type) return entity; // catalog not seeded yet → leave ad-hoc.
        typeId = builtInId;
      } else {
        // 3. Reuse an existing generic auto-type of the same signature.
        const existing = findAutoWallType(store.getTypes(), category, thickness);
        if (existing) {
          type = existing;
          typeId = existing.id;
        } else {
          // 4. Mint a new generic auto-type (needs auth/service ready).
          if (!service || !companyId || !userId) return entity;
          const id = generateBimFamilyTypeId();
          const built = buildAutoWallType(id, category, thickness, companyId, userId);
          // Optimistic: the store now resolves the new id (Edit Type works at once).
          store.setTypes([...store.getTypes(), built]);
          // Fire-and-forget persist + audit (drawing must not block on the network).
          void service.createTypeWithId(built);
          void recordFamilyTypeChange('created', {
            id,
            name: built.name,
            category: 'wall',
            typeParams: built.typeParams,
          });
          type = built;
          typeId = id;
        }
      }

      // 5. «type always wins» — resolve + recompute geometry from effective params.
      const params = resolveEffectiveWallParams({ params: entity.params, typeId }, type);
      if (params === entity.params) return { ...entity, typeId };
      return {
        ...entity,
        typeId,
        params,
        geometry: computeWallGeometry(params, entity.kind),
        validation: validateWallParams(params).bimValidation,
      };
    },
    [service, companyId, userId],
  );

  return { ensureAutoWallType };
}
