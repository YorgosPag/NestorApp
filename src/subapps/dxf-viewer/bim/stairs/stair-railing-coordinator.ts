/**
 * Stair → Railing COORDINATOR — ADR-407 Φ7 (derived-cascade lifecycle SSoT).
 *
 * The reactive wiring: reads the current scene, runs the pure `planStairRailings`, and applies
 * the diff — creating / refreshing / deleting the auto hosted railing of every stair side that
 * carries an active handrail. Direct mirror of `cascadeStairwellOpenings` (ADR-632): a hosted
 * railing is a **derived** entity, exactly like a floor/stair opening in Revit/ArchiCAD, so it
 * regenerates on host-change (and on host-create) and orphan-deletes with its stair.
 *
 * **Zero new geometry engine (N.0.2/N.18):** materialisation re-uses the reserved railing SSoT
 * — `buildStairRailingHost` (path from the stair) → `computeRailingGeometry(params, host)` →
 * `createRailing` factory. The 3D solid (posts + balusters + rails) and the per-component paint
 * (ADR-407 Φ8) come for free from the standalone railing pipeline.
 *
 * **Idempotent:** unchanged scene → zero creates/deletes, and an update is applied ONLY when the
 * baked path actually moved (no persist/BOQ churn, no reactive loop — ADR-492 §4). Lifecycle
 * emits are deferred (`queueMicrotask`) after the synchronous scene apply, mirror of the
 * stairwell coordinator, so `useRailingPersistence` does the Firestore setDoc/deleteDoc + audit
 * + BOQ automatically (`drawing:entity-created` tool `'railing'` / `bim:railing-delete-requested`).
 *
 * **Paint-preserving updates:** an update refreshes ONLY `pathSource` (baked snapshot) + geometry;
 * the user's `appearance` / `componentAppearance` / chosen `type` (metal ↔ glass panel ↔ no rail)
 * survive a stair edit untouched.
 *
 * @see bim/stairs/stair-railing-plan.ts — the pure planner
 * @see bim/stairs/stair-railing-host.ts — the pure host/path builder
 * @see bim/stairs/stairwell-opening-coordinator.ts — the pattern it mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md §Φ7
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import { isStairEntity, isRailingEntity, type Entity } from '../../types/entities';
import type { StairEntity } from '../types/stair-types';
import type {
  RailingEntity,
  RailingHostContext,
  RailingParams,
  RailingPath,
  RailingType,
} from '../types/railing-types';
import {
  DEFAULT_RAILING_TOTAL_HEIGHT_MM,
  DEFAULT_RAILING_TYPE,
} from '../types/railing-types';
import {
  computeRailingGeometry,
  validateRailingParams,
} from '../railings/railing-geometry';
import { createRailing } from '@/services/factories/railing.factory';
import { createModuleLogger } from '@/lib/telemetry';
import {
  emitBimEntityCreated,
  emitBimEntityDeleteRequested,
} from '../../systems/events/bim-entity-lifecycle-events';
import {
  buildStairRailingHost,
  stairRailingSceneUnits,
  type StairRailingSide,
} from './stair-railing-host';
import {
  managedStairRailingRef,
  planStairRailings,
  type DesiredStairRailing,
  type ManagedStairRailing,
} from './stair-railing-plan';

const logger = createModuleLogger('stair-railing-coordinator');

/** Revit «Baluster Per Tread» — one baluster per tread on the auto stair guardrail (Giorgio 2026-07-23). */
const STAIR_RAILING_PER_TREAD_COUNT = 1 as const;

/** xy-position tolerance (canvas units) below which a re-baked path counts as «unchanged» (no churn). */
const PATH_EPSILON = 1e-4;

/**
 * The built-in Type for the auto stair guardrail: the default metal guardrail + «Baluster Per
 * Tread». Glass-panel / no-handrail variants (Giorgio 2026-07-23) are reachable by editing the
 * railing's `type` afterwards — the schema already models `infill` + optional `topRail/handrail`,
 * and an update preserves the user's chosen type.
 */
const STAIR_RAILING_TYPE: RailingType = {
  ...DEFAULT_RAILING_TYPE,
  id: 'railing-type-stair-default',
  name: 'Stair Guardrail — Baluster Per Tread',
  balusterPlacement: {
    ...DEFAULT_RAILING_TYPE.balusterPlacement,
    perTread: { count: STAIR_RAILING_PER_TREAD_COUNT },
  },
};

