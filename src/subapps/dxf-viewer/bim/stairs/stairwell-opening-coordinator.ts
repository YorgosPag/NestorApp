/**
 * Stairwell-Opening Coordinator — ADR-632 Φάση 3 (derived-cascade lifecycle SSoT).
 *
 * Ο **reactive engine wiring**: διαβάζει την τρέχουσα σκηνή, τρέχει τον pure
 * planner (`planStairwellOpenings`) και εφαρμόζει το diff plan — δημιουργεί /
 * ενημερώνει / σβήνει auto «well» openings (marker `autoStairId`) πάνω από κάθε
 * σκάλα που «καπακώνεται» κάτω από το νόμιμο ελεύθερο ύψος.
 *
 * Mirror του `wall-opening-coordinator` (recompute) + `cascade-transformed-slab-
 * openings` (apply-batch), αλλά με **lifecycle** (create/delete) αντί για μόνο
 * geometry-recompute — τα stairwell openings είναι derived οντότητες, όπως τα
 * floor openings στο Revit/ArchiCAD (associative, regenerate-on-host-change).
 *
 * **Idempotent:** αμετάβλητη σκηνή → μηδέν creates/updates/deletes (ο planner
 * συγκρίνει outlines με ανοχή). Ασφαλής να τρέχει μετά από ΚΑΘΕ stair/slab αλλαγή.
 *
 * **Persistence + BOQ + audit (Φ4):** μετά το scene apply εκπέμπει τα ΙΔΙΑ
 * lifecycle events με το χειροκίνητο opening — `drawing:entity-created`
 * (tool `'slab-opening'`) σε create/update· `bim:slab-opening-delete-requested`
 * σε delete — ώστε το `useSlabOpeningPersistence` (ADR-594) να κάνει Firestore
 * setDoc/deleteDoc + audit + BOQ re-feed **αυτόματα** (μηδέν παράκαμψη). Τα emits
 * γίνονται deferred (`queueMicrotask`) ΜΕΤΑ το σύγχρονο command apply, mirror του
 * `CreateBimEntityCommand` (αποφυγή re-entrancy). Idempotent → emit μόνο σε
 * πραγματική αλλαγή (κανένα BOQ churn σε αμετάβλητο re-run).
 *
 * **Reactive wiring (Φ4):** καλείται inline από το `reconcileAssociativeGeometry`
 * (μετά από κάθε params-edit/transform σκάλας ή πλάκας) με `changedIds` gate·
 * ο orphan-cleanup σε **delete σκάλας** ζει στο delete path (`findHostedStairwellOpenings`
 * → delete set → atomic undo). Undo/redo δουλεύει από το idempotent re-run του
 * planner (mirror `cascadeHostedOpeningsForWalls`), χωρίς ξεχωριστά snapshots.
 *
 * @see bim/geometry/stairs/stairwell-opening-plan.ts — ο pure planner (SSoT)
 * @see bim/stairs/stairwell-opening-inputs.ts — οι pure input builders (scene→mm)
 * @see bim/walls/wall-opening-coordinator.ts — το pattern coordinator που mirror-άρει
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §3
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import type { SlabEntity } from '../types/slab-types';
import type { SlabOpeningEntity, SlabOpeningParams } from '../types/slab-opening-types';
import { isSlabEntity, isSlabOpeningEntity, isStairEntity } from '../../types/entities';
import { computeSlabOpeningGeometry } from '../geometry/slab-opening-geometry';
import { buildSlabOpeningEntity } from '../../hooks/drawing/slab-opening-completion';
import {
  emitBimEntityCreated,
  emitBimEntityDeleteRequested,
} from '../../systems/events/bim-entity-lifecycle-events';
import { STAIRWELL_AUTO_OPENING_KIND } from '../geometry/stairs/stairwell-opening-config';
import {
  planStairwellOpenings,
  type StairwellDesiredOpening,
  type StairwellOpeningPlan,
  type StairwellPlanOptions,
} from '../geometry/stairs/stairwell-opening-plan';
import {
  buildStairwellPlanStairs,
  buildStairwellSlabCandidates,
  collectManagedStairwellOpenings,
  type StairwellInputOptions,
} from './stairwell-opening-inputs';

/**
 * Minimal scene-manager surface: `getEntities` (foreign-key scan) + lifecycle
 * mutators. `getEntities` optional (lightweight test mocks χωρίς αυτό → no-op).
 */
export type StairwellCoordinatorSceneManager = Pick<
  ISceneManager,
  'getEntity' | 'addEntity' | 'updateEntities' | 'removeEntity'
> & {
  getEntities?(): readonly SceneEntity[];
};

export interface StairwellCoordinatorOptions
  extends StairwellInputOptions,
    StairwellPlanOptions {
  /**
   * Ids που άλλαξαν στο τρέχον command (perf gate). Όταν δοθεί ΚΑΙ κανένα δεν
   * είναι σκάλα/πλάκα → skip (μια αλλαγή κολόνας δεν αγγίζει stairwell openings).
   * Απόν → πάντα full recompute (π.χ. αρχικό load / explicit resync).
   */
  readonly changedIds?: readonly string[];
}

/** Ό,τι εφαρμόστηκε — ids ανά ενέργεια (diagnostics / emit / tests). */
export interface StairwellCascadeResult {
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly deleted: readonly string[];
}

const EMPTY_RESULT: StairwellCascadeResult = { created: [], updated: [], deleted: [] };

