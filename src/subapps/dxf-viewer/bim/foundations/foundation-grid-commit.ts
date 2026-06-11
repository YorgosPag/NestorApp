/**
 * ADR-441 Slice 2+6 — orchestrator για το «Εσχάρα πεδιλοδοκών από κάναβο».
 *
 * Γέφυρα ανάμεσα στον pure builder (`buildStripGridFromGuides`) και στο command
 * history. **Slice 6 (managed reconcile):** αντί τυφλής δημιουργίας, κάνει
 * signature-set diff του target (πλήρης σωστή εσχάρα για τον τρέχοντα κάναβο) με
 * τις existing grid-managed λωρίδες → δημιουργεί μόνο τα missing, διαγράφει τα
 * obsolete (split-superseded / stale corner-fill), αφήνει αμετάβλητες τις ίδιες.
 * Όλο το delta = ΕΝΑ atomic step (1 undo, Revit transaction).
 *
 * @see ./foundation-from-grid.ts — pure grid builder (target)
 * @see ./foundation-grid-reconcile.ts — signature-set diff
 * @see ../../core/commands/entity-commands/CreateFoundationsCommand.ts — batch create
 * @see ../../core/commands/entity-commands/DeleteFoundationsCommand.ts — batch delete
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateFoundationsCommand } from '../../core/commands/entity-commands/CreateFoundationsCommand';
import { DeleteFoundationsCommand } from '../../core/commands/entity-commands/DeleteFoundationsCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import {
  buildStripGridFromGuides,
  type AxisGuideReader,
} from './foundation-from-grid';
import { reconcileGridStrips } from './foundation-grid-reconcile';
import { isFoundationEntity } from '../../types/entities';
import type { FoundationEntity } from '../types/foundation-types';
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
  readonly reason?: 'insufficient-guides' | 'empty' | 'up-to-date';
  /** Νέες λωρίδες που δημιουργήθηκαν. */
  readonly created: number;
  /** Obsolete λωρίδες που διαγράφηκαν (split / stale corner-fill). */
  readonly deleted: number;
  /** Λωρίδες αμετάβλητες (signature σε target & existing). */
  readonly unchanged: number;
}

/** Existing grid-managed λωρίδες της σκηνής (ο reconciler φιλτράρει null signatures). */
function existingFoundations(
  getLevelScene: (levelId: string) => SceneModel | null,
  levelId: string,
) {
  return (getLevelScene(levelId)?.entities ?? []).filter(isFoundationEntity);
}

/** Χτίσε το atomic reconcile command (delete + create, ή το μοναδικό μη-κενό). */
function buildReconcileCommand(
  toDelete: readonly FoundationEntity[],
  toCreate: readonly FoundationEntity[],
  adapter: LevelSceneManagerAdapter,
): ICommand {
  const cmds: ICommand[] = [];
  if (toDelete.length > 0) cmds.push(new DeleteFoundationsCommand(toDelete, adapter));
  if (toCreate.length > 0) cmds.push(new CreateFoundationsCommand(toCreate, adapter));
  return cmds.length === 1 ? cmds[0] : new CompoundCommand('Reconcile foundation grid', cmds);
}

/**
 * Reconcile-άρισε την εσχάρα με τον τρέχοντα κάναβο. No-op (`up-to-date`) όταν δεν
 * υπάρχει delta· `insufficient-guides` όταν λείπουν άξονες.
 */
export function commitFoundationGridFromGuides(
  deps: FoundationGridCommitDeps,
): FoundationGridCommitResult {
  const target = buildStripGridFromGuides(
    deps.guideReader,
    deps.overrides ?? {},
    deps.levelId,
    deps.sceneUnits,
  );
  if (!target.ok) {
    return { ok: false, reason: target.reason ?? 'insufficient-guides', created: 0, deleted: 0, unchanged: 0 };
  }

  const existing = existingFoundations(deps.getLevelScene, deps.levelId);
  const { toCreate, toDelete, unchanged } = reconcileGridStrips(target.strips, existing);

  if (toCreate.length === 0 && toDelete.length === 0) {
    // Idempotent re-run: η εσχάρα είναι ήδη σε συμφωνία με τον κάναβο.
    const reason = unchanged > 0 ? 'up-to-date' : 'empty';
    return { ok: false, reason, created: 0, deleted: 0, unchanged };
  }

  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(buildReconcileCommand(toDelete, toCreate, adapter));
  return { ok: true, created: toCreate.length, deleted: toDelete.length, unchanged };
}
