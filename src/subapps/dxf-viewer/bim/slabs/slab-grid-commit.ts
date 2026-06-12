/**
 * ADR-441 Slice GEN-SLAB — orchestrator για το «Πλάκες από κάναβο».
 *
 * Γέφυρα ανάμεσα στους pure builders (`slab-from-grid.ts`) και στο command history.
 * **Idempotent create** (ξανα-πάτημα = no-op), mirror του `beam-grid-commit.ts`.
 *
 * MAT (εδαφόπλακα): χτίζει την ενιαία πλάκα από το αποτύπωμα κτιρίου· idempotent skip
 * όταν υπάρχει ήδη `kind='foundation'` πλάκα στον όροφο (μία εδαφόπλακα = ένα slab-on-grade).
 *
 * FLOOR/ROOF bays (per-φάτνωμα): Slice FLOOR — προστίθεται εδώ με `bayKeyFromBindings`
 * idempotent set (4 axis-ids), ίδιο σκελετό με τα δοκάρια.
 *
 * @see ./slab-from-grid.ts — pure grid builders (target)
 * @see ../beams/beam-grid-commit.ts — γραμμικό πρότυπο
 * @see ../../core/commands/entity-commands/CreateSlabsCommand.ts — batch create
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §GEN-SLAB
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateSlabsCommand } from '../../core/commands/entity-commands/CreateSlabsCommand';
import {
  isSlabEntity,
  isWallEntity,
  isColumnEntity,
  isBeamEntity,
} from '../../types/entities';
import type { SlabParamOverrides } from '../../hooks/drawing/slab-completion';
import type { SceneUnits } from '../../utils/scene-units';
import { buildFoundationMatSlabs } from './slab-from-grid';

export interface SlabGridCommitDeps {
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Προαιρετικά param overrides (v1: defaults). */
  readonly overrides?: SlabParamOverrides;
}

export interface SlabGridCommitResult {
  readonly ok: boolean;
  readonly reason?: 'no-footprint' | 'up-to-date';
  /** Νέες πλάκες που δημιουργήθηκαν. */
  readonly created: number;
  /** Components/φατνώματα που παραλείφθηκαν (υπήρχε ήδη grid-managed πλάκα). */
  readonly skipped: number;
}

/**
 * Δημιούργησε την **ενιαία εδαφόπλακα** από το αποτύπωμα του κτιρίου. No-op
 * (`up-to-date`) όταν υπάρχει ήδη `kind='foundation'` πλάκα· `no-footprint` όταν
 * λείπουν δομικά στοιχεία (μηδέν τοίχοι/κολώνες/δοκάρια).
 */
export function commitFoundationMatFromGuides(
  deps: SlabGridCommitDeps,
): SlabGridCommitResult {
  const entities = deps.getLevelScene(deps.levelId)?.entities ?? [];

  // Idempotent: μία εδαφόπλακα ανά όροφο (Revit slab-on-grade). Υπάρχει ήδη → skip.
  const existingMat = entities.filter(isSlabEntity).some((s) => s.kind === 'foundation');
  if (existingMat) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped: 1 };
  }

  const walls = entities.filter(isWallEntity);
  const columns = entities.filter(isColumnEntity);
  const beams = entities.filter(isBeamEntity);

  const target = buildFoundationMatSlabs(
    walls,
    columns,
    beams,
    deps.overrides ?? {},
    deps.levelId,
    deps.sceneUnits,
  );
  if (!target.ok || target.slabs.length === 0) {
    return { ok: false, reason: 'no-footprint', created: 0, skipped: 0 };
  }

  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(new CreateSlabsCommand(target.slabs, adapter));
  return { ok: true, created: target.slabs.length, skipped: 0 };
}
