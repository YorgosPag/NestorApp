/**
 * ADR-441 Slice GEN-WALL — orchestrator για το «Τοίχοι από κάναβο».
 *
 * Γέφυρα ανάμεσα στον pure builder (`buildWallGridFromGuides`) και στο command
 * history. **Idempotent create** (ξανα-πάτημα = no-op): χτίζει το target (έναν
 * born-bound τοίχο ανά segment άξονα), παραλείπει τα segments όπου ήδη υπάρχει
 * grid-managed τοίχος (ίδιο σύνολο start/end x/y guide ids, direction-agnostic), και
 * δημιουργεί μόνο τα missing σε ΕΝΑ atomic step (1 undo).
 *
 * v1 scope: create-only, ΧΩΡΙΣ auto-miter στις τομές. Το follow-on-move δουλεύει ήδη
 * μέσω του hosting reconciler (ADR-441 Slice WALL). Full reconcile + miter-join = DEFER.
 *
 * @see ./wall-from-grid.ts — pure grid builder (target)
 * @see ../../core/commands/entity-commands/CreateWallsCommand.ts — batch create
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateWallsCommand } from '../../core/commands/entity-commands/CreateWallsCommand';
import { isWallEntity, isColumnEntity } from '../../types/entities';
import { hasGuideBindings, type GuideBinding } from '../hosting/guide-binding-types';
import type { AxisGuideReader } from '../foundations/foundation-from-grid';
import type { WallParamOverrides } from '../../hooks/drawing/wall-completion';
import type { SceneUnits } from '../../utils/scene-units';
import {
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from '../grid/grid-justification';
import { buildWallGridFromGuides } from './wall-from-grid';

export interface WallGridCommitDeps {
  /** Read-surface του κανάβου (guide-store singleton ή test double). */
  readonly guideReader: AxisGuideReader;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Προαιρετικά param overrides (v1: defaults). */
  readonly overrides?: WallParamOverrides;
  /** ADR-441 3-mode — Wall Location Line (center/inner/outer)· default `inner`. */
  readonly perimeterMode?: GridPerimeterMode;
}

export interface WallGridCommitResult {
  readonly ok: boolean;
  readonly reason?: 'insufficient-guides' | 'up-to-date';
  /** Νέοι τοίχοι που δημιουργήθηκαν. */
  readonly created: number;
  /** Segments που παραλείφθηκαν (υπήρχε ήδη grid-managed τοίχος). */
  readonly skipped: number;
}

/**
 * Σταθερό, direction-agnostic κλειδί ταυτότητας ενός grid τοίχου = το ζεύγος των
 * γωνιακών κόμβων (κάθε κόμβος = ζεύγος αξόνων x,y), ταξινομημένο ώστε start↔end
 * αναστροφή να δίνει το ίδιο κλειδί. `null` αν λείπει κάποιο slot (δεν είναι πλήρως
 * grid-managed → την αγνοούμε ως «ελεύθερη»).
 */
function gridWallKey(bindings: readonly GuideBinding[]): string | null {
  const slot: Partial<Record<GuideBinding['slot'], string>> = {};
  for (const b of bindings) slot[b.slot] = b.guideId;
  const sx = slot['start-x'];
  const ex = slot['end-x'];
  const sy = slot['start-y'];
  const ey = slot['end-y'];
  if (!sx || !ex || !sy || !ey) return null;
  return [`${sx},${sy}`, `${ex},${ey}`].sort().join('|');
}

/** Τα κλειδιά των ήδη grid-managed τοίχων της σκηνής (για idempotent skip). */
function existingGridWallKeys(
  getLevelScene: (levelId: string) => SceneModel | null,
  levelId: string,
): Set<string> {
  const keys = new Set<string>();
  for (const w of (getLevelScene(levelId)?.entities ?? []).filter(isWallEntity)) {
    if (!hasGuideBindings(w)) continue;
    const key = gridWallKey(w.guideBindings);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Δημιούργησε τους born-bound τοίχους στα segments του κανάβου. No-op (`up-to-date`)
 * όταν κάθε segment έχει ήδη τοίχο· `insufficient-guides` όταν λείπουν άξονες.
 */
export function commitWallGridFromGuides(
  deps: WallGridCommitDeps,
): WallGridCommitResult {
  // Revit face-to-face: τα άκρα τοίχων σε κολώνα τραβιούνται στην παρειά της (extend).
  const columns = (deps.getLevelScene(deps.levelId)?.entities ?? []).filter(isColumnEntity);
  const target = buildWallGridFromGuides(
    deps.guideReader,
    deps.overrides ?? {},
    deps.levelId,
    deps.sceneUnits,
    columns,
    deps.perimeterMode ?? DEFAULT_GRID_PERIMETER_MODE,
  );
  if (!target.ok) {
    return { ok: false, reason: 'insufficient-guides', created: 0, skipped: 0 };
  }

  const existingKeys = existingGridWallKeys(deps.getLevelScene, deps.levelId);
  const toCreate = target.walls.filter((w) => {
    const key = gridWallKey(w.guideBindings ?? []);
    return key !== null && !existingKeys.has(key);
  });
  const skipped = target.walls.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped };
  }

  const adapter = createLevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(new CreateWallsCommand(toCreate, adapter));
  return { ok: true, created: toCreate.length, skipped };
}
