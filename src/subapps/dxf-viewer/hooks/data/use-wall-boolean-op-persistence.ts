'use client';

/**
 * ADR-628 — `useWallBooleanOpPersistence`: ONE shared-hook-primitive behind the
 * two byte-twin wall boolean-operation persistence hooks (`useWallMergePersistence`
 * ADR-566 ⇄ `useWallSplitPersistence` ADR-363 §Phase X).
 *
 * Both hooks are pure side-effect EventBus subscribers mounted inside
 * `WallPersistenceHost`. They shared ~100 identical lines: the params surface, the
 * wall+opening Firestore service refs, the live-scope refs (read at event time), the
 * `resolveBimPersistenceScope` service-init effect, the wall-BOQ upsert/delete blocks,
 * the opening-update fan-out, and the subscribe effect. The ONLY genuine per-op
 * variance is the committed EventBus event + the delete/save sequence it triggers.
 *
 * The invariant scaffold lives HERE once; each op is a thin `run(payload, ctx)`
 * callback. Behaviour is preserved 1:1 with the hand-rolled hooks — same Firestore
 * writes, same BOQ rows, same audit records, in the same order.
 *
 * Reference-stability (ADR-626 lesson): `run` is read through a ref at event time, so
 * the subscribe effect keys on the stable `event` literal only (subscribe once per
 * mount) even though callers pass an inline `run` each render.
 *
 * @see hooks/data/useWallMergePersistence.ts — merge binding
 * @see hooks/data/useWallSplitPersistence.ts — split binding
 * @see docs/centralized-systems/reference/adrs/ADR-628-wall-boolean-op-persistence-ssot.md
 */

import { useEffect, useRef } from 'react';

import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningUpdate } from '../../bim/walls/wall-split';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createWallFirestoreService,
  WallFirestoreService,
} from '../../bim/walls/wall-firestore-service';
import {
  createOpeningFirestoreService,
  OpeningFirestoreService,
} from '../../bim/walls/opening-firestore-service';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { EventBus, type DrawingEventType, type DrawingEventPayload } from '../../systems/events/EventBus';

// ============================================================================
// PUBLIC TYPES (shared by both bindings)
// ============================================================================

export interface UseWallBooleanOpPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
}

/** Live building-scoped BOQ context, read at event time. `null` when incomplete. */
export interface WallBoqScope {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  readonly floorId: string | undefined;
}

/** Context handed to a `run` callback — resolved services + live BOQ scope. */
export interface WallBooleanOpContext {
  readonly wallSvc: WallFirestoreService;
  readonly openingSvc: OpeningFirestoreService;
  /** `null` when company/project/building scope is incomplete (skip BOQ feed). */
  readonly boqScope: WallBoqScope | null;
}

// ============================================================================
// SHARED BOQ / OPENING PRIMITIVES (identical across merge + split)
// ============================================================================

/**
 * Auto-feed a boolean-op-produced wall into the BOQ (single-entry payload). Mirrors
 * the pre-ADR-628 inline block byte-for-byte — deliberately NOT scene/finish-aware
 * (`useWallPersistence` uses `wallBoqEntity(entity, scene)`; boolean-op results feed
 * the minimal snapshot, preserving prior behaviour).
 */
export function upsertMergedWallBoq(wall: WallEntity, boqScope: WallBoqScope): void {
  void bimToBoqBridge.upsertBoqItemForBim(
    'wall',
    {
      id: wall.id,
      kind: wall.kind,
      geometry: wall.geometry,
      params: wall.params as unknown as Readonly<{ [key: string]: unknown; category?: string }>,
    },
    {
      companyId: boqScope.companyId,
      projectId: boqScope.projectId,
      buildingId: boqScope.buildingId,
      floorId: boqScope.floorId,
    },
    'created',
  );
}

/** Remove the auto-fed BOQ row for a consumed wall. */
export function deleteWallBoq(wallId: string, companyId: string): void {
  void bimToBoqBridge.deleteBoqItemForBim(wallId, companyId);
}

/** Persist each redistributed/re-hosted opening's new params (no-op on empty). */
export async function applyOpeningUpdates(
  openingSvc: OpeningFirestoreService,
  openingUpdates: readonly OpeningUpdate[],
): Promise<void> {
  if (openingUpdates.length === 0) return;
  await Promise.all(
    openingUpdates.map(({ openingId, nextParams }) =>
      openingSvc.updateOpening(openingId, { params: nextParams }),
    ),
  );
}

// ============================================================================
// THE PRIMITIVE
// ============================================================================

/**
 * Subscribe to a single wall boolean-op committed event and run `run` with the
 * resolved wall+opening services and live BOQ scope. Owns the invariant scaffold;
 * the caller owns only the op-specific delete/save/BOQ/audit sequence.
 */
export function useWallBooleanOpPersistence<K extends DrawingEventType>(
  params: UseWallBooleanOpPersistenceParams,
  event: K,
  run: (payload: DrawingEventPayload<K>, ctx: WallBooleanOpContext) => Promise<void>,
): void {
  const { companyId, projectId, floorplanId, buildingId, floorId, userId } = params;

  const wallSvcRef = useRef<WallFirestoreService | null>(null);
  const openingSvcRef = useRef<OpeningFirestoreService | null>(null);

  // Refs for the async handler — avoid stale closure, no re-subscription on change.
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const buildingIdRef = useRef(buildingId);
  buildingIdRef.current = buildingId;
  const floorIdRef = useRef(floorId);
  floorIdRef.current = floorId;

  // Reference-stable run (ADR-626) — read at event time so the subscribe effect
  // keys on the stable `event` literal only.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      wallSvcRef.current = null;
      openingSvcRef.current = null;
      return;
    }
    // ADR-420 — include the durable floorId in scope (parity with useWallPersistence)
    // so boolean-op-produced walls/openings persist under the stable floor key.
    const cfg = {
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    };
    wallSvcRef.current = createWallFirestoreService(cfg);
    openingSvcRef.current = createOpeningFirestoreService(cfg);
  }, [companyId, projectId, floorplanId, floorId, userId]);

  useEffect(() => {
    return EventBus.on(event, (payload) => {
      const wallSvc = wallSvcRef.current;
      const openingSvc = openingSvcRef.current;
      if (!wallSvc || !openingSvc) return;

      const cId = companyIdRef.current;
      const pId = projectIdRef.current;
      const bId = buildingIdRef.current;
      const boqScope: WallBoqScope | null =
        cId && pId && bId
          ? { companyId: cId, projectId: pId, buildingId: bId, floorId: floorIdRef.current ?? undefined }
          : null;

      void runRef.current(payload, { wallSvc, openingSvc, boqScope });
    });
  }, [event]);
}
