'use client';

/**
 * ADR-408 Φ11 — MEP fitting AUTO-RECONCILIATION host (the "Revit magic").
 *
 * Fittings are NOT drawn by hand. They are derived from the pipe-segment network
 * (`resolveDesiredFittings`) and persisted as first-class elements. This hook is
 * the lifecycle owner that keeps the persisted fittings in lock-step with the
 * pipe topology, exactly like Revit auto-places a fitting whenever two pipes meet:
 *
 *   (a) SUBSCRIBE — listen to the `floorplan_mep_fittings` Firestore docs and
 *       diff-merge them into the active level scene (mirror of
 *       `useMepSegmentPersistence`: same dirty / pending / deleted ref guards so a
 *       merge never fights a local edit or re-introduces a just-deleted doc).
 *
 *   (b) RECONCILE — on every pipe-topology change (segments added / moved /
 *       deleted), compute the DESIRED fitting set and diff it against the persisted
 *       set BY `junctionKey`:
 *         - desired key not persisted        → create  (generateMepFittingId + save)
 *         - persisted key, params changed     → update
 *         - persisted key no longer desired   → delete
 *       Each write is mirrored into the scene + audited.
 *
 * SNAP-FIX LESSON (the loop trap): the reconcile MUST NOT re-fire from the
 * Firestore echo of its own writes. Three defences, all mirrored from the segment
 * persistence hook:
 *   1. dirty / pending / deleted id-ref guards (same as segment merge),
 *   2. a 500ms debounce on the topology trigger,
 *   3. a referentially-stable DESIRED-set signature (`junctionKey + params`) so a
 *      no-op reconcile writes nothing and produces no echo.
 *
 * Auto-fittings are derived state — they are NOT pushed onto the user undo stack.
 *
 * Mount points + params mirror `useMepSegmentPersistence`.
 *
 * @see ./useMepSegmentPersistence.ts — the persistence template (subscribe + merge)
 * @see ../../bim/mep-fittings/mep-fitting-resolve.ts — resolveDesiredFittings (pure)
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { MepFittingEntity, MepFittingDraft } from '../../bim/types/mep-fitting-types';
import { mepFittingIfcType } from '../../bim/types/mep-fitting-types';
import { computeMepFittingGeometry } from '../../bim/geometry/mep-fitting-geometry';
import { resolveDesiredFittings } from '../../bim/mep-fittings/mep-fitting-resolve';
import { resolveSegmentTrims } from '../../bim/mep-fittings/mep-segment-trim';
import { useMepSegmentTrimStore } from '../../bim/mep-fittings/mep-segment-trim-store';
import { makeBimValidation } from '../../bim/types/bim-base';
import {
  createMepFittingFirestoreService,
  entityToSaveInput,
  MepFittingFirestoreService,
  type MepFittingDoc,
} from '../../bim/mep-fittings/mep-fitting-firestore-service';
import { recordMepFittingChange } from '../../bim/mep-fittings/mep-fitting-audit-client';
import { createMepFitting } from '@/services/factories/mep-fitting.factory';

// ============================================================================
// TYPES
// ============================================================================

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseMepFittingAutoReconciliationParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Debounce window for the topology-driven reconcile (echo-loop defence). */
const RECONCILE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS (pure)
// ============================================================================

function isFitting(entity: AnySceneEntity): entity is MepFittingEntity {
  return (entity as { type?: string }).type === 'mep-fitting';
}

/** Build a scene-side `MepFittingEntity` from a persisted `MepFittingDoc`. */
function docToEntity(d: MepFittingDoc): MepFittingEntity {
  return {
    id: d.id,
    type: 'mep-fitting',
    kind: d.kind,
    layerId: d.layerId ?? '0',
    params: d.params,
    // ALWAYS recompute — geometry is a pure cache of params and the bend body
    // shape evolves with the renderer (a persisted square from an older build must
    // not pin a stale footprint). Cheap + idempotent.
    geometry: computeMepFittingGeometry(d.params),
    validation: d.validation ?? makeBimValidation(),
    visible: true,
    ifcType: mepFittingIfcType(d.params.domain),
  } as MepFittingEntity;
}

/**
 * Referentially-stable signature of the DESIRED set: `junctionKey` → params. Two
 * reconcile passes over the same topology produce a `dequal`-equal signature, so
 * the no-op short-circuit below holds and nothing is written (no echo).
 */
