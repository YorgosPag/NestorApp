/**
 * ADR-441 Slice GEN-COL — orchestrator για το «Κολώνες από κάναβο».
 *
 * Γέφυρα ανάμεσα στον pure builder (`buildColumnGridFromGuides`) και στο command
 * history. **Idempotent create** (Revit «Column → At Grids», ξανα-πάτημα = no-op):
 * χτίζει το target (μία born-bound κολώνα ανά τομή), παραλείπει τις τομές όπου ήδη
 * υπάρχει grid-managed κολώνα (ίδιο ζεύγος `center-x`/`center-y` guide ids), και
 * δημιουργεί μόνο τις missing σε ΕΝΑ atomic step (1 undo).
 *
 * v1 scope: create-only. Το follow-on-move δουλεύει ήδη μέσω του hosting reconciler
 * (ADR-441 Slice COL). Full reconcile/delete-obsolete = DEFER.
 *
 * @see ./column-from-grid.ts — pure grid builder (target)
 * @see ../../core/commands/entity-commands/CreateColumnsCommand.ts — batch create
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateColumnsCommand } from '../../core/commands/entity-commands/CreateColumnsCommand';
import { isColumnEntity } from '../../types/entities';
import { hasGuideBindings, type GuideBinding } from '../hosting/guide-binding-types';
import type { AxisGuideReader } from '../foundations/foundation-from-grid';
import { sceneFoundationTopMm } from '../foundations/foundation-level';
import type { ColumnParamOverrides } from '../../hooks/drawing/column-completion';
import type { SceneUnits } from '../../utils/scene-units';
import {
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from '../grid/grid-justification';
import { buildColumnGridFromGuides } from './column-from-grid';

export interface ColumnGridCommitDeps {
  /** Read-surface του κανάβου (guide-store singleton ή test double). */
  readonly guideReader: AxisGuideReader;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Προαιρετικά param overrides (v1: defaults). */
  readonly overrides?: ColumnParamOverrides;
  /** ADR-441 3-mode — περιμετρική έδραση (center/inner/outer → anchor)· default `inner`. */
  readonly perimeterMode?: GridPerimeterMode;
}

export interface ColumnGridCommitResult {
  readonly ok: boolean;
  readonly reason?: 'insufficient-guides' | 'up-to-date';
  /** Νέες κολώνες που δημιουργήθηκαν. */
  readonly created: number;
  /** Τομές που παραλείφθηκαν (υπήρχε ήδη grid-managed κολώνα). */
  readonly skipped: number;
}

/**
 * Σταθερό κλειδί ταυτότητας μιας grid κολώνας = το ζεύγος των αξόνων στους οποίους
 * είναι δεμένη (`center-x`|`center-y`). `null` αν δεν είναι πλήρως grid-managed
 * (λείπει κάποιο center binding → την αγνοούμε ως «ελεύθερη»).
 */
function gridColumnKey(bindings: readonly GuideBinding[]): string | null {
  let cx: string | undefined;
  let cy: string | undefined;
  for (const b of bindings) {
    if (b.slot === 'center-x') cx = b.guideId;
    else if (b.slot === 'center-y') cy = b.guideId;
  }
  return cx && cy ? `${cx}|${cy}` : null;
}

/** Τα κλειδιά των ήδη grid-managed κολωνών της σκηνής (για idempotent skip). */
function existingGridColumnKeys(
  getLevelScene: (levelId: string) => SceneModel | null,
  levelId: string,
): Set<string> {
  const keys = new Set<string>();
  for (const c of (getLevelScene(levelId)?.entities ?? []).filter(isColumnEntity)) {
    if (!hasGuideBindings(c)) continue;
    const key = gridColumnKey(c.guideBindings);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Δημιούργησε τις born-bound κολώνες στις τομές του κανάβου. No-op (`up-to-date`)
 * όταν κάθε τομή έχει ήδη κολώνα· `insufficient-guides` όταν λείπουν άξονες.
 */
export function commitColumnGridFromGuides(
  deps: ColumnGridCommitDeps,
): ColumnGridCommitResult {
  // ADR-441 GEN-COL — στατική συνέχεια: αν υπάρχουν footings (πεδιλοδοκοί/πέδιλα) στη
  // σκηνή, οι κολώνες κατεβάζουν τη βάση τους στη στάθμη θεμελίωσης (πατούν επ' αυτών).
  const entities = deps.getLevelScene(deps.levelId)?.entities ?? [];
  const foundationBaseLevelMm = sceneFoundationTopMm(entities) ?? undefined;
  const target = buildColumnGridFromGuides(
    deps.guideReader,
    deps.overrides ?? {},
    deps.levelId,
    deps.sceneUnits,
    foundationBaseLevelMm,
    deps.perimeterMode ?? DEFAULT_GRID_PERIMETER_MODE,
  );
  if (!target.ok) {
    return { ok: false, reason: 'insufficient-guides', created: 0, skipped: 0 };
  }

  const existingKeys = existingGridColumnKeys(deps.getLevelScene, deps.levelId);
  const toCreate = target.columns.filter((c) => {
    const key = gridColumnKey(c.guideBindings ?? []);
    return key !== null && !existingKeys.has(key);
  });
  const skipped = target.columns.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped };
  }

  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(new CreateColumnsCommand(toCreate, adapter));
  return { ok: true, created: toCreate.length, skipped };
}
