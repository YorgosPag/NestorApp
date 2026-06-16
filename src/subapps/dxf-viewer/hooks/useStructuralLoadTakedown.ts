'use client';

/**
 * useStructuralLoadTakedown — ADR-464 Slice 4 (αυτόματα φορτία πεδίλων).
 *
 * Thin shell hook (mirror του `useStructuralAutoReinforce`): ακούει το ribbon
 * request `bim:compute-loads-requested`, υπολογίζει pure τα tributary φορτία όλων των
 * εγγράψιμων πεδίλων του ενεργού ορόφου (`computeFootingTakedownLoads`), και εκτελεί
 * ΕΝΑ undoable `ComputeTakedownLoadsCommand` μέσω του command history. Μετά emit-άρει
 * `bim:structural-loads-computed` → ο `useStructuralOrganism` ξανα-υπολογίζει τους
 * ελέγχους έδρασης/σχεδιασμού + toast feedback.
 *
 * Storey count = μετρούμενοι όροφοι του κτιρίου (`useBuildingStoreyCount`, ADR-461)·
 * area loads = building-level `structuralSettingsStore` (G/Q kPa). Αδρανές χωρίς
 * area loads / ορόφους (advisory).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoReinforce`).
 *
 * @see core/commands/entity-commands/ComputeTakedownLoadsCommand.ts — το command
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import { useEffect, useRef } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { ComputeTakedownLoadsCommand } from '../core/commands/entity-commands/ComputeTakedownLoadsCommand';
import { computeFootingTakedownLoads } from '../bim/structural/footing-design/footing-load-takedown';
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
      const loads = computeFootingTakedownLoads(entities, {
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
      const command = new ComputeTakedownLoadsCommand(loads, sm);
      const loaded = command.getLoadedFootingIds();
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