function desiredSignature(drafts: readonly MepFittingDraft[]): Record<string, unknown> {
  const sig: Record<string, unknown> = {};
  for (const d of drafts) sig[d.params.junctionKey] = d.params;
  return sig;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepFittingAutoReconciliation(
  params: UseMepFittingAutoReconciliationParams,
): void {
  const { companyId, projectId, floorplanId, userId, levelManager } = params;

  const serviceRef = useRef<MepFittingFirestoreService | null>(null);
  // Persisted fittings keyed by junctionKey → the live doc (reconcile diff input).
  const persistedByKeyRef = useRef<Map<string, MepFittingDoc>>(new Map());
  // Echo-loop guards (mirror of useMepSegmentPersistence).
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  // Last DESIRED signature — no-op short-circuit anchor.
  const lastDesiredSigRef = useRef<Record<string, unknown> | null>(null);
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hydration gate — true after the first Firestore snapshot lands. Reconcile is
  // blocked until then so a create pass never duplicates already-persisted
  // fittings that simply have not loaded yet (avoids junctionKey double-create).
  // State (not ref) so the topology-trigger effect re-runs the moment it flips,
  // materialising fittings for a scene whose topology was already stable on load.
  const [hydrated, setHydrated] = useState<boolean>(false);

  // ── Instantiate service when auth + scope ready ────────────────────────────
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createMepFittingFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // ── (a) Subscribe + diff-merge fitting docs into the active level scene ─────
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    // Re-subscribe (new scope / level) ⇒ unknown persisted set again.
    setHydrated(false);
    persistedByKeyRef.current.clear();
    lastDesiredSigRef.current = null;

    const unsubscribe = svc.subscribeFittings(
      (docs) => {
        // First snapshot flips hydration → unblocks reconcile.
        setHydrated(true);
        mergeDocsIntoScene(docs, levelId, levelManager, {
          persistedByKey: persistedByKeyRef.current,
          deleted: deletedIdsRef.current,
          pending: pendingIdsRef.current,
        });
      },
      () => {
        // A failed subscription must NOT leave hydrated=false forever (that blocks
        // ALL reconcile). Hydrate with the empty set so the topology-driven reconcile
        // can still create fittings.
        setHydrated(true);
      },
    );
    return () => unsubscribe();
  }, [levelManager, companyId, projectId, floorplanId, userId]);

  // ── (b) Reconcile: topology → desired set → create / update / delete ───────
  const reconcile = useCallback(async () => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;
    // Block until the first snapshot lands (avoids duplicate-create on cold load).
    if (!hydrated) return;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene) return;

    const desired = resolveDesiredFittings(scene.entities);
    const sig = desiredSignature(desired);
    // No-op short-circuit: identical topology ⇒ no writes ⇒ no echo.
    if (lastDesiredSigRef.current && dequal(lastDesiredSigRef.current, sig)) return;
    lastDesiredSigRef.current = sig;

    await runReconcileDiff(desired, scene, levelId, levelManager, svc, {
      persistedByKey: persistedByKeyRef.current,
      pending: pendingIdsRef.current,
      deleted: deletedIdsRef.current,
    });
  }, [levelManager, hydrated]);

  // Debounced topology trigger — re-run whenever the active scene reference
  // changes (segment add / move / delete all replace `scene.entities`).
  const currentScene = levelManager.currentLevelId
    ? levelManager.getLevelScene(levelManager.currentLevelId)
    : null;
  const pipeTopologySig = useMemo(
    () => buildPipeTopologySignature(currentScene),
    [currentScene],
  );

  useEffect(() => {
    if (!serviceRef.current) return;
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    reconcileTimerRef.current = setTimeout(() => {
      void reconcile();
    }, RECONCILE_DEBOUNCE_MS);
    return () => {
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    };
  }, [pipeTopologySig, reconcile]);

  // ── (c) Trim index: shorten each pipe where a fitting sits on its end so the
  //        run butts against the fitting (Revit). Render-only (no Firestore / no
  //        persistence / no segment mutation); independent of the hydration gate,
  //        so trims apply even before the fitting docs load. The store's deep-equal
  //        guard makes a no-op topology produce no churn.
  useEffect(() => {
    const levelId = levelManager.currentLevelId;
    const scene = levelId ? levelManager.getLevelScene(levelId) : null;
    useMepSegmentTrimStore.getState().setTrims(
      scene ? resolveSegmentTrims(scene.entities) : new Map(),
    );
  }, [pipeTopologySig, levelManager]);
}

