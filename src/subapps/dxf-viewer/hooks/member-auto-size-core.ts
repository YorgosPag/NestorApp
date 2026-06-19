/**
 * member-auto-size-core — ADR-475 (proactive auto διαστασιολόγηση μελών).
 *
 * SSoT πυρήνας της αυτόματης διαστασιολόγησης διατομής, mirror του
 * `structural-auto-reinforce-core`: resolve scope (όλα τα διαστασιολογήσιμα μέλη του
 * ενεργού ορόφου — δοκάρι ύψος ADR-475, πλάκα-πρόβολος πάχος ADR-499) → build ΕΝΑ
 * undoable `AutoSizeMembersCommand` → `exec(cmd)` → emit `bim:<kind>-params-updated`
 * ανά διαστασιολογημένο μέλος μέσω του ΕΝΟΣ `emitBimEntityParamsUpdated` (ADR-459 Φ7),
 * ώστε να το σώσει η persistence ΚΑΙ να ξανα-τρέξουν φορτία+οπλισμός στη νέα διατομή.
 *
 * **Light module (zero firebase/store imports):** ο `provider` injected από τον
 * caller → jest-clean. Το command είναι idempotent ως προς locked/converged μέλη.
 *
 * **Σύγκλιση (κρίσιμο):** η αλυσίδα `sizing → *-params-updated → loads → loads-computed
 * → sizing` τερματίζει στον convergence guard κάθε patch builder (ίδια quantized
 * διατομή → μηδέν patch → μηδέν emit). Anti-oscillation, μηδέν infinite-loop.
 *
 * @see core/commands/entity-commands/AutoSizeMembersCommand.ts — το command
 * @see hooks/useProactiveMemberSizing.ts — proactive trigger
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

import type { ICommand } from '../core/commands/interfaces';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import { AutoSizeMembersCommand } from '../core/commands/entity-commands/AutoSizeMembersCommand';
import { isBeamEntity, isSlabEntity, isColumnEntity } from '../types/entities';
import { emitBimEntityParamsUpdated } from '../systems/events/emit-bim-entity-params-updated';
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
  // ADR-499 — member-generic scope: δοκάρι (ύψος) + πλάκα-πρόβολος (πάχος) + κολώνα
  // (διατομή, §B2). Το command skip-άρει σιωπηλά όσα δεν αλλάζουν (null patch) → ασφαλές super-set.
  const sizeable = entities.filter((e) => isBeamEntity(e) || isSlabEntity(e) || isColumnEntity(e));
  const ids = sizeable.map((e) => e.id);
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
  // Persist + re-chain (φορτία→οπλισμός) στη νέα διατομή ανά τύπο μέλους (ΕΝΑ SSoT
  // emit helper, ADR-459 Φ7)· loop-safe μέσω convergence guard.
  const typeById = new Map(sizeable.map((e) => [e.id, e.type]));
  for (const id of resized) emitBimEntityParamsUpdated(typeById.get(id) ?? '', id);
  return resized.length;
}
