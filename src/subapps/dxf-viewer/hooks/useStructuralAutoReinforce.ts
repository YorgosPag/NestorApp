'use client';

/**
 * useStructuralAutoReinforce — ADR-459 Phase 4d (auto-apply reinforcement bridge).
 *
 * Thin, decoupled shell hook (mirror του `useStructuralAutoAttach`): ακούει το
 * ribbon request `bim:auto-reinforce-requested`, αναλύει το scope (επιλογή →
 * επιλεγμένα μέλη· κενή επιλογή → όλος ο στατικός οργανισμός του ενεργού ορόφου),
 * και εκτελεί ΕΝΑ undoable `AutoReinforceOrganismCommand` μέσω του command history.
 * Μετά emit-άρει `bim:structural-auto-reinforced` → ο `useStructuralOrganism`
 * ξανα-υπολογίζει τα warnings + (μελλοντικά) toast feedback.
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralAutoAttach`).
 *
 * @see core/commands/entity-commands/AutoReinforceOrganismCommand.ts — το command
 * @see hooks/useStructuralOrganism.ts — re-derive warnings μετά το reinforce
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4d
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { AutoReinforceOrganismCommand } from '../core/commands/entity-commands/AutoReinforceOrganismCommand';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { isColumnEntity, isBeamEntity, isFoundationEntity } from '../types/entities';
import { isFoundationSlabEntity } from '../bim/structural/section-context';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** Δομικό μέλος που δέχεται οπλισμό (κολόνα/δοκάρι/πέδιλο/εδαφόπλακα — ADR-459 Φ4e/E3). */
function isReinforceable(e: Entity): boolean {
  return isColumnEntity(e) || isBeamEntity(e) || isFoundationEntity(e) || isFoundationSlabEntity(e);
}

export function useStructuralAutoReinforce(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const unsub = EventBus.on('bim:auto-reinforce-requested', ({ entityIds }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;

      const entities = scene.entities as unknown as readonly Entity[];
      // Scope (Revit-grade): επιλογή → επιλεγμένα· αλλιώς όλος ο οργανισμός ορόφου.
      const ids =
        entityIds.length > 0 ? entityIds : entities.filter(isReinforceable).map((e) => e.id);
      if (ids.length === 0) return;

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      const command = new AutoReinforceOrganismCommand(ids, sm, provider);
      const reinforced = command.getReinforcedEntityIds();
      if (reinforced.length === 0) {
        // Όλα ήδη οπλισμένα / μη-δομικά — no-op (κανένα undo entry).
        EventBus.emit('bim:structural-auto-reinforced', { entityIds: [], count: 0 });
        return;
      }
      execute(command);
      EventBus.emit('bim:structural-auto-reinforced', {
        entityIds: reinforced,
        count: reinforced.length,
      });
    });
    return () => unsub();
  }, [levelManager, execute]);
}