// ============================================================================
// MERGE (subscribe → scene), extracted to keep the hook body lean
// ============================================================================

interface MergeRefs {
  readonly persistedByKey: Map<string, MepFittingDoc>;
  readonly deleted: Set<string>;
  readonly pending: Set<string>;
}

function mergeDocsIntoScene(
  docs: readonly MepFittingDoc[],
  levelId: string,
  levelManager: LevelManagerLike,
  refs: MergeRefs,
): void {
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return;

  // Refresh the persisted-by-junctionKey index (reconcile diff input).
  refs.persistedByKey.clear();
  for (const d of docs) refs.persistedByKey.set(d.params.junctionKey, d);

  const docsById = new Map<string, MepFittingDoc>();
  for (const d of docs) docsById.set(d.id, d);

  const sceneFittings = new Map<string, MepFittingEntity>();
  const nonFittings: AnySceneEntity[] = [];
  for (const e of scene.entities) {
    if (isFitting(e)) sceneFittings.set(e.id, e);
    else nonFittings.push(e);
  }

  const nextFittings: MepFittingEntity[] = [];
  let mutated = false;

  for (const d of docs) {
    if (refs.deleted.has(d.id)) continue;
    // The doc round-tripped — the create write is confirmed, release the guard.
    refs.pending.delete(d.id);
    const existing = sceneFittings.get(d.id);
    if (!existing) {
      nextFittings.push(docToEntity(d));
      mutated = true;
      continue;
    }
    const fresh = docToEntity(d);
    if (!dequal(existing.params, fresh.params)) {
      nextFittings.push(fresh);
      mutated = true;
    } else {
      nextFittings.push(existing);
    }
  }

  // Drop scene fittings whose doc disappeared, unless a write is still pending.
  for (const [id, entity] of sceneFittings) {
    if (docsById.has(id)) continue;
    if (refs.pending.has(id)) nextFittings.push(entity);
    else mutated = true;
  }

  if (mutated) {
    levelManager.setLevelScene(levelId, {
      ...scene,
      entities: [...nonFittings, ...nextFittings],
    });
  }
}

// ============================================================================
// RECONCILE DIFF (desired vs persisted, by junctionKey)
// ============================================================================

interface ReconcileRefs {
  readonly persistedByKey: Map<string, MepFittingDoc>;
  readonly pending: Set<string>;
  readonly deleted: Set<string>;
}

async function runReconcileDiff(
  desired: readonly MepFittingDraft[],
  scene: SceneModel,
  levelId: string,
  levelManager: LevelManagerLike,
  svc: MepFittingFirestoreService,
  refs: ReconcileRefs,
): Promise<void> {
  const desiredByKey = new Map<string, MepFittingDraft>();
  for (const d of desired) desiredByKey.set(d.params.junctionKey, d);

  // Fittings ALREADY shown in the scene, keyed by junctionKey. This — not the
  // Firestore `persistedByKey` index — is the de-dup truth: the scene always
  // reflects what the user sees, even when persistence fails (rules not deployed).
  // Keying create/delete off the scene makes reconcile idempotent regardless of
  // Firestore success, so a failed save can never spawn a duplicate next pass.
  const sceneByKey = new Map<string, MepFittingEntity>();
  for (const e of scene.entities) {
    if (isFitting(e)) sceneByKey.set(e.params.junctionKey, e);
  }

  const sceneOps: { readonly create: MepFittingEntity[]; readonly deleteIds: string[] } = {
    create: [],
    deleteIds: [],
  };

  // Create (only when the junctionKey is NOT already in the scene) + update.
  for (const [key, draft] of desiredByKey) {
    if (sceneByKey.has(key)) {
      // Already visible — persist an update only if a saved doc exists and changed.
      const doc = refs.persistedByKey.get(key);
      if (doc && !dequal(doc.params, draft.params)) await updateFitting(doc, draft, svc);
      continue;
    }
    await createFitting(draft, svc, refs, sceneOps.create);
  }

  // Delete — scene fittings whose junctionKey is no longer desired (topology changed).
  for (const [key, entity] of sceneByKey) {
    if (desiredByKey.has(key)) continue;
    sceneOps.deleteIds.push(entity.id);
    const doc = refs.persistedByKey.get(key);
    if (doc) await deleteFitting(doc, svc, refs);
  }

  applySceneOps(levelId, levelManager, sceneOps.create, sceneOps.deleteIds);
}

