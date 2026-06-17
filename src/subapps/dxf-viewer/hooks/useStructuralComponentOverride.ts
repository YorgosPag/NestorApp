'use client';

/**
 * useStructuralComponentOverride — ADR-469 (per-element component visibility writer).
 *
 * Thin shell hook (mirror του `useStructuralFootingConnect`): ακούει το ribbon
 * request «Ορατότητα στοιχείων → επιλεγμένο» από το
 * {@link StructuralComponentElementOverride} widget, φιλτράρει τα επιλεγμένα
 * δομικά στοιχεία και εκτελεί ΕΝΑ undoable `SetComponentVisibilityCommand`
 * (per-element override του σώματος/σοβά/οπλισμού· `value=null` ⇒ επιστροφή στο
 * per-view flag). Persist + audit μέσω του κοινού `signalEntitiesAttached`.
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralFootingConnect`).
 *
 * @see core/commands/entity-commands/SetComponentVisibilityCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-469-structural-component-visibility.md
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { SetComponentVisibilityCommand } from '../core/commands/entity-commands/SetComponentVisibilityCommand';
import {
  isColumnEntity, isBeamEntity, isWallEntity, isSlabEntity, isStairEntity, isFoundationEntity,
} from '../types/entities';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** True για τα δομικά στοιχεία που έχουν σώμα/σοβά/οπλισμό (ADR-469 scope). */
function isStructuralEntity(e: Entity): boolean {
  return (
    isColumnEntity(e) || isBeamEntity(e) || isWallEntity(e) ||
    isSlabEntity(e) || isStairEntity(e) || isFoundationEntity(e)
  );
}

export function useStructuralComponentOverride(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const unsub = EventBus.on('bim:set-component-visibility', ({ entityIds, component, value }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const selected = new Set(entityIds);
      const structuralIds = (scene.entities as unknown as readonly Entity[])
        .filter((e) => selected.has(e.id) && isStructuralEntity(e))
        .map((e) => e.id);
      if (structuralIds.length === 0) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene, levelManager.setLevelScene, levelId,
      );
      execute(new SetComponentVisibilityCommand(structuralIds, component, value ?? undefined, sm));
    });
    return () => { unsub(); };
  }, [levelManager, execute]);
}