/** Minimal scene surface (mirror of the stairwell coordinator). */
export type StairRailingCoordinatorSceneManager = Pick<
  ISceneManager,
  'getEntity' | 'addEntity' | 'updateEntities' | 'removeEntity'
> & {
  getEntities?(): readonly SceneEntity[];
};

export interface StairRailingCoordinatorOptions {
  /** Perf gate: when given AND no stair changed → skip (a column edit never touches railings). */
  readonly changedIds?: readonly string[];
}

export interface StairRailingCascadeResult {
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly deleted: readonly string[];
}

const EMPTY_RESULT: StairRailingCascadeResult = { created: [], updated: [], deleted: [] };

/** True when at least one changed id is a stair (perf gate). */
function touchesStair(entities: readonly Entity[], changedIds: readonly string[]): boolean {
  const changed = new Set(changedIds);
  return entities.some((e) => changed.has(e.id) && isStairEntity(e));
}

/** Build the hosted `RailingParams` for a stair side from a resolved host context. */
function buildHostedParams(
  stair: StairEntity,
  side: StairRailingSide,
  host: RailingHostContext,
  type: RailingType,
): RailingParams {
  const sceneUnits = stairRailingSceneUnits(stair);
  const storeyId = (stair as { floorId?: string }).floorId;
  return {
    type,
    pathSource: {
      kind: 'hosted',
      hostId: stair.id,
      hostType: 'stair',
      side,
      resolvedPath: host.resolvedPath,
      ...(host.perTreadAnchors ? { perTreadAnchors: host.perTreadAnchors } : {}),
      ...(host.slopeRatio !== undefined ? { slopeRatio: host.slopeRatio } : {}),
    },
    totalHeightMm: DEFAULT_RAILING_TOTAL_HEIGHT_MM,
    baseElevationMm: 0,
    sceneUnits,
    ...(storeyId ? { storeyId } : {}),
  };
}

/** Materialise a brand-new auto railing entity (deterministic id). `null` on missing/degenerate path. */
function materializeCreate(
  desired: DesiredStairRailing,
  stair: StairEntity,
): RailingEntity | null {
  const host = buildStairRailingHost(stair, desired.side);
  if (!host || host.resolvedPath.length < 2) return null;
  const params = buildHostedParams(stair, desired.side, host, STAIR_RAILING_TYPE);
  const validation = validateRailingParams(params);
  if (validation.hardErrors.length > 0) {
    logger.warn('stair-railing: auto railing skipped (hard errors)', {
      stairId: stair.id,
      side: desired.side,
      hardErrors: validation.hardErrors,
    });
    return null;
  }
  const geometry = computeRailingGeometry(params, host);
  return createRailing({
    params,
    geometry,
    layerId: stair.layerId,
    visible: true,
    validation: validation.bimValidation,
    id: desired.railingId,
  });
}

/** True when two paths differ in vertex count or any vertex beyond `PATH_EPSILON` (xy + z). */
function pathChanged(a: RailingPath, b: RailingPath): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!;
    const q = b[i]!;
    if (Math.abs(p.x - q.x) > PATH_EPSILON || Math.abs(p.y - q.y) > PATH_EPSILON) return true;
    if (Math.abs((p.z ?? 0) - (q.z ?? 0)) > PATH_EPSILON) return true;
  }
  return false;
}

/**
 * Refresh an existing auto railing against the current stair (paint-preserving). Returns the
 * patch + entity, or `null` when the path is unchanged (idempotent skip) / host degenerate.
 */
