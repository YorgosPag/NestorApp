/**
 * structural-auto-reinforce-core — ADR-459 Phase 8 (proactive organism reinforce).
 *
 * SSoT πυρήνας του αυτόματου οπλισμού οργανισμού, εξαγμένος από το
 * `useStructuralAutoReinforce` ώστε να τον μοιράζονται **δύο** triggers χωρίς
 * διπλότυπο:
 *   · `useStructuralAutoReinforce` — ribbon κουμπί (`bim:auto-reinforce-requested`).
 *   · `useProactiveOrganismReinforce` — proactive geometry growth (Φ8).
 *
 * Resolve scope (επιλεγμένα ids → επιλεγμένα μέλη· κενό → όλος ο reinforceable
 * οργανισμός του ενεργού ορόφου) → build ΕΝΑ undoable `AutoReinforceOrganismCommand`
 * → `exec(cmd)` (execute ή executeGrouped, αποφασίζει ο caller) → emit
 * `bim:structural-auto-reinforced` (→ `useStructuralOrganism` re-derive διαγνωστικά).
 *
 * **Light module (Σκόπιμα χωρίς firebase/store imports):** ο `provider` περνιέται
 * injected από τον caller (που διαβάζει `structural-settings-store`) → ο πυρήνας
 * μένει jest-clean (καμία firebase chain). Το command είναι idempotent ως προς
 * ήδη-οπλισμένα μέλη → ασφαλές για επαναλαμβανόμενο proactive run.
 *
 * @see core/commands/entity-commands/AutoReinforceOrganismCommand.ts — το command
 * @see hooks/useStructuralAutoReinforce.ts — ribbon trigger
 * @see hooks/useProactiveOrganismReinforce.ts — proactive trigger (Φ8)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 8
 */

import type { ICommand } from '../core/commands/interfaces';
import { EventBus } from '../systems/events/EventBus';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { AutoReinforceOrganismCommand } from '../core/commands/entity-commands/AutoReinforceOrganismCommand';
import { isColumnEntity, isBeamEntity, isFoundationEntity } from '../types/entities';
import { isFoundationSlabEntity } from '../bim/structural/section-context';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';
import type { StructuralCodeProvider } from '../bim/structural/codes/structural-code-types';

export interface ReinforceLevelManager {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** Δομικό μέλος που δέχεται οπλισμό (κολόνα/δοκάρι/πέδιλο/εδαφόπλακα — ADR-459 Φ4e/E3). */
export function isReinforceable(e: Entity): boolean {
  return isColumnEntity(e) || isBeamEntity(e) || isFoundationEntity(e) || isFoundationSlabEntity(e);
}

/**
 * Εκτελεί τον αυτόματο οπλισμό του οργανισμού του ενεργού ορόφου.
 *
 * @param levelManager  ενεργός όροφος + scene accessors
 * @param entityIds     ρητό scope (selection)· κενό → όλος ο reinforceable οργανισμός
 * @param provider      ενεργός κανονισμός (injected — light module)
 * @param exec          executor από command history (`execute` ή `executeGrouped`)
 * @returns ο αριθμός των μελών που πράγματι οπλίστηκαν (0 = idempotent no-op)
 */
export function runOrganismAutoReinforce(
  levelManager: ReinforceLevelManager,
  entityIds: readonly string[],
  provider: StructuralCodeProvider,
  exec: (cmd: ICommand) => void,
): number {
  const levelId = levelManager.currentLevelId;
  if (!levelId) return 0;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return 0;

  const entities = scene.entities as unknown as readonly Entity[];
  // Scope (Revit-grade): επιλογή → επιλεγμένα· αλλιώς όλος ο οργανισμός ορόφου.
  const ids = entityIds.length > 0 ? entityIds : entities.filter(isReinforceable).map((e) => e.id);
  if (ids.length === 0) {
    EventBus.emit('bim:structural-auto-reinforced', { entityIds: [], count: 0 });
    return 0;
  }

  const sm = new LevelSceneManagerAdapter(
    levelManager.getLevelScene,
    levelManager.setLevelScene,
    levelId,
  );
  const command = new AutoReinforceOrganismCommand(ids, sm, provider);
  const reinforced = command.getReinforcedEntityIds();
  if (reinforced.length === 0) {
    // Όλα ήδη οπλισμένα / μη-δομικά — no-op (κανένα undo entry).
    EventBus.emit('bim:structural-auto-reinforced', { entityIds: [], count: 0 });
    return 0;
  }

  exec(command);
  EventBus.emit('bim:structural-auto-reinforced', {
    entityIds: reinforced,
    count: reinforced.length,
  });
  return reinforced.length;
}
