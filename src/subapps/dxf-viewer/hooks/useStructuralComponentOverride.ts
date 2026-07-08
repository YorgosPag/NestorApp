'use client';

/**
 * useStructuralComponentOverride — ADR-470 (per-element component visibility writer).
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
 * @see docs/centralized-systems/reference/adrs/ADR-470-structural-component-visibility.md
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { SetComponentVisibilityCommand } from '../core/commands/entity-commands/SetComponentVisibilityCommand';
// ADR-470 scope (σώμα/σοβά/οπλισμό) = SSoT «δομικά μέλη» (column/beam/wall/slab/stair/foundation).
import { isStructuralMemberEntity } from '../types/structural-entity-types';
import type { LevelSceneWriter } from '../systems/levels/level-scene-accessor';


export function useStructuralComponentOverride(props: { levelManager: LevelSceneWriter }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const unsub = EventBus.on('bim:set-component-visibility', ({ entityIds, component, value }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const selected = new Set(entityIds);
      const structuralIds = (scene.entities as unknown as ReadonlyArray<{ id: string; type: string }>)
        .filter((e) => selected.has(e.id) && isStructuralMemberEntity(e))
        .map((e) => e.id);
      if (structuralIds.length === 0) return;
      const sm = createLevelSceneManagerAdapter(
        levelManager.getLevelScene, levelManager.setLevelScene, levelId,
      );
      execute(new SetComponentVisibilityCommand(structuralIds, component, value ?? undefined, sm));
    });
    return () => { unsub(); };
  }, [levelManager, execute]);
}
