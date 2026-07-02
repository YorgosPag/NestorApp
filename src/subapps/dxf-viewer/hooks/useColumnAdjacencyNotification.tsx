/**
 * useColumnAdjacencyNotification — ADR-363 Adjacency Merge (UX bridge).
 *
 * Thin, decoupled bridge (mirror του `useStructuralAutoAttach`): ακούει ΤΡΙΑ events και, όταν μια
 * κολόνα αγγίζει υφιστάμενες κολόνες που μαζί σχηματίζουν τοιχίο (Γ/Τ/Π/composite), εμφανίζει
 * **non-blocking toast** «Συγχώνευση σε τοιχίο / Αφήστε ξεχωριστά» (απόφαση μηχανικού — Revit/ETABS/
 * Tekla grade: ποτέ block, ποτέ σιωπηλό auto-merge). Στο «Συγχώνευση» τρέχει ΕΝΑ undoable
 * `MergeColumnsCommand` (single Ctrl+Z). Η ανίχνευση + το union/build ζουν στο SSoT
 * `column-adjacency-detector`· εδώ μένει μόνο το event → toast → command wiring.
 *
 * Triggers (§5.6c — Giorgio 2026-07-02, «ένωση δύο υπαρχουσών Γ/L»):
 *   1. `drawing:entity-created` — νέα κολόνα ακουμπά υπάρχουσες (αρχικό).
 *   2. `bim:column-params-updated` — resize / center-move grip / panel-ribbon edit.
 *   3. `bim:entities-moved` — Move/Rotate tool ολόκληρης οντότητας (fresh `movedEntities` overlay).
 *
 * Mounted once από το viewer shell (δίπλα στο `useStructuralAutoAttach`), αφού ο
 * `levelManager` + ο command-history provider είναι σε scope.
 *
 * @see bim/columns/column-adjacency-detector.ts — findAdjacentColumnMergeGroup
 * @see core/commands/entity-commands/MergeColumnsCommand.ts — η εντολή συγχώνευσης
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { MergeColumnsCommand } from '../core/commands/entity-commands/MergeColumnsCommand';
import {
  findAdjacentColumnMergeGroup,
  buildCompositeFromColumns,
  type ColumnMergeGroup,
} from '../bim/columns/column-adjacency-detector';
import { ConfirmationToast } from '../ui/components/layers/components/ConfirmationToast';
import { isColumnEntity, type Entity } from '../types/entities';
import type { ColumnEntity } from '../bim/types/column-types';
import type { SceneModel } from '../types/scene';
import { resolveSceneUnits } from '../utils/scene-units';
import { TOLERANCE_CONFIG } from '../config/tolerance-config';
import { getImmediateTransform } from '../systems/cursor/ImmediateTransformStore';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

type ExecuteFn = ReturnType<typeof useCommandHistory>['execute'];

/** Συλλέγει τις live πηγές-κολόνες της ομάδας από τη σκηνή (≥2 αλλιώς null). */
function collectGroupSources(
  group: ColumnMergeGroup,
  entities: readonly Entity[],
): ColumnEntity[] | null {
  const sources = group.columnIds
    .map((id) => entities.find((e) => e.id === id))
    .filter((e): e is Entity => !!e && isColumnEntity(e))
    .map((e) => e as ColumnEntity);
  return sources.length >= 2 ? sources : null;
}

/** Χτίζει το composite + τρέχει το undoable `MergeColumnsCommand` (single undo). */
function runMerge(
  group: ColumnMergeGroup,
  levelManager: LevelManagerLike,
  levelId: string,
  tol: number,
  execute: ExecuteFn,
): void {
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return;
  const entities = scene.entities as unknown as readonly Entity[];
  const sources = collectGroupSources(group, entities);
  if (!sources) return; // η σκηνή άλλαξε από τότε που εμφανίστηκε το toast

  const composite = buildCompositeFromColumns(sources, sources[0].layerId, resolveSceneUnits(scene), tol);
  if (!composite) return;

  const sm = createLevelSceneManagerAdapter(
    levelManager.getLevelScene,
    levelManager.setLevelScene,
    levelId,
  );
  execute(new MergeColumnsCommand(sources, composite, sm));
  EventBus.emit('bim:columns-merged', {
    sourceIds: sources.map((s) => s.id),
    compositeId: composite.id,
  });
}

