/**
 * structural-load-takedown-core — ADR-459 Phase 9 (proactive real-time φορτία).
 *
 * SSoT πυρήνας της διαδρομής φορτίων (ADR-467 load path / takedown), εξαγμένος από το
 * `useStructuralLoadTakedown` ώστε να τον μοιράζονται **δύο** triggers χωρίς διπλότυπο:
 *   · `useStructuralLoadTakedown`   — ribbon κουμπί (`bim:compute-loads-requested`).
 *   · `useProactiveStructuralLoads` — proactive geometry growth (Φ9).
 *
 * Χτίζει τον DERIVED στατικό graph (`buildStructuralGraph`), υπολογίζει pure τα
 * tributary φορτία **όλων** των μελών (`computeLoadPathPatches`), εκτελεί ΕΝΑ undoable
 * `ComputeLoadPathCommand` (`exec`: execute ή executeGrouped — αποφασίζει ο caller), και
 * emit-άρει `bim:structural-loads-computed` → οι downstream proactive hooks
 * (`useAutoFoundationDesign` re-sizing, `useStructuralOrganism` διαγνωστικά) αντιδρούν.
 *
 * **Light module (σκόπιμα χωρίς store/firebase imports):** τα `settings` (G/Q kPa +
 * πλήθος ορόφων) και ο `getOffset` (guide-store axis lookup) περνιούνται **injected**
 * από τον caller → ο πυρήνας μένει jest-clean (καμία firebase chain, mirror του
 * `structural-auto-reinforce-core`). Το command είναι idempotent ως προς χειροκίνητες
 * υπερβάσεις (`isTakedownWritable`) → ασφαλές για επαναλαμβανόμενο proactive run.
 *
 * @see core/commands/entity-commands/ComputeLoadPathCommand.ts — το command
 * @see bim/structural/loads/load-path-takedown.ts — computeLoadPathPatches (pure)
 * @see hooks/structural-auto-reinforce-core.ts — το αδελφό SSoT πρότυπο (Φ8)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 9
 */

import type { ICommand } from '../core/commands/interfaces';
import { EventBus } from '../systems/events/EventBus';
import { createLevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { ComputeLoadPathCommand } from '../core/commands/entity-commands/ComputeLoadPathCommand';
import { computeLoadPathPatches } from '../bim/structural/loads/load-path-takedown';
import { buildStructuralGraph } from '../bim/structural/organism/structural-graph';
import type { TakedownSettings } from '../bim/structural/loads/load-takedown';
import type { GuideOffsetLookup } from '../bim/hosting/derive-slots';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';

export interface LoadTakedownLevelManager {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/**
 * Εκτελεί τη διαδρομή φορτίων του ενεργού ορόφου.
 *
 * @param levelManager  ενεργός όροφος + scene accessors
 * @param settings      G/Q area loads (kPa) + πλήθος ορόφων (injected — light module)
 * @param getOffset     guide-store axis offset lookup (injected — grid-anchored tributary)
 * @param exec          executor από command history (`execute` ή `executeGrouped`)
 * @returns ο αριθμός των μελών που πράγματι φορτίστηκαν (0 = no-op / advisory)
 */
export function runStructuralLoadTakedown(
  levelManager: LoadTakedownLevelManager,
  settings: TakedownSettings,
  getOffset: GuideOffsetLookup,
  exec: (cmd: ICommand) => void,
): number {
  const levelId = levelManager.currentLevelId;
  if (!levelId) return 0;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return 0;

  const entities = scene.entities as unknown as readonly Entity[];
  const graph = buildStructuralGraph(entities);
  const loads = computeLoadPathPatches(entities, graph, settings, getOffset);
  if (loads.length === 0) {
    EventBus.emit('bim:structural-loads-computed', { entityIds: [], count: 0 });
    return 0;
  }

  const sm = createLevelSceneManagerAdapter(
    levelManager.getLevelScene,
    levelManager.setLevelScene,
    levelId,
  );
  const command = new ComputeLoadPathCommand(loads, sm);
  const loaded = command.getLoadedMemberIds();
  if (loaded.length === 0) {
    // Όλα χειροκίνητα / μη-εγγράψιμα — no-op (κανένα undo entry).
    EventBus.emit('bim:structural-loads-computed', { entityIds: [], count: 0 });
    return 0;
  }

  exec(command);
  EventBus.emit('bim:structural-loads-computed', { entityIds: loaded, count: loaded.length });
  return loaded.length;
}
