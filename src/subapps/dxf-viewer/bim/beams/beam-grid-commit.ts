/**
 * ADR-441 Slice GEN-BEAM — orchestrator για το «Δοκάρια από κάναβο».
 *
 * Γέφυρα ανάμεσα στον pure builder (`buildBeamGridFromGuides`) και στο command
 * history. **Idempotent create** (ξανα-πάτημα = no-op): χτίζει το target (μία
 * born-bound δοκό ανά segment άξονα), παραλείπει τα segments όπου ήδη υπάρχει
 * grid-managed δοκός (ίδιο segment key από τα bindings), και δημιουργεί μόνο τα
 * missing σε ΕΝΑ atomic step (1 undo).
 *
 * v1 scope: create-only, ΧΩΡΙΣ auto-miter στις τομές (Revit frame-into). Το
 * follow-on-move δουλεύει ήδη μέσω του `beamHostingStrategy`. Beam-join + beam↔column
 * trim = DEFER.
 *
 * SSoT idempotent key: `segmentKeyFromBindings` (foundation-grid-segments) — γενικό
 * για ΟΛΑ τα γραμμικά grid bindings (το ίδιο κλειδί χρησιμοποιούν συνδετήριες), μηδέν
 * coordinate dependency → direction-agnostic skip.
 *
 * @see ./beam-from-grid.ts — pure grid builder (target)
 * @see ../foundations/foundation-grid-segments.ts — segmentKeyFromBindings (SSoT key)
 * @see ../../core/commands/entity-commands/CreateBeamsCommand.ts — batch create
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateBeamsCommand } from '../../core/commands/entity-commands/CreateBeamsCommand';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import { hasGuideBindings } from '../hosting/guide-binding-types';
import type { AxisGuideReader } from '../foundations/foundation-from-grid';
import { segmentKeyFromBindings } from '../foundations/foundation-grid-segments';
import type { BeamParamOverrides } from '../../hooks/drawing/beam-completion';
import type { SceneUnits } from '../../utils/scene-units';
import {
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from '../grid/grid-justification';
import { buildBeamGridFromGuides } from './beam-from-grid';

export interface BeamGridCommitDeps {
  /** Read-surface του κανάβου (guide-store singleton ή test double). */
  readonly guideReader: AxisGuideReader;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Προαιρετικά param overrides (v1: defaults). */
  readonly overrides?: BeamParamOverrides;
  /** ADR-441 3-mode — περιμετρική έδραση (center/inner/outer)· default `inner`. */
  readonly perimeterMode?: GridPerimeterMode;
}

export interface BeamGridCommitResult {
  readonly ok: boolean;
  readonly reason?: 'insufficient-guides' | 'up-to-date';
  /** Νέες δοκοί που δημιουργήθηκαν. */
  readonly created: number;
  /** Segments που παραλείφθηκαν (υπήρχε ήδη grid-managed δοκός). */
  readonly skipped: number;
}

/** Τα segment-keys των ήδη grid-managed δοκαριών της σκηνής (idempotent skip). */
function existingGridBeamKeys(
  getLevelScene: (levelId: string) => SceneModel | null,
  levelId: string,
): Set<string> {
  const keys = new Set<string>();
  for (const b of (getLevelScene(levelId)?.entities ?? []).filter(isBeamEntity)) {
    if (!hasGuideBindings(b)) continue;
    const key = segmentKeyFromBindings(b.guideBindings);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Δημιούργησε τις born-bound δοκούς στα segments του κανάβου. No-op (`up-to-date`)
 * όταν κάθε segment έχει ήδη δοκό· `insufficient-guides` όταν λείπουν άξονες.
 */
export function commitBeamGridFromGuides(
  deps: BeamGridCommitDeps,
): BeamGridCommitResult {
  // Revit frame-into: τα άκρα δοκαριών σε κολώνα τραβιούνται στην παρειά της (extend).
  const columns = (deps.getLevelScene(deps.levelId)?.entities ?? []).filter(isColumnEntity);
  const target = buildBeamGridFromGuides(
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

  const existingKeys = existingGridBeamKeys(deps.getLevelScene, deps.levelId);
  const toCreate = target.beams.filter((b) => {
    const key = segmentKeyFromBindings(b.guideBindings ?? []);
    return key !== null && !existingKeys.has(key);
  });
  const skipped = target.beams.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped };
  }

  const adapter = createLevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(new CreateBeamsCommand(toCreate, adapter));
  return { ok: true, created: toCreate.length, skipped };
}
