'use client';

/**
 * useStructuralLoadTakedown — ADR-466 (διαδρομή φορτίων: slab→beam→column→footing).
 *
 * Thin shell hook (mirror του `useStructuralAutoReinforce`): ακούει το ribbon
 * request `bim:compute-loads-requested`, χτίζει τον στατικό οργανισμό
 * (`buildStructuralGraph`), υπολογίζει pure τα tributary φορτία **όλων των μελών** του
 * ενεργού ορόφου (`computeLoadPathPatches`), και εκτελεί ΕΝΑ undoable
 * `ComputeLoadPathCommand` μέσω του command history. Μετά emit-άρει
 * `bim:structural-loads-computed` → ο `useStructuralOrganism` ξανα-υπολογίζει τους
 * ελέγχους έδρασης/σχεδιασμού + toast feedback.
 *
 * Storey count = μετρούμενοι όροφοι του κτιρίου (`useBuildingStoreyCount`, ADR-461)·
 * area loads = building-level `structuralSettingsStore` (G/Q kPa). Αδρανές χωρίς
 * area loads / ορόφους (advisory).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoReinforce`).
 *
 * @see core/commands/entity-commands/ComputeLoadPathCommand.ts — το command
 * @see docs/centralized-systems/reference/adrs/ADR-466-load-path-engine.md
 */

import { useEffect, useRef } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { ComputeLoadPathCommand } from '../core/commands/entity-commands/ComputeLoadPathCommand';
import { computeLoadPathPatches } from '../bim/structural/loads/load-path-takedown';
import { buildStructuralGraph } from '../bim/structural/organism/structural-graph';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { useBuildingStoreyCount } from './useBuildingStoreyCount';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

export function useStructuralLoadTakedown(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();
  const storeyCount = useBuildingStoreyCount();
  // Ref ώστε ο event callback να διαβάζει το τρέχον storeyCount χωρίς re-subscribe.
  const storeyCountRef = useRef(storeyCount);
  storeyCountRef.current = storeyCount;

  useEffect(() => {
    const unsub = EventBus.on('bim:compute-loads-requested', () => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;

      const entities = scene.entities as unknown as readonly Entity[];
      const settings = useStructuralSettingsStore.getState();
      const graph = buildStructuralGraph(entities);
      const loads = computeLoadPathPatches(entities, graph, {
        storeyCount: storeyCountRef.current,
        deadAreaLoadKpa: settings.deadAreaLoadKpa ?? 0,
        liveAreaLoadKpa: settings.liveAreaLoadKpa ?? 0,
      });
      if (loads.length === 0) {
        EventBus.emit('bim:structural-loads-computed', { entityIds: [], count: 0 });
        return;
      }

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      const command = new ComputeLoadPathCommand(loads, sm);
      const loaded = command.getLoadedMemberIds();
      if (loaded.length === 0) {
        EventBus.emit('bim:structural-loads-computed', { entityIds: [], count: 0 });
        return;
      }
      execute(command);
      EventBus.emit('bim:structural-loads-computed', { entityIds: loaded, count: loaded.length });
    });
    return () => unsub();
  }, [levelManager, execute]);
}
