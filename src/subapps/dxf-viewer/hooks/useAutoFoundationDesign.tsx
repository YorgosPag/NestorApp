'use client';

/**
 * useAutoFoundationDesign — ADR-459 Phase 7 (Αυτόματος Σχεδιασμός Θεμελίωσης).
 *
 * Αντικαθιστά το proactive «ερώτηση» toast (`useColumnFootingNotification`, Φ2/3) με
 * **αυτόματη level-wide απόφαση + info feedback**. Σε κάθε στατική μεταβολή (νέα/
 * μετακινημένη/διαγραμμένη κολώνα, αλλαγή φορτίων) ξανα-υπολογίζει το πλήρες
 * foundation layout του επιπέδου:
 *
 *   1. `planFoundationLayout` — αποφασίζει αυτόματα μεμονωμένο vs combined + διαστάσεις
 *      (union-find overlap, A_req = N/σ_allow, κέντρο βάρους φορτίων).
 *   2. `reconcileFoundationLayout` — diff έναντι των ήδη υπαρχόντων **auto** πεδίλων
 *      → creates/removes (idempotent· τα χειροκίνητα πέδιλα ΔΕΝ τα αγγίζει ποτέ).
 *   3. `ApplyFoundationLayoutCommand` — ΕΝΑ undoable batch: cross-level create/remove
 *      + FK attach + **πάντα** αυτόματος οπλισμός (χωρίς ερώτηση).
 *
 * Gate: τρέχει μόνο όταν υπάρχει διακριτός όροφος **Θεμελίωσης** (`fl.target`) — αλλιώς
 * single-level no-op (όπως και πριν). Κολώνες ήδη πάνω σε **χειροκίνητο** πέδιλο
 * (FK ή spatial) εξαιρούνται — ο μηχανικός τις διαχειρίζεται.
 *
 * ADR-040 safe: low-freq, coalesced ανά microtask (mirror `useStructuralOrganism`).
 *
 * @see ../bim/foundations/auto-foundation-layout.ts — planFoundationLayout
 * @see ../bim/foundations/auto-foundation-reconcile.ts — reconcileFoundationLayout
 * @see ../core/commands/entity-commands/ApplyFoundationLayoutCommand.ts — ο executor
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/auth/hooks/useAuth';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
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
import { footingSupportsColumnBase, polygonCentroid } from '../bim/foundations/footing-column-coverage';
import { resolveColumnBaseZmm } from '../bim/geometry/column-vertical-profile';
import { buildDefaultFoundationParams, buildFoundationEntity } from './drawing/foundation-completion';
import {
  createFoundationCrossLevelWriter,
  type FoundationCrossLevelWriter,
  type FoundationWriteScope,
} from '../bim/foundations/foundation-cross-level-writer';
import {
  ApplyFoundationLayoutCommand,
  type FoundationCreateStep,
} from '../core/commands/entity-commands/ApplyFoundationLayoutCommand';
import { DXF_DEFAULT_LAYER } from '../config/layer-config';
import { resolveSceneUnits, type SceneUnits } from '../utils/scene-units';
import { isColumnEntity, isFoundationEntity, type Entity } from '../types/entities';
import type { ColumnEntity } from '../bim/types/column-types';
import type { FoundationEntity } from '../bim/types/foundation-types';
import type { FoundationLevelTarget } from '../systems/levels/building-foundation-level';
import type { AppliedMemberLoad } from '../bim/structural/loads/structural-loads-types';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  readonly levels: readonly { id: string; projectId?: string }[];
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

/** Στατικές μεταβολές που επανα-διαστασιολογούν τη θεμελίωση. */
const AUTO_DESIGN_EVENTS: readonly DrawingEventType[] = [
  'drawing:entity-created',
  'bim:column-params-updated',
  'bim:column-delete-requested',
  'bim:structural-loads-computed',
];

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
  // FK σε χειροκίνητο πέδιλο → εξαίρεση (ο μηχανικός το διαχειρίζεται).
  if (column.params.footingId !== undefined && manualFootingIds.has(column.params.footingId)) {
    return null;
  }
  const centroid = polygonCentroid(verts);
  const baseZmm = resolveColumnBaseZmm(column.params, { floorElevationMm: activeFloorElevationMm });
  if (coveredByManualFooting(column, centroid, baseZmm, manualFootings)) return null;
  return {
    id: column.id,
    centroid,
    widthMm: column.params.width,
    depthMm: column.params.depth,
    axialServiceKn: serviceAxialKn(column.params.appliedLoad),
    baseZmm,
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
    { width: planned.widthMm, length: planned.lengthMm, topElevationMm: planned.topElevationMm },
    sceneUnits,
  );
  if (base.kind !== 'pad') return null; // narrow για το pad-only appliedLoad
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

export function useAutoFoundationDesign(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();

  useEffect(() => {
    let scheduled = false;

    const adapterFor = (levelId: string): LevelSceneManagerAdapter =>
      new LevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelId);

    const writerFor = (target: FoundationLevelTarget): FoundationCrossLevelWriter | null => {
      const scope: FoundationWriteScope = {
        companyId: user?.companyId,
        projectId: levelManager.levels.find((l) => l.id === levelManager.currentLevelId)?.projectId,
        userId: user?.uid,
      };
      return createFoundationCrossLevelWriter(scope, target, levelManager);
    };

    const recompute = (): void => {
      scheduled = false;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const activeScene = levelManager.getLevelScene(levelId);
      if (!activeScene) return;
      const fl = useFoundationLevelStore.getState();
      if (!fl.target) return; // single-level → no auto-design (gate)

      const activeEntities = activeScene.entities as unknown as readonly Entity[];
      const foundationFloorElev = fl.target.floorElevationMm;
      const candidates: CandidateFooting[] = [
        ...fl.entities.filter(isFootingElement).map((e) => ({ entity: e, floorElevationMm: foundationFloorElev })),
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
      if (diff.creates.length === 0 && diff.removeFootingIds.length === 0) return; // idempotent no-op

      const writer = writerFor(fl.target);
      if (!writer) return;
      const createSteps: FoundationCreateStep[] = [];
      for (const planned of diff.creates) {
        const footing = buildAutoFooting(planned, columnsById, fl.target, sceneUnits);
        if (footing) createSteps.push({ footing, columnIds: planned.columnIds });
      }
      const removes = existingAutoFootings.filter((f) => diff.removeFootingIds.includes(f.id));
      if (createSteps.length === 0 && removes.length === 0) return;

      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      const cmd = new ApplyFoundationLayoutCommand(createSteps, removes, writer, adapterFor(levelId), provider);
      execute(cmd);
      for (const step of createSteps) {
        EventBus.emit('bim:column-footing-attached', { columnIds: [...step.columnIds], footingId: step.footing.id });
      }
      toast.success(
        t('autoFoundation.applied', {
          created: cmd.createdCount(),
          combined: cmd.combinedCount(),
          removed: cmd.removedCount(),
        }),
      );
    };

    const schedule = (): void => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    const unsubs = AUTO_DESIGN_EVENTS.map((ev) => EventBus.on(ev, schedule));
    return () => unsubs.forEach((u) => u());
  }, [levelManager, execute, t, user]);
}