/** True αν έστω ένα `changedIds` entity είναι σκάλα ή πλάκα (perf gate). */
function touchesStairOrSlab(
  entities: readonly Entity[],
  changedIds: readonly string[],
): boolean {
  const changed = new Set(changedIds);
  return entities.some((e) => changed.has(e.id) && (isStairEntity(e) || isSlabEntity(e)));
}

// ─── Apply ───────────────────────────────────────────────────────────────────

/** Materialise + insert ένα auto «well» opening· επιστρέφει το entity ή `null`. */
function applyCreate(
  desired: StairwellDesiredOpening,
  sceneManager: StairwellCoordinatorSceneManager,
  sceneUnits: StairwellInputOptions['sceneUnits'],
): SlabOpeningEntity | null {
  const host = sceneManager.getEntity(desired.slabId) as unknown as SlabEntity | undefined;
  if (!host || !isSlabEntity(host as unknown as Entity)) return null;

  const params: SlabOpeningParams = {
    kind: STAIRWELL_AUTO_OPENING_KIND,
    slabId: desired.slabId,
    outline: desired.outline,
    autoStairId: desired.autoStairId,
    ...(sceneUnits ? { sceneUnits } : {}),
  };
  const built = buildSlabOpeningEntity(params, host, host.layerId);
  if (!built.ok) return null;
  sceneManager.addEntity(built.entity as unknown as SceneEntity);
  return built.entity;
}

/**
 * Εκπέμπει τα lifecycle events (Firestore + BOQ + audit μέσω persistence hook)
 * deferred, ΜΕΤΑ το σύγχρονο command apply — mirror `CreateBimEntityCommand`
 * (αποφυγή re-entrancy). Create ΚΑΙ update → `drawing:entity-created`
 * (`neverUpdate:true` → setDoc idempotent στο ίδιο id)· delete → delete-requested.
 */
function scheduleLifecycleEmits(
  createdEntities: readonly SlabOpeningEntity[],
  updatedEntities: readonly SlabOpeningEntity[],
  deletedIds: readonly string[],
): void {
  if (createdEntities.length + updatedEntities.length + deletedIds.length === 0) return;
  queueMicrotask(() => {
    for (const entity of createdEntities) emitBimEntityCreated(entity, 'slab-opening');
    for (const entity of updatedEntities) emitBimEntityCreated(entity, 'slab-opening');
    for (const id of deletedIds) emitBimEntityDeleteRequested('slab-opening', id);
  });
}

/** Εφαρμόζει το plan στη σκηνή (add/update/remove) + εκπέμπει lifecycle events. */
export function applyStairwellOpeningPlan(
  plan: StairwellOpeningPlan,
  sceneManager: StairwellCoordinatorSceneManager,
  sceneUnits: StairwellInputOptions['sceneUnits'],
): StairwellCascadeResult {
  const createdEntities: SlabOpeningEntity[] = [];
  for (const desired of plan.creates) {
    const entity = applyCreate(desired, sceneManager, sceneUnits);
    if (entity) createdEntities.push(entity);
  }

  const updates = new Map<string, Partial<SceneEntity>>();
  const updatedEntities: SlabOpeningEntity[] = [];
  for (const { openingId, outline } of plan.updates) {
    const cur = sceneManager.getEntity(openingId) as unknown as SlabOpeningEntity | undefined;
    if (!cur || !isSlabOpeningEntity(cur as unknown as Entity)) continue;
    const params: SlabOpeningParams = { ...cur.params, outline };
    const geometry = computeSlabOpeningGeometry(params);
    updates.set(openingId, { params, geometry } as unknown as Partial<SceneEntity>);
    updatedEntities.push({ ...cur, params, geometry });
  }
  if (updates.size > 0) sceneManager.updateEntities(updates);

  const deleted: string[] = [];
  for (const { openingId } of plan.deletes) {
    sceneManager.removeEntity(openingId);
    deleted.push(openingId);
  }

  scheduleLifecycleEmits(createdEntities, updatedEntities, deleted);
  return { created: createdEntities.map((e) => e.id), updated: [...updates.keys()], deleted };
}

// ─── Public entry ────────────────────────────────────────────────────────────

/**
 * Ξανα-συγχρονίζει ΟΛΑ τα auto stairwell openings με την τρέχουσα σκηνή. Reads →
 * plan → apply. No-op όταν ο scene manager δεν εκθέτει `getEntities`. Idempotent.
 *
 * Καλείται **αφού** η αλλαγή σκάλας/πλάκας έχει «κάτσει» στη σκηνή (ο planner
 * διαβάζει την τρέχουσα γεωμετρία), mirror του `cascadeHostedOpeningsForWalls`.
 */
export function cascadeStairwellOpenings(
  sceneManager: StairwellCoordinatorSceneManager,
  options: StairwellCoordinatorOptions = {},
): StairwellCascadeResult {
  const all = sceneManager.getEntities?.();
  if (!all) return EMPTY_RESULT;
  const entities = all as unknown as readonly Entity[];

  // Perf gate: αν το command δεν άγγιξε καμία σκάλα/πλάκα → τίποτα να ξανα-derive.
  if (options.changedIds && !touchesStairOrSlab(entities, options.changedIds)) {
    return EMPTY_RESULT;
  }

  const stairs = entities.filter(isStairEntity);
  const slabs = entities.filter(isSlabEntity);

  const slabCandidates = buildStairwellSlabCandidates(slabs);
  const stairInputs = buildStairwellPlanStairs(stairs, options);
  const existing = collectManagedStairwellOpenings(entities);

  const plan = planStairwellOpenings(stairInputs, slabCandidates, existing, options);
  return applyStairwellOpeningPlan(plan, sceneManager, options.sceneUnits);
}
