/**
 * ADR-441 Slice 2 — orchestrator για το one-shot «Εσχάρα πεδιλοδοκών από κάναβο».
 *
 * Γέφυρα ανάμεσα στον pure builder (`buildStripGridFromGuides`) και στο command
 * history: χτίζει τα born-hosted strips από τον κάναβο και τα εκτελεί ως ΕΝΑ
 * atomic `CreateFoundationsCommand` (1 undo). Επιστρέφει summary ώστε ο caller
 * (ribbon bridge) να εκπέμψει το αντίστοιχο toast — μηδέν UI/EventBus εδώ (testable).
 *
 * Mirror της λογικής accept των MEP auto-design bridges (build → LevelSceneManager
 * adapter → execute command), προσαρμοσμένο στο pure-result pattern.
 *
 * @see ./foundation-from-grid.ts — pure grid builder
 * @see ../../core/commands/entity-commands/CreateFoundationsCommand.ts — atomic batch
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateFoundationsCommand } from '../../core/commands/entity-commands/CreateFoundationsCommand';
import {
  buildStripGridFromGuides,
  type AxisGuideReader,
} from './foundation-from-grid';
import type { FoundationParamOverrides, SceneUnits } from '../../hooks/drawing/foundation-completion';

export interface FoundationGridCommitDeps {
  /** Read-surface του κανάβου (guide-store singleton ή test double). */
  readonly guideReader: AxisGuideReader;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Προαιρετικά param overrides (v1: defaults). */
  readonly overrides?: FoundationParamOverrides;
}

export interface FoundationGridCommitResult {
  readonly ok: boolean;
  readonly reason?: 'insufficient-guides' | 'empty';
  readonly built: number;
  readonly ignored: number;
}

/**
 * Χτίσε + commit-άρισε την εσχάρα από τον τρέχοντα κάναβο. Δεν εκτελεί τίποτα αν
 * δεν υπάρχουν ≥2 άξονες ανά διεύθυνση ή αν κανένα segment δεν περάσει validation.
 */
export function commitFoundationGridFromGuides(
  deps: FoundationGridCommitDeps,
): FoundationGridCommitResult {
  const result = buildStripGridFromGuides(
    deps.guideReader,
    deps.overrides ?? {},
    deps.levelId,
    deps.sceneUnits,
  );
  if (!result.ok) {
    return { ok: false, reason: result.reason ?? 'insufficient-guides', built: 0, ignored: 0 };
  }
  if (result.strips.length === 0) {
    return { ok: false, reason: 'empty', built: 0, ignored: result.ignoredCount };
  }
  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(new CreateFoundationsCommand(result.strips, adapter));
  return { ok: true, built: result.strips.length, ignored: result.ignoredCount };
}
