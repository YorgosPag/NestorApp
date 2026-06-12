/**
 * ADR-441 Slice GEN-SLAB — orchestrator για το «Πλάκες από κάναβο».
 *
 * Γέφυρα ανάμεσα στους pure builders (`slab-from-grid.ts`) και στο command history.
 * **Idempotent create** (ξανα-πάτημα = no-op), mirror του `beam-grid-commit.ts`.
 *
 * MAT (εδαφόπλακα = ground-bearing slab): χτίζει την ενιαία πλάκα από το αποτύπωμα κτιρίου·
 * idempotent skip όταν υπάρχει ήδη `kind='ground'` πλάκα στον όροφο (μία εδαφόπλακα/όροφο).
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
import { hasGuideBindings } from '../hosting/guide-binding-types';
import type { AxisGuideReader } from '../foundations/foundation-from-grid';
import { bayKeyFromBindings } from '../foundations/foundation-grid-segments';
import type { SlabKind } from '../types/slab-types';
import type { SlabParamOverrides } from '../../hooks/drawing/slab-completion';
import type { SceneUnits } from '../../utils/scene-units';
import { buildGroundBearingSlabs, buildSlabBaysFromGuides } from './slab-from-grid';

export interface SlabGridCommitDeps {
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Read-surface του κανάβου — απαραίτητο ΜΟΝΟ για bays (floor/roof). */
  readonly guideReader?: AxisGuideReader;
  /** Προαιρετικά param overrides (v1: defaults). */
  readonly overrides?: SlabParamOverrides;
}

export interface SlabGridCommitResult {
  readonly ok: boolean;
  readonly reason?: 'no-footprint' | 'up-to-date' | 'insufficient-guides';
  /** Νέες πλάκες που δημιουργήθηκαν. */
  readonly created: number;
  /** Components/φατνώματα που παραλείφθηκαν (υπήρχε ήδη grid-managed πλάκα). */
  readonly skipped: number;
}

/**
 * Δημιούργησε την **ενιαία εδαφόπλακα** (ground-bearing slab, δάπεδο επί εδάφους) από το
 * αποτύπωμα του κτιρίου. Άνω παρειά στο FFL (0) + layered build-up (SSoT· φέρον κάτω από
 * το FFL). No-op (`up-to-date`) όταν υπάρχει ήδη `kind='ground'` πλάκα· `no-footprint`
 * όταν λείπουν δομικά στοιχεία (μηδέν τοίχοι/κολώνες/δοκάρια).
 */
export function commitFoundationMatFromGuides(
  deps: SlabGridCommitDeps,
): SlabGridCommitResult {
  const entities = deps.getLevelScene(deps.levelId)?.entities ?? [];

  // Idempotent: μία εδαφόπλακα ανά όροφο (ground-bearing). Υπάρχει ήδη → skip.
  const existingMat = entities.filter(isSlabEntity).some((s) => s.kind === 'ground');
  if (existingMat) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped: 1 };
  }

  const walls = entities.filter(isWallEntity);
  const columns = entities.filter(isColumnEntity);
  const beams = entities.filter(isBeamEntity);

  const target = buildGroundBearingSlabs(
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

/** Τα bay-keys των ήδη grid-managed πλακών (floor/roof) του ίδιου kind (idempotent skip). */
function existingGridBayKeys(
  entities: readonly { type: string }[],
  kind: SlabKind,
): Set<string> {
  const keys = new Set<string>();
  for (const e of entities) {
    if (!isSlabEntity(e) || e.kind !== kind || !hasGuideBindings(e)) continue;
    const key = bayKeyFromBindings(e.guideBindings);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Δημιούργησε **per-φάτνωμα** πλάκες (δάπεδα `kind='floor'` ή οροφές `kind='roof'`) από
 * τον κάναβο, clipped στις παρειές δοκαριών & notched γύρω από κολώνες. Idempotent: skip
 * φατνωμάτων με ήδη υπάρχουσα grid πλάκα ΙΔΙΟΥ kind (floor & roof συνυπάρχουν στο ίδιο
 * φάτνωμα). `up-to-date` όταν κάθε φάτνωμα έχει ήδη πλάκα· `insufficient-guides` όταν
 * λείπουν άξονες.
 */
export function commitSlabBaysFromGuides(
  deps: SlabGridCommitDeps,
  kind: 'floor' | 'roof',
): SlabGridCommitResult {
  if (!deps.guideReader) {
    return { ok: false, reason: 'insufficient-guides', created: 0, skipped: 0 };
  }
  const entities = deps.getLevelScene(deps.levelId)?.entities ?? [];
  const beams = entities.filter(isBeamEntity);
  const columns = entities.filter(isColumnEntity);

  const target = buildSlabBaysFromGuides(
    deps.guideReader,
    beams,
    columns,
    { ...deps.overrides, kind },
    deps.levelId,
    deps.sceneUnits,
  );
  if (!target.ok || target.slabs.length === 0) {
    return { ok: false, reason: target.reason ?? 'insufficient-guides', created: 0, skipped: 0 };
  }

  const existingKeys = existingGridBayKeys(entities, kind);
  const toCreate = target.slabs.filter((s) => {
    const key = bayKeyFromBindings(s.guideBindings ?? []);
    return key !== null && !existingKeys.has(key);
  });
  const skipped = target.slabs.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped };
  }

  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(new CreateSlabsCommand(toCreate, adapter));
  return { ok: true, created: toCreate.length, skipped };
}
