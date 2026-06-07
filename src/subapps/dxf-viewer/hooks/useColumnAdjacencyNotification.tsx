/**
 * useColumnAdjacencyNotification — ADR-363 Post-Creation Adjacency Merge (UX bridge).
 *
 * Thin, decoupled bridge (mirror του `useStructuralAutoAttach`): ακούει
 * `drawing:entity-created` και, όταν η νέα κολόνα αγγίζει υφιστάμενες κολόνες που
 * μαζί σχηματίζουν τοιχίο (Γ/Τ/Π), εμφανίζει **non-blocking toast** «Συγχώνευση σε
 * τοιχίο / Αφήστε ξεχωριστά». Στο «Συγχώνευση» τρέχει ΕΝΑ undoable
 * `MergeColumnsCommand` (single Ctrl+Z). Η ανίχνευση + το union/build ζουν στο SSoT
 * `column-adjacency-detector`· εδώ μένει μόνο το event → toast → command wiring.
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
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
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

  const sm = new LevelSceneManagerAdapter(
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
    const unsub = EventBus.on('drawing:entity-created', ({ entity, tool }) => {
      if (tool !== 'column') return;
      const created = entity as unknown as Entity;
      if (!isColumnEntity(created)) return;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;

      const entities = scene.entities as unknown as readonly Entity[];
      const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
      const group = findAdjacentColumnMergeGroup(created as ColumnEntity, entities, tol);
      if (!group) return;

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
    });
    return () => unsub();
  }, [levelManager, execute, t]);
}