async function createFitting(
  draft: MepFittingDraft,
  svc: MepFittingFirestoreService,
  refs: ReconcileRefs,
  createdInto: MepFittingEntity[],
): Promise<void> {
  // SSoT entity creation via the `createMepFitting` factory — auto-fills the
  // enterprise id + a once-generated IFC GlobalId (`ifcGuid`) + `ifcType` from
  // the fitting domain. Mirror of how `createMepSegment` owns segment creation.
  const entity = createMepFitting({
    params: draft.params,
    geometry: draft.geometry,
    validation: draft.validation,
    layerId: '0',
    visible: true,
  });
  const id = entity.id;
  // OPTIMISTIC: the scene is the source of truth for DISPLAY — show the fitting
  // immediately, then persist best-effort. A failed Firestore write (e.g. rules /
  // index not yet deployed) must NOT hide the fitting; on reload the idempotent
  // junctionKey diff simply re-creates it. `pending` guards the merge pass so the
  // optimistic scene entity is not dropped as an "orphan" before its doc round-trips.
  refs.pending.add(id);
  createdInto.push(entity);
  try {
    await svc.saveFitting(entityToSaveInput(entity));
    recordMepFittingChange('created', entity);
  } catch {
    // Persistence failed — keep it in the scene (visible), drop the pending guard so
    // the next subscription snapshot doesn't treat it as a confirmed-then-vanished doc.
    refs.pending.delete(id);
  }
}

async function updateFitting(
  existing: MepFittingDoc,
  draft: MepFittingDraft,
  svc: MepFittingFirestoreService,
): Promise<void> {
  try {
    await svc.updateFitting(existing.id, {
      params: draft.params,
      validation: draft.validation,
      geometry: draft.geometry,
    });
    recordMepFittingChange(
      'updated',
      { id: existing.id, kind: draft.kind, params: draft.params },
      { prevParams: existing.params },
    );
  } catch {
    /* update failure is non-fatal — next topology change retries */
  }
}

async function deleteFitting(
  doc: MepFittingDoc,
  svc: MepFittingFirestoreService,
  refs: ReconcileRefs,
): Promise<void> {
  refs.deleted.add(doc.id);
  try {
    await svc.deleteFitting(doc.id);
    refs.persistedByKey.delete(doc.params.junctionKey);
    recordMepFittingChange('deleted', { id: doc.id, kind: doc.kind, params: doc.params });
  } catch {
    refs.deleted.delete(doc.id);
  }
}

/**
 * Apply the reconcile create/delete ops to the scene in a single setLevelScene.
 *
 * RE-READS the CURRENT scene at apply time — never the stale snapshot captured at
 * the start of the async reconcile. Otherwise a pipe drawn during the reconcile's
 * `await` window (Firestore save) would be clobbered by writing back the old
 * entity list — which then auto-saves a scene MISSING that pipe, so it vanishes on
 * the next reload. Re-reading preserves every concurrent edit.
 */
function applySceneOps(
  levelId: string,
  levelManager: LevelManagerLike,
  created: readonly MepFittingEntity[],
  deletedIds: readonly string[],
): void {
  if (created.length === 0 && deletedIds.length === 0) return;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return;
  const deleteSet = new Set(deletedIds);
  const kept = scene.entities.filter((e) => !deleteSet.has(e.id));
  levelManager.setLevelScene(levelId, {
    ...scene,
    entities: [...kept, ...(created as unknown as AnySceneEntity[])],
  });
}

// ============================================================================
// TOPOLOGY SIGNATURE — drives the debounced reconcile trigger
// ============================================================================

/**
 * Stable signature of the pipe topology: only the geometry inputs that affect
 * junction derivation (segment endpoints + diameters). A pure pan / unrelated
 * entity edit leaves this unchanged ⇒ no reconcile ⇒ no churn.
 */
function buildPipeTopologySignature(scene: SceneModel | null): string {
  if (!scene) return '';
  const parts: string[] = [];
  for (const e of scene.entities) {
    if (!isPipeSegment(e)) continue;
    const p = (e as { params?: Record<string, unknown> }).params ?? {};
    parts.push(`${e.id}:${JSON.stringify(p)}`);
  }
  return parts.sort().join('|');
}

function isPipeSegment(entity: AnySceneEntity): boolean {
  return (entity as { type?: string }).type === 'mep-segment';
}
