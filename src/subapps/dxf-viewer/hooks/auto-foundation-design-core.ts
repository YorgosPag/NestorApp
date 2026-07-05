/**
 * auto-foundation-design-core — ADR-459 Phase 7 (Αυτόματος Σχεδιασμός Θεμελίωσης SSoT).
 *
 * SSoT πυρήνας του level-wide foundation re-design, εξαγμένος από το
 * `useAutoFoundationDesign` ώστε να τον μοιράζονται **δύο** callers χωρίς διπλότυπο:
 *   · `useAutoFoundationDesign` — reactive shell hook (coalesced microtask + toast).
 *   · `runAutoStudy` (ADR-500) — **σύγχρονος** convergence loop που χρειάζεται τα πέδιλα
 *     διορθωμένα ΜΕΣΑ στον γύρο (πριν διαβάσει τα bearing diagnostics).
 *
 *   1. `planFoundationLayout` — μεμονωμένο vs combined + διαστάσεις (A_req = N/σ_allow).
 *   2. `reconcileFoundationLayout` — diff έναντι των ήδη υπαρχόντων **auto** πεδίλων.
 *   3. `ApplyFoundationLayoutCommand` — ΕΝΑ undoable batch (create/update/remove + οπλισμός).
 *
 * Gate: τρέχει μόνο όταν υπάρχει διακριτός όροφος **Θεμελίωσης** (`fl.target`). Κολώνες
 * πάνω σε **χειροκίνητο** πέδιλο εξαιρούνται. Επιστρέφει counts (ΟΧΙ toast — το feedback
 * το κάνει ο caller· ο loop εκδίδει ΕΝΑ συγκεντρωτικό report).
 *
 * @see ../bim/foundations/auto-foundation-layout.ts — planFoundationLayout
 * @see ../bim/foundations/auto-foundation-reconcile.ts — reconcileFoundationLayout
 * @see ../core/commands/entity-commands/ApplyFoundationLayoutCommand.ts — ο executor
 * @see hooks/useAutoFoundationDesign.tsx — ο reactive caller (toast)
 * @see docs/centralized-systems/reference/adrs/ADR-500-auto-study-convergence-loop.md
 */

import type { ICommand } from '../core/commands/interfaces';
import { EventBus } from '../systems/events/EventBus';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { resolveStructuralCode } from '../bim/structural/codes';
import {
  planFoundationLayout,
  type LayoutColumnInput,
  type PlannedFooting,
} from '../bim/foundations/auto-foundation-layout';
import {
  reconcileFoundationLayout,
  type ReconcileColumn,
} from '../bim/foundations/auto-foundation-reconcile';
import {
  isFootingElement,
  resolveFootingSummary,
  footingAbsoluteZ,
} from '../bim/foundations/footing-element-summary';
import { collectFoundationFootings } from '../bim/foundations/foundation-footing-candidates';
import { footingSupportsColumnBase } from '../bim/foundations/footing-column-coverage';
import { polygonAreaCentroid, projectVerticesTo2D } from '../bim/geometry/shared/polygon-utils';
import { resolveColumnBaseZmm } from '../bim/geometry/column-vertical-profile';
import { buildDefaultFoundationParams, buildFoundationEntity } from './drawing/foundation-completion';
import { resolveFoundationTopElevationMm } from '../bim/types/foundation-types';
import type { FoundationCrossLevelWriter } from '../bim/foundations/foundation-cross-level-writer';
import {
  resolveFoundationCrossLevelWriter,
  type FoundationWriterUser,
} from '../bim/foundations/foundation-write-scope';
import {
  ApplyFoundationLayoutCommand,
  type FoundationCreateStep,
  type FoundationUpdateStep,
} from '../core/commands/entity-commands/ApplyFoundationLayoutCommand';
import { DXF_DEFAULT_LAYER } from '../config/layer-config';
import { resolveSceneUnits, type SceneUnits } from '../utils/scene-units';
import { isColumnEntity, isFoundationEntity, type Entity } from '../types/entities';
import type { ColumnEntity } from '../bim/types/column-types';
import type { FoundationEntity } from '../bim/types/foundation-types';
import type { FoundationLevelTarget } from '../systems/levels/building-foundation-level';
import type { AppliedMemberLoad } from '../bim/structural/loads/structural-loads-types';
import type { SceneModel } from '../types/scene';