function materializeUpdate(
  stair: StairEntity,
  cur: RailingEntity,
  side: StairRailingSide,
): { readonly patch: Partial<SceneEntity>; readonly entity: RailingEntity } | null {
  const host = buildStairRailingHost(stair, side);
  if (!host || host.resolvedPath.length < 2) return null;
  const src = cur.params.pathSource;
  if (src.kind !== 'hosted') return null;
  // Re-bake when the path moved OR the baked anchor COUNT is stale (a pre-Φ7c doc with the old
  // even-along-path anchors has a different count than one-per-tread → refresh so it migrates to
  // tread-seated balusters on the next cascade run over the stair).
  const anchorCountStale = (src.perTreadAnchors?.length ?? 0) !== (host.perTreadAnchors?.length ?? 0);
  if (src.resolvedPath && !pathChanged(src.resolvedPath, host.resolvedPath) && !anchorCountStale) return null;

  const params: RailingParams = {
    ...cur.params,
    pathSource: {
      kind: 'hosted',
      hostId: src.hostId,
      hostType: src.hostType,
      ...(src.side ? { side: src.side } : {}),
      resolvedPath: host.resolvedPath,
      ...(host.perTreadAnchors ? { perTreadAnchors: host.perTreadAnchors } : {}),
      ...(host.slopeRatio !== undefined ? { slopeRatio: host.slopeRatio } : {}),
    },
  };
  const geometry = computeRailingGeometry(params, host);
  const entity: RailingEntity = { ...cur, params, geometry };
  return { patch: { params, geometry } as unknown as Partial<SceneEntity>, entity };
}

/** Deferred Firestore/BOQ/audit emits (mirror `CreateBimEntityCommand`; avoids re-entrancy). */
function scheduleLifecycleEmits(
  created: readonly RailingEntity[],
  updated: readonly RailingEntity[],
  deletedIds: readonly string[],
): void {
  if (created.length + updated.length + deletedIds.length === 0) return;
  queueMicrotask(() => {
    for (const e of created) emitBimEntityCreated(e, 'railing');
    for (const e of updated) emitBimEntityCreated(e, 'railing'); // idempotent setDoc on the same id
    for (const id of deletedIds) emitBimEntityDeleteRequested('railing', id);
  });
}

/**
 * Re-synchronise every auto stair railing with the current scene. Reads → plan → apply.
 * No-op when the scene manager exposes no `getEntities`. Idempotent. Called AFTER the stair
 * change has settled in the scene (the host builder reads the current stair geometry).
 */
export function cascadeStairRailings(
  sceneManager: StairRailingCoordinatorSceneManager,
  options: StairRailingCoordinatorOptions = {},
): StairRailingCascadeResult {
  const all = sceneManager.getEntities?.();
  if (!all) return EMPTY_RESULT;
  const entities = all as unknown as readonly Entity[];

  if (options.changedIds && !touchesStair(entities, options.changedIds)) return EMPTY_RESULT;

  const stairs = entities.filter(isStairEntity) as unknown as StairEntity[];
  const stairsById = new Map(stairs.map((s) => [s.id, s]));

  const managed: ManagedStairRailing[] = [];
  for (const e of entities) {
    if (!isRailingEntity(e)) continue;
    const ref = managedStairRailingRef(e as unknown as RailingEntity);
    if (ref) managed.push(ref);
  }

  const plan = planStairRailings(stairs, managed);

  // CREATE
  const createdEntities: RailingEntity[] = [];
  for (const desired of plan.creates) {
    const stair = stairsById.get(desired.stairId);
    if (!stair) continue;
    const entity = materializeCreate(desired, stair);
    if (!entity) continue;
    sceneManager.addEntity(entity as unknown as SceneEntity);
    createdEntities.push(entity);
  }

  // UPDATE (paint-preserving, path-change-gated)
  const patches = new Map<string, Partial<SceneEntity>>();
  const updatedEntities: RailingEntity[] = [];
  for (const desired of plan.updates) {
    const stair = stairsById.get(desired.stairId);
    if (!stair) continue;
    const cur = sceneManager.getEntity(desired.railingId);
    if (!cur || !isRailingEntity(cur as unknown as Entity)) continue;
    const res = materializeUpdate(stair, cur as unknown as RailingEntity, desired.side);
    if (!res) continue;
    patches.set(desired.railingId, res.patch);
    updatedEntities.push(res.entity);
  }
  if (patches.size > 0) sceneManager.updateEntities(patches);

  // DELETE (orphans — stair gone / handrail toggled off)
  const deleted: string[] = [];
  for (const { railingId } of plan.deletes) {
    sceneManager.removeEntity(railingId);
    deleted.push(railingId);
  }

  scheduleLifecycleEmits(createdEntities, updatedEntities, deleted);
  return {
    created: createdEntities.map((e) => e.id),
    updated: [...patches.keys()],
    deleted,
  };
}