export function useColumnAdjacencyNotification(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  useEffect(() => {
    // Οι τρέχουσες οντότητες του ενεργού ορόφου (null αν λείπει σκηνή).
    const currentEntities = (levelId: string): readonly Entity[] | null => {
      const scene = levelManager.getLevelScene(levelId);
      return scene ? (scene.entities as unknown as readonly Entity[]) : null;
    };

    // Non-blocking toast «Συγχώνευση / Αφήστε ξεχωριστά» — απόφαση μηχανικού (Revit/ETABS/Tekla grade).
    const showMergeToast = (group: ColumnMergeGroup, levelId: string, tol: number): void => {
      toast.custom(
        (id) => (
          <ConfirmationToast
            title={t('columnAdjacency.title')}
            message={t('columnAdjacency.message')}
            confirmText={t('columnAdjacency.merge')}
            cancelText={t('columnAdjacency.keepSeparate')}
            onConfirm={() => {
              runMerge(group, levelManager, levelId, tol, execute);
              toast.dismiss(id);
            }}
            onCancel={() => toast.dismiss(id)}
          />
        ),
        { duration: Infinity },
      );
    };

    // Αξιολόγηση ΜΙΑΣ κολόνας-seed έναντι της σκηνής· toast αν η ένωση σχηματίζει τοιχίο.
    // `dedup` (ανά event) αποτρέπει διπλό toast για την ΙΔΙΑ ομάδα όταν κινούνται πολλές κολόνες μαζί.
    const evaluate = (seed: ColumnEntity, entities: readonly Entity[], levelId: string, dedup: Set<string>): void => {
      const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
      const group = findAdjacentColumnMergeGroup(seed, entities, tol);
      if (!group) return;
      const key = [...group.columnIds].sort().join('|');
      if (dedup.has(key)) return;
      dedup.add(key);
      showMergeToast(group, levelId, tol);
    };

    // 1) ΔΗΜΙΟΥΡΓΙΑ νέας κολόνας που ακουμπά υπάρχουσες (αρχικό trigger).
    const onCreated = EventBus.on('drawing:entity-created', ({ entity, tool }) => {
      if (tool !== 'column') return;
      const created = entity as unknown as Entity;
      if (!isColumnEntity(created)) return;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const entities = currentEntities(levelId);
      if (!entities) return;
      evaluate(created as ColumnEntity, entities, levelId, new Set<string>());
    });

    // 2) ΕΠΕΞΕΡΓΑΣΙΑ διαστάσεων/κεντρικής μετακίνησης (resize grip / center-move grip / panel-ribbon).
    //    Το `UpdateColumnParamsCommand` έχει ήδη ενημερώσει τη σκηνή πριν το emit → getLevelScene fresh.
    const onParamsUpdated = EventBus.on('bim:column-params-updated', ({ columnId }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const entities = currentEntities(levelId);
      if (!entities) return;
      const seed = entities.find((e) => e.id === columnId);
      if (!seed || !isColumnEntity(seed)) return;
      evaluate(seed as ColumnEntity, entities, levelId, new Set<string>());
    });

    // 3) ΜΕΤΑΚΙΝΗΣΗ/ΠΕΡΙΣΤΡΟΦΗ ολόκληρης οντότητας (Move/Rotate tool → `bim:entities-moved`). Το payload
    //    φέρει τα ΦΡΕΣΚΑ `movedEntities` (η getLevelScene μπορεί να είναι stale για τα κινούμενα) → τα
    //    επικαλύπτουμε πάνω στη σκηνή ώστε ο seed + οι γείτονες να έχουν σωστές θέσεις. Εδώ κλείνει το
    //    κενό «ενώνω δύο υπάρχουσες Γ/L σέρνοντάς τες» (Giorgio 2026-07-02).
    const onMoved = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const base = currentEntities(levelId);
      if (!base) return;
      const movedById = new Map(movedEntities.map((e) => [e.id, e as unknown as Entity]));
      const entities = base.map((e) => movedById.get(e.id) ?? e);
      const dedup = new Set<string>();
      for (const m of movedEntities) {
        const col = m as unknown as Entity;
        if (!isColumnEntity(col)) continue;
        evaluate(col as ColumnEntity, entities, levelId, dedup);
      }
    });

    return () => {
      onCreated();
      onParamsUpdated();
      onMoved();
    };
  }, [levelManager, execute, t]);
}