export interface FoundationDesignLevelManager {
  readonly currentLevelId: string | null;
  readonly levels: readonly { id: string; projectId?: string }[];
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

/** Injected dependencies (auth user + command executor). */
export interface FoundationDesignDeps {
  readonly user: FoundationWriterUser;
  /** Executor από command history (`execute` ή `executeGrouped` — αποφασίζει ο caller). */
  readonly exec: (cmd: ICommand) => void;
}

/** Counts των πεδίλων που σχεδιάστηκαν αυτόματα (για report/convergence). */
export interface FoundationDesignResult {
  readonly created: number;
  readonly combined: number;
  readonly updated: number;
  readonly removed: number;
  /** ADR-500 — ids των πεδίλων που σχεδιάστηκαν/ενημερώθηκαν (unique per-kind report). */
  readonly footingIds: readonly string[];
}

const ZERO: FoundationDesignResult = { created: 0, combined: 0, updated: 0, removed: 0, footingIds: [] };

/** Footing candidate (cross-level): foundation-level πέδιλα + active-scene πέδιλα. */
interface CandidateFooting {
  readonly entity: Entity;
  readonly floorElevationMm: number;
}

/** Χαρακτηριστικό αξονικό service N = G + Q (kN), ή undefined. */
function serviceAxialKn(load: AppliedMemberLoad | undefined): number | undefined {
  if (!load) return undefined;
  return load.deadAxialKn + load.liveAxialKn;
}

/** True αν ένα footing element είναι auto pad (διαχειρίσιμο από τον reconciler). */
function isAutoPad(e: Entity): e is FoundationEntity {
  return isFoundationEntity(e) && e.params.kind === 'pad' && e.params.autoDesigned === true;
}

/** True αν η βάση της κολώνας καλύπτεται από κάποιο ΧΕΙΡΟΚΙΝΗΤΟ πέδιλο. */
function coveredByManualFooting(
  column: ColumnEntity,
  baseCentroid: { x: number; y: number },
  baseZmm: number,
  manualFootings: readonly CandidateFooting[],
): boolean {
  for (const f of manualFootings) {
    const s = resolveFootingSummary(f.entity);
    if (!s) continue;
    const { topZmm } = footingAbsoluteZ(s, f.floorElevationMm);
    if (footingSupportsColumnBase({ footprint: s.footprint, topZmm }, { baseCentroid, baseZmm })) {
      return true;
    }
  }
  return false;
}

/** Layout input μιας κολώνας, ή null αν εκφυλισμένη / χειροκίνητα διαχειρισμένη. */
function toLayoutColumn(
  column: ColumnEntity,
  activeFloorElevationMm: number,
  manualFootingIds: ReadonlySet<string>,
  manualFootings: readonly CandidateFooting[],
): LayoutColumnInput | null {
  const verts = column.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  if (column.params.footingId !== undefined && manualFootingIds.has(column.params.footingId)) {
    return null;
  }
  // Area-centroid (load resultant) — ΟΧΙ vertex-mean· κρίσιμο για composite L/T/U
  // ώστε το πέδιλο να κεντράρεται στο πραγματικό κέντρο βάρους (ομοιόμορφη πίεση).
  const centroid = polygonAreaCentroid(verts);
  const baseZmm = resolveColumnBaseZmm(column.params, { floorElevationMm: activeFloorElevationMm });
  if (coveredByManualFooting(column, centroid, baseZmm, manualFootings)) return null;
  return {
    id: column.id,
    centroid,
    footprint: projectVerticesTo2D(verts),
    widthMm: column.params.width,
    depthMm: column.params.depth,
    axialServiceKn: serviceAxialKn(column.params.appliedLoad),
    baseZmm,
    rotationDeg: column.params.rotation,
  };
}

/** Άθροισμα G/Q (kN) πάνω από τις κολώνες ενός σχεδιασμένου πεδίλου (takedown). */
function sumAppliedLoad(
  columnIds: readonly string[],
  columnsById: ReadonlyMap<string, ColumnEntity>,
): AppliedMemberLoad | undefined {
  let dead = 0;
  let live = 0;
  let any = false;
  for (const id of columnIds) {
    const load = columnsById.get(id)?.params.appliedLoad;
    if (!load) continue;
    dead += load.deadAxialKn;
    live += load.liveAxialKn;
    any = true;
  }
  return any ? { deadAxialKn: dead, liveAxialKn: live, source: 'takedown' } : undefined;
}

/** Χτίζει το auto FoundationEntity ενός σχεδιασμένου πεδίλου (autoDesigned=true). */
function buildAutoFooting(
  planned: PlannedFooting,
  columnsById: ReadonlyMap<string, ColumnEntity>,
  target: FoundationLevelTarget,
  sceneUnits: SceneUnits,
): FoundationEntity | null {
  const base = buildDefaultFoundationParams(
    { x: planned.position.x, y: planned.position.y },
    'pad',
    {
      width: planned.widthMm,
      length: planned.lengthMm,
      topElevationMm: resolveFoundationTopElevationMm(target.floorElevationMm, 'pad'),
      rotation: planned.rotationDeg,
    },
    sceneUnits,
  );
  if (base.kind !== 'pad') return null;
  const appliedLoad = sumAppliedLoad(planned.columnIds, columnsById);
  const params = { ...base, autoDesigned: true, ...(appliedLoad ? { appliedLoad } : {}) };
  const built = buildFoundationEntity(params, DXF_DEFAULT_LAYER);
  if (!built.ok) return null;
  return {
    ...built.entity,
    floorId: target.floorId,
    ...(target.sceneFileId ? { floorplanId: target.sceneFileId } : {}),
  };
}

/**
 * Εκτελεί τον αυτόματο σχεδιασμό θεμελίωσης του ενεργού ορόφου. Επιστρέφει τα counts
 * (μηδέν → no-op / κανένας όροφος Θεμελίωσης). ΔΕΝ κάνει toast (το αναλαμβάνει ο caller).
 */
export function runAutoFoundationDesign(
  levelManager: FoundationDesignLevelManager,
  deps: FoundationDesignDeps,
): FoundationDesignResult {
  const { user, exec } = deps;
  const levelId = levelManager.currentLevelId;
  if (!levelId) return ZERO;
  const activeScene = levelManager.getLevelScene(levelId);
  if (!activeScene) return ZERO;
  const fl = useFoundationLevelStore.getState();
  if (!fl.target) return ZERO; // single-level → no auto-design (gate)

  const activeEntities = activeScene.entities as unknown as readonly Entity[];
  const foundationFloorElev = fl.target.floorElevationMm;
  const foundationScene = levelManager.getLevelScene(fl.target.levelId);
  const foundationFootings = collectFoundationFootings(fl.entities, foundationScene);
  const candidates: CandidateFooting[] = [
    ...foundationFootings.map((e) => ({ entity: e, floorElevationMm: foundationFloorElev })),
    ...activeEntities.filter(isFootingElement).map((e) => ({ entity: e, floorElevationMm: fl.activeFloorElevationMm })),
  ];
  const existingAutoFootings = candidates.map((c) => c.entity).filter(isAutoPad);
  const autoIds = new Set(existingAutoFootings.map((f) => f.id));
  const manualFootings = candidates.filter((c) => !autoIds.has(c.entity.id));
  const manualFootingIds = new Set(manualFootings.map((c) => c.entity.id));

  const columns = activeEntities.filter(isColumnEntity);
  const columnsById = new Map(columns.map((c) => [c.id, c]));
  const layoutColumns = columns
    .map((c) => toLayoutColumn(c, fl.activeFloorElevationMm, manualFootingIds, manualFootings))
    .filter((c): c is LayoutColumnInput => c !== null);

  const soil = useStructuralSettingsStore.getState().soilBearingCapacityKpa;
  const sceneUnits = resolveSceneUnits(activeScene);
  const plan = planFoundationLayout(layoutColumns, soil, sceneUnits);
  const reconcileColumns: ReconcileColumn[] = columns.map((c) => ({ id: c.id, footingId: c.params.footingId }));
  const diff = reconcileFoundationLayout(plan, existingAutoFootings, reconcileColumns, sceneUnits);
  if (diff.creates.length === 0 && diff.updates.length === 0 && diff.removeFootingIds.length === 0) {
    return ZERO; // idempotent no-op
  }

  const writer = resolveFoundationCrossLevelWriter({
    user,
    levels: levelManager.levels,
    levelId: levelManager.currentLevelId,
    io: levelManager,
    target: fl.target,
  });
  if (!writer) return ZERO;
  const createSteps: FoundationCreateStep[] = [];
  for (const planned of diff.creates) {
    const footing = buildAutoFooting(planned, columnsById, fl.target, sceneUnits);
    if (footing) createSteps.push({ footing, columnIds: planned.columnIds });
  }
  const updateSteps: FoundationUpdateStep[] = [];
  for (const upd of diff.updates) {
    const prev = existingAutoFootings.find((f) => f.id === upd.existingId);
    const built = buildAutoFooting(upd.planned, columnsById, fl.target, sceneUnits);
    if (!prev || !built) continue;
    updateSteps.push({ prev, next: { ...built, id: upd.existingId }, columnIds: upd.planned.columnIds });
  }
  const removes = existingAutoFootings.filter((f) => diff.removeFootingIds.includes(f.id));
  if (createSteps.length === 0 && updateSteps.length === 0 && removes.length === 0) return ZERO;

  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  const adapter = createLevelSceneManagerAdapter(
    levelManager.getLevelScene,
    levelManager.setLevelScene,
    levelId,
  );
  const cmd = new ApplyFoundationLayoutCommand(createSteps, updateSteps, removes, writer, adapter, provider);
  exec(cmd);
  for (const step of createSteps) {
    EventBus.emit('bim:column-footing-attached', { columnIds: [...step.columnIds], footingId: step.footing.id });
  }
  for (const step of updateSteps) {
    EventBus.emit('bim:column-footing-attached', { columnIds: [...step.columnIds], footingId: step.next.id });
  }
  return {
    created: cmd.createdCount(),
    combined: cmd.combinedCount(),
    updated: cmd.updatedCount(),
    removed: cmd.removedCount(),
    // Τα designed πέδιλα (created + updated) — τα removed δεν προστίθενται (έπαψαν να υπάρχουν).
    footingIds: [...createSteps.map((s) => s.footing.id), ...updateSteps.map((s) => s.next.id)],
  };
}

/** True αν ο σχεδιασμός άλλαξε γεωμετρία (για το convergence signal του loop). */
export function foundationChangeCount(r: FoundationDesignResult): number {
  return r.created + r.updated + r.removed;
}
