'use client';

/**
 * useColumnFootingNotification — ADR-459 Phase 2/3 (proactive «βάλε/επέκτεινε πέδιλο»).
 *
 * Thin, decoupled bridge (mirror του `useColumnAdjacencyNotification`): ακούει
 * `drawing:entity-created` και, όταν σχεδιαστεί ΜΙΑ κολόνα χωρίς πέδιλο, εμφανίζει
 * non-blocking `ConfirmationToast`:
 *   · καμία στήριξη       → «Μια κολόνα δεν στέκεται μόνη της — να προστεθεί πέδιλο;»
 *                           → cross-level create στον όροφο Θεμελίωσης + FK.
 *   · γειτονικό πέδιλο    → «Επέκταση πεδίλου ώστε 2 κολόνες + 1 πέδιλο = ένας οργανισμός;»
 *                           → cross-level extend + FK.
 *   · ήδη καλύπτεται      → σιωπηλό FK (μηδέν toast).
 *
 * Grid-batch suppression: τα «κολώνες από κάναβο» δημιουργούν πολλές κολόνες στο
 * ΙΔΙΟ tick → microtask batch· prompt ΜΟΝΟ όταν δημιουργήθηκε ακριβώς ΜΙΑ (το grid
 * foundation flow, ADR-441, καλύπτει τις μαζικές). Detection/sizing/extend ζουν σε
 * SSoT pure modules· εδώ μένει μόνο event→toast→command wiring.
 *
 * @see bim/foundations/column-footing-suggestion.ts — covered/extend/create detection
 * @see bim/structural/footing-design/suggest-pad-dimensions.ts — sizing
 * @see bim/foundations/pad-extend.ts — combined-footing geometry
 * @see core/commands/entity-commands/CreateColumnFootingCommand.ts / ExtendFootingToColumnCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 2/3
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/auth/hooks/useAuth';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { ConfirmationToast } from '../ui/components/layers/components/ConfirmationToast';
import { useFoundationLevelStore } from '../state/foundation-level-store';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import {
  suggestColumnFooting,
  type FootingCandidate,
} from '../bim/foundations/column-footing-suggestion';
import { isFootingElement } from '../bim/foundations/footing-element-summary';
import { polygonCentroid } from '../bim/foundations/footing-column-coverage';
import {
  buildDefaultFoundationParams,
  buildFoundationEntity,
} from './drawing/foundation-completion';
import {
  suggestPadDimensions,
  PAD_FACE_OVERHANG_MM,
} from '../bim/structural/footing-design/suggest-pad-dimensions';
import { buildExtendedPadParams } from '../bim/foundations/pad-extend';
import { computeFoundationGeometry } from '../bim/geometry/foundation-geometry';
import { validateFoundationParams } from '../bim/validators/foundation-validator';
import { resolveColumnBaseZmm } from '../bim/geometry/column-vertical-profile';
import {
  createFoundationCrossLevelWriter,
  type FoundationCrossLevelWriter,
  type FoundationWriteScope,
} from '../bim/foundations/foundation-cross-level-writer';
import { CreateColumnFootingCommand } from '../core/commands/entity-commands/CreateColumnFootingCommand';
import { ExtendFootingToColumnCommand } from '../core/commands/entity-commands/ExtendFootingToColumnCommand';
import { AttachColumnFootingCommand } from '../core/commands/entity-commands/AttachColumnFootingCommand';
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

type ExecuteFn = ReturnType<typeof useCommandHistory>['execute'];

/** Χαρακτηριστικό αξονικό service φορτίο N = G + Q (kN), ή undefined. */
function serviceAxialKn(load: AppliedMemberLoad | undefined): number | undefined {
  if (!load) return undefined;
  return load.deadAxialKn + load.liveAxialKn;
}

