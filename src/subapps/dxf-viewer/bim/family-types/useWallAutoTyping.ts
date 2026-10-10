'use client';

/**
 * useWallAutoTyping — auto-type-on-create host (Revit «Generic Wall», ADR-412).
 *
 * The policy is pure (`./wall-typer.ts`); this hook is only the side-effect half:
 * it supplies the catalog + the enterprise id (N.6) + ownership, and persists the
 * types a typer had to mint.
 *
 * Two entry points, one implementation:
 *   - `beginWallTyping()` — a session for a BUILD that may reject walls (region
 *     fill, the «model from drawing» assistant). The stamp runs INSIDE the build,
 *     before auto-join and the no-overlap check, so preview ≡ commit (ADR-911 Φ3).
 *     `commit(walls)` persists only the types the surviving walls reference — a
 *     rejected wall or an unapproved proposal leaves no orphan type.
 *   - `ensureAutoWallType(entity)` — the session of one, for the single-wall paths
 *     (straight / curved / polyline / on-entity).
 *
 * Persist is optimistic + fire-and-forget (no flicker, no extra undo step): the
 * store resolves the new id at once, the network write follows.
 *
 * @see ./wall-typer.ts — the pure typer
 * @see ./auto-wall-type.ts — pure policy SSoT
 * @see ../walls/add-wall-to-scene.ts — the insertion the wrapped callback feeds
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { generateBimFamilyTypeId } from '@/services/enterprise-id.service';
import type { WallEntity } from '../types/wall-types';
import type { BimFamilyType } from '../types/bim-family-type';
import { recordFamilyTypeChange } from './bim-family-type-audit-client';
import { useBimFamilyTypeStore } from './bim-family-type-store';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from './bim-family-type-service';
import { buildAutoWallType } from './auto-wall-type';
import { createWallTyper, type AutoWallTypeMint, type WallTypingSession } from './wall-typer';

export interface UseWallAutoTypingResult {
  /** Open a typing session for a build that may reject some of its walls. */
  readonly beginWallTyping: () => WallTypingSession;
  /**
   * Resolve ONE freshly-built wall to its shared family type, minting + persisting
   * a generic «auto» type when needed. Returns the entity unchanged when it is already
   * typed or auth is not yet ready (graceful — stays ad-hoc, no throw).
   */
  readonly ensureAutoWallType: (entity: WallEntity) => WallEntity;
}

function persistMintedTypes(types: readonly BimFamilyType<'wall'>[], service: BimFamilyTypeService): void {
  if (types.length === 0) return;
  const store = useBimFamilyTypeStore.getState();
  // Optimistic: the store now resolves the new ids (Edit Type works at once).
  store.setTypes([...store.getTypes(), ...types]);
  for (const built of types) {
    // Fire-and-forget persist + audit (drawing must not block on the network).
    void service.createTypeWithId(built);
    void recordFamilyTypeChange('created', {
      id: built.id,
      name: built.name,
      category: 'wall',
      typeParams: built.typeParams,
    });
  }
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

  const beginWallTyping = useCallback((): WallTypingSession => {
    // Minting needs auth + service; without them matching walls stay ad-hoc.
    const mint: AutoWallTypeMint | null =
      service && companyId && userId
        ? (category, thicknessMm) =>
            buildAutoWallType(generateBimFamilyTypeId(), category, thicknessMm, companyId, userId)
        : null;
    const typer = createWallTyper({ types: useBimFamilyTypeStore.getState().getTypes(), mint });
    return {
      typeWall: typer.typeWall,
      commit: (walls) => {
        if (service) persistMintedTypes(typer.mintedFor(walls), service);
      },
    };
  }, [service, companyId, userId]);

  const ensureAutoWallType = useCallback(
    (entity: WallEntity): WallEntity => {
      const session = beginWallTyping();
      const typed = session.typeWall(entity);
      session.commit([typed]);
      return typed;
    },
    [beginWallTyping],
  );

  return { beginWallTyping, ensureAutoWallType };
}
