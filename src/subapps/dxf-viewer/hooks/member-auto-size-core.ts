/**
 * member-auto-size-core — ADR-475 (proactive auto διαστασιολόγηση μελών).
 *
 * SSoT πυρήνας της αυτόματης διαστασιολόγησης διατομής, mirror του
 * `structural-auto-reinforce-core`: resolve scope (όλα τα δοκάρια του ενεργού
 * ορόφου) → build ΕΝΑ undoable `AutoSizeMembersCommand` → `exec(cmd)` → emit
 * `bim:beam-params-updated` ανά διαστασιολογημένο δοκάρι (ώστε να το σώσει το
 * `useBeamPersistence` ΚΑΙ να ξανα-τρέξουν φορτία+οπλισμός στη νέα διατομή).
 *
 * **Light module (zero firebase/store imports):** ο `provider` injected από τον
 * caller → jest-clean. Το command είναι idempotent ως προς locked/converged μέλη.
 *
 * **Σύγκλιση (κρίσιμο):** η αλυσίδα `sizing → beam-params-updated → loads →
 * loads-computed → sizing` τερματίζει στον convergence guard του `buildBeamSizePatch`
 * (ίδια 50mm-quantized διατομή → μηδέν patch → μηδέν emit). Anti-oscillation.
 *
 * @see core/commands/entity-commands/AutoSizeMembersCommand.ts — το command
 * @see hooks/useProactiveMemberSizing.ts — proactive trigger
 * @see docs/centralized-systems/reference/adrs/ADR-475-auto-member-sizing.md
 */

import type { ICommand } from '../core/commands/interfaces';
import { EventBus } from '../systems/events/EventBus';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { AutoSizeMembersCommand } from '../core/commands/entity-commands/AutoSizeMembersCommand';
import { isBeamEntity } from '../types/entities';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';
import type { StructuralCodeProvider } from '../bim/structural/codes/structural-code-types';

export interface MemberSizeLevelManager {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/**
 * Εκτελεί την αυτόματη διαστασιολόγηση των δοκαριών του ενεργού ορόφου.
 *
 * @param levelManager  ενεργός όροφος + scene accessors
 * @param provider      ενεργός κανονισμός (injected — light module)
 * @param exec          executor από command history (`execute` ή `executeGrouped`)
 * @returns ο αριθμός των δοκαριών που πράγματι διαστασιολογήθηκαν (0 = no-op)
 */
export function runMemberAutoSize(
  levelManager: MemberSizeLevelManager,
  provider: StructuralCodeProvider,
  exec: (cmd: ICommand) => void,
): number {
  const levelId = levelManager.currentLevelId;
  if (!levelId) return 0;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return 0;

  const entities = scene.entities as unknown as readonly Entity[];
  const ids = entities.filter(isBeamEntity).map((e) => e.id);
  if (ids.length === 0) return 0;

  const sm = new LevelSceneManagerAdapter(
    levelManager.getLevelScene,
    levelManager.setLevelScene,
    levelId,
  );
  const command = new AutoSizeMembersCommand(ids, sm, provider);
  const resized = command.getResizedEntityIds();
  if (resized.length === 0) return 0; // converged / locked → no-op (κανένα undo entry)

  exec(command);
  // Persist + re-chain (φορτία→οπλισμός) στη νέα διατομή· loop-safe μέσω convergence guard.
  for (const beamId of resized) EventBus.emit('bim:beam-params-updated', { beamId });
  return resized.length;
}