/** Footing candidates (cross-level): foundation-level πέδιλα + active-scene πέδιλα. */
function collectFootingCandidates(
  activeEntities: readonly Entity[],
  activeFloorElevationMm: number,
  foundationEntities: readonly Entity[],
  foundationFloorElevationMm: number,
): FootingCandidate[] {
  const out: FootingCandidate[] = [];
  for (const e of foundationEntities) {
    if (isFootingElement(e)) out.push({ entity: e, floorElevationMm: foundationFloorElevationMm });
  }
  for (const e of activeEntities) {
    if (isFootingElement(e)) out.push({ entity: e, floorElevationMm: activeFloorElevationMm });
  }
  return out;
}

/** Χτίζει pad πέδιλο κάτω από την κολόνα (sized + positioned + foundation identity). */
function buildFootingUnderColumn(
  column: ColumnEntity,
  target: FoundationLevelTarget,
  activeFloorElevationMm: number,
  sceneUnits: SceneUnits,
  soilBearingCapacityKpa: number | undefined,
): FoundationEntity | null {
  const verts = column.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  const centroid = polygonCentroid(verts);
  const dims = suggestPadDimensions({
    columnWidthMm: column.params.width,
    columnDepthMm: column.params.depth,
    axialServiceKn: serviceAxialKn(column.params.appliedLoad),
    soilBearingCapacityKpa,
  });
  // Άνω παρειά πεδίλου στη βάση της κολόνας, εκφρασμένη σχετικά με το FFL Θεμελίωσης.
  const columnBaseAbs = resolveColumnBaseZmm(column.params, { floorElevationMm: activeFloorElevationMm });
  const topElevationMm = columnBaseAbs - target.floorElevationMm;
  const params = buildDefaultFoundationParams(
    { x: centroid.x, y: centroid.y },
    'pad',
    { width: dims.widthMm, length: dims.lengthMm, topElevationMm },
    sceneUnits,
  );
  const built = buildFoundationEntity(params, DXF_DEFAULT_LAYER);
  if (!built.ok) return null;
  return {
    ...built.entity,
    floorId: target.floorId,
    ...(target.sceneFileId ? { floorplanId: target.sceneFileId } : {}),
  };
}

/** Χτίζει το prev/next ζεύγος για την επέκταση υπάρχοντος pad ώστε να καλύψει τη νέα κολόνα. */
function buildExtendedFooting(
  existing: FoundationEntity,
  column: ColumnEntity,
  sceneUnits: SceneUnits,
): { prev: FoundationEntity; next: FoundationEntity } | null {
  const verts = column.geometry?.footprint?.vertices ?? [];
  const nextParams = buildExtendedPadParams(existing, verts, PAD_FACE_OVERHANG_MM, sceneUnits);
  if (!nextParams) return null;
  const geometry = computeFoundationGeometry(nextParams);
  const validation = validateFoundationParams(nextParams).bimValidation;
  return { prev: existing, next: { ...existing, params: nextParams, geometry, validation } };
}

