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
import { RehostFoundationsCommand } from '../../core/commands/entity-commands/RehostFoundationsCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import {
  buildStripGridFromGuides,
  type AxisGuideReader,
} from './foundation-from-grid';
import { reconcileGridStrips } from './foundation-grid-reconcile';
import { rehostOrphanStrips, type RehostedStrip } from './foundation-grid-rehost';
import { hasGuideBindings } from '../hosting/guide-binding-types';
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
  /** ADR-441 Slice 6b — legacy ορφανές που ξανα-κρεμάστηκαν στον κάναβο. */
  readonly rehosted: number;
}

/** Existing grid-managed λωρίδες της σκηνής (ο reconciler φιλτράρει null signatures). */
function existingFoundations(
  getLevelScene: (levelId: string) => SceneModel | null,
  levelId: string,
) {
  return (getLevelScene(levelId)?.entities ?? []).filter(isFoundationEntity);
}

/**
 * ADR-441 Slice 6b — ξανα-κρέμα τους legacy ορφανούς (γραμμικοί χωρίς bindings) στα
 * target φατνώματα. Επιστρέφει τα re-hosts ώστε ο orchestrator (α) να τα εφαρμόσει
 * ως command και (β) να τα «δείξει» στον reconciler ως grid-managed (μηδέν διπλοί).
 */
function computeRehosts(
  existing: readonly FoundationEntity[],
  target: readonly FoundationEntity[],
  reader: AxisGuideReader,
): RehostedStrip[] {
  const orphans = existing.filter(
    (e) => (e.params.kind === 'strip' || e.params.kind === 'tie-beam') && !hasGuideBindings(e),
  );
  if (orphans.length === 0) return [];
  const xGuides = reader.getGuidesByAxis('X').filter((g) => g.visible);
  const yGuides = reader.getGuidesByAxis('Y').filter((g) => g.visible);
  return rehostOrphanStrips(orphans, target, xGuides, yGuides);
}

/** Χτίσε το atomic command (rehost + delete + create, ή το μοναδικό μη-κενό). */
function buildReconcileCommand(
  rehosts: readonly RehostedStrip[],
  toDelete: readonly FoundationEntity[],
  toCreate: readonly FoundationEntity[],
  adapter: LevelSceneManagerAdapter,
): ICommand {
  const cmds: ICommand[] = [];
  if (rehosts.length > 0) cmds.push(new RehostFoundationsCommand(rehosts, adapter));
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
    return { ok: false, reason: target.reason ?? 'insufficient-guides', created: 0, deleted: 0, unchanged: 0, rehosted: 0 };
  }

  const existing = existingFoundations(deps.getLevelScene, deps.levelId);

  // ADR-441 Slice 6b — re-host ορφανών ΠΡΙΝ το reconcile: ο rehosted υιοθετεί το
  // signature του target φατνώματος → ο reconciler τον βλέπει ως `unchanged`
  // (μηδέν διπλοί/διαγραφή). Fold-in στο existing ώστε να μετρηθεί ως grid-managed.
  const rehosts = computeRehosts(existing, target.strips, deps.guideReader);
  const rehostedById = new Map(rehosts.map((r) => [r.rehosted.id, r.rehosted]));
  const existingForReconcile = existing.map((e) => rehostedById.get(e.id) ?? e);

  const { toCreate, toDelete, unchanged } = reconcileGridStrips(target.strips, existingForReconcile);

  if (toCreate.length === 0 && toDelete.length === 0 && rehosts.length === 0) {
    // Idempotent re-run: η εσχάρα είναι ήδη σε συμφωνία με τον κάναβο.
    const reason = unchanged > 0 ? 'up-to-date' : 'empty';
    return { ok: false, reason, created: 0, deleted: 0, unchanged, rehosted: 0 };
  }

  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(buildReconcileCommand(rehosts, toDelete, toCreate, adapter));
  return { ok: true, created: toCreate.length, deleted: toDelete.length, unchanged, rehosted: rehosts.length };
}