export function useColumnFootingNotification(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();

  useEffect(() => {
    let pending: ColumnEntity[] = [];
    let scheduled = false;

    const adapterFor = (levelId: string): LevelSceneManagerAdapter =>
      new LevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelId);

    /** Σιωπηλό FK όταν η κολόνα ήδη καλύπτεται από πέδιλο (μηδέν toast). */
    const attachCovered = (column: ColumnEntity, levelId: string, footingId: string): void => {
      if (column.params.footingId === footingId) return;
      execute(new AttachColumnFootingCommand(footingId, [column.id], adapterFor(levelId)));
      EventBus.emit('bim:column-footing-attached', { columnIds: [column.id], footingId });
    };

    const writerFor = (target: FoundationLevelTarget): FoundationCrossLevelWriter | null => {
      const scope: FoundationWriteScope = {
        companyId: user?.companyId,
        projectId: levelManager.levels.find((l) => l.id === levelManager.currentLevelId)?.projectId,
        userId: user?.uid,
      };
      return createFoundationCrossLevelWriter(scope, target, levelManager);
    };

    const promptCreate = (
      column: ColumnEntity, levelId: string, target: FoundationLevelTarget,
      writer: FoundationCrossLevelWriter, sceneUnits: SceneUnits, execFn: ExecuteFn,
    ): void => {
      const soil = useStructuralSettingsStore.getState().soilBearingCapacityKpa;
      toast.custom(
        (id) => (
          <ConfirmationToast
            title={t('structuralOrganism.addFootingTitle')}
            message={t('structuralOrganism.addFootingMessage')}
            confirmText={t('structuralOrganism.addFootingConfirm')}
            cancelText={t('structuralOrganism.proactiveCancel')}
            onConfirm={() => {
              const footing = buildFootingUnderColumn(column, target, useFoundationLevelStore.getState().activeFloorElevationMm, sceneUnits, soil);
              if (footing) {
                execFn(new CreateColumnFootingCommand(footing, column.id, writer, adapterFor(levelId)));
                EventBus.emit('bim:column-footing-attached', { columnIds: [column.id], footingId: footing.id });
              }
              toast.dismiss(id);
            }}
            onCancel={() => toast.dismiss(id)}
          />
        ),
        { duration: Infinity },
      );
    };

    const promptExtend = (
      column: ColumnEntity, levelId: string, footingId: string,
      writer: FoundationCrossLevelWriter, sceneUnits: SceneUnits, execFn: ExecuteFn,
    ): void => {
      const existing = useFoundationLevelStore.getState().entities.find((e) => e.id === footingId);
      if (!existing || !isFoundationEntity(existing)) return;
      toast.custom(
        (id) => (
          <ConfirmationToast
            title={t('structuralOrganism.extendFootingTitle')}
            message={t('structuralOrganism.extendFootingMessage')}
            confirmText={t('structuralOrganism.extendFootingConfirm')}
            cancelText={t('structuralOrganism.proactiveCancel')}
            onConfirm={() => {
              const built = buildExtendedFooting(existing as FoundationEntity, column, sceneUnits);
              if (built) {
                execFn(new ExtendFootingToColumnCommand(built.prev, built.next, column.id, writer, adapterFor(levelId)));
                EventBus.emit('bim:column-footing-attached', { columnIds: [column.id], footingId });
              }
              toast.dismiss(id);
            }}
            onCancel={() => toast.dismiss(id)}
          />
        ),
        { duration: Infinity },
      );
    };

    const processColumn = (column: ColumnEntity): void => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const activeScene = levelManager.getLevelScene(levelId);
      if (!activeScene) return;
      const fl = useFoundationLevelStore.getState();
      const activeEntities = activeScene.entities as unknown as readonly Entity[];
      const candidates = collectFootingCandidates(
        activeEntities, fl.activeFloorElevationMm,
        fl.entities, fl.target?.floorElevationMm ?? fl.activeFloorElevationMm,
      );
      const suggestion = suggestColumnFooting(column, fl.activeFloorElevationMm, candidates);
      if (suggestion.kind === 'covered') {
        attachCovered(column, levelId, suggestion.footingId);
        return;
      }
      // create/extend = cross-level → χρειάζεται foundation target + writer.
      if (!fl.target) return;
      const writer = writerFor(fl.target);
      if (!writer) return;
      const sceneUnits = resolveSceneUnits(activeScene);
      if (suggestion.kind === 'extend') {
        promptExtend(column, levelId, suggestion.footingId, writer, sceneUnits, execute);
      } else {
        promptCreate(column, levelId, fl.target, writer, sceneUnits, execute);
      }
    };

    const unsub = EventBus.on('drawing:entity-created', ({ entity, tool }) => {
      if (tool !== 'column') return;
      const column = entity as unknown as Entity;
      if (!isColumnEntity(column)) return;
      pending.push(column as ColumnEntity);
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        const batch = pending;
        pending = [];
        scheduled = false;
        // Grid/batch (πολλές κολόνες στο ίδιο tick) → suppress (ADR-441 grid flow owns it).
        if (batch.length === 1) processColumn(batch[0]);
      });
    });
    return () => unsub();
  }, [levelManager, execute, t, user]);
}
