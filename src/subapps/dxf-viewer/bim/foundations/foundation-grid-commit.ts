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
import {
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from './foundation-grid-justification';
import { reconcileGridStrips } from './foundation-grid-reconcile';
import { rehostOrphanStrips, type RehostedStrip } from './foundation-grid-rehost';
import { computeGridJunctionExtends } from './foundation-grid-junctions';
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
  /** ADR-441 — έδραση περιμετρικών λωρίδων (center/inner/outer· default inner). */
  readonly perimeterMode?: GridPerimeterMode;
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
  /**
   * ADR-441 Slice 9 — in-place updates που κράτησαν id: coordinate-follow (η λωρίδα
   * ακολούθησε άξονα που μετακινήθηκε) + auto re-justify (5a-grid αλλαγή ρόλου άξονα).
   */
  readonly reJustified: number;
}

/**
 * Existing grid-managed **πεδιλοδοκοί** της σκηνής (ο reconciler φιλτράρει null
 * signatures). **Kind-partition (ADR-441 Slice GEN-TIE):** μόνο `kind='strip'` — οι
 * συνδετήριες (`tie-beam`) είναι ξεχωριστό overlay (`tie-beam-grid-commit.ts`),
 * συνυπάρχουν στον ίδιο άξονα → ΠΟΤΕ δεν μπαίνουν στο strip reconcile (αλλιώς
 * cross-delete λόγω κοινού segmentKey).
 */
function existingFoundations(
  getLevelScene: (levelId: string) => SceneModel | null,
  levelId: string,
) {
  return (getLevelScene(levelId)?.entities ?? [])
    .filter(isFoundationEntity)
    .filter((e) => e.params.kind === 'strip');
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
  // Kind-partition (ADR-441 Slice GEN-TIE): η «Εσχάρα» ξανα-κρεμά μόνο ορφανές
  // **πεδιλοδοκούς** — οι συνδετήριες έχουν δικό τους grid overlay.
  const orphans = existing.filter(
    (e) => e.params.kind === 'strip' && !hasGuideBindings(e),
  );
  if (orphans.length === 0) return [];
  const xGuides = reader.getGuidesByAxis('X').filter((g) => g.visible);
  const yGuides = reader.getGuidesByAxis('Y').filter((g) => g.visible);
  return rehostOrphanStrips(orphans, target, xGuides, yGuides);
}

/**
 * Χτίσε το atomic command (update + delete + create, ή το μοναδικό μη-κενό). Τα
 * `updates` = rehosts (Slice 6b) + re-justify reflows (Slice 5a-grid) — και τα δύο
 * είναι in-place mutations (params/geometry/bindings) → ίδιο `RehostFoundationsCommand`.
 */
function buildReconcileCommand(
  updates: readonly RehostedStrip[],
  toDelete: readonly FoundationEntity[],
  toCreate: readonly FoundationEntity[],
  adapter: LevelSceneManagerAdapter,
): ICommand {
  const cmds: ICommand[] = [];
  if (updates.length > 0) cmds.push(new RehostFoundationsCommand(updates, adapter));
  if (toDelete.length > 0) cmds.push(new DeleteFoundationsCommand(toDelete, adapter));
  if (toCreate.length > 0) cmds.push(new CreateFoundationsCommand(toCreate, adapter));
  return cmds.length === 1 ? cmds[0] : new CompoundCommand('Reconcile foundation grid', cmds);
}

/**
 * Τελικό σύνολο strips μετά το reconcile (rehosts ήδη folded στο existingForReconcile,
 * reflows εφαρμοσμένα, deletes αφαιρεμένα, creates προστεθειμένα) — input για το
 * junction-miter post-pass (ADR-441 Slice 8).
 */
function buildFinalStripSet(
  existingForReconcile: readonly FoundationEntity[],
  reflowUpdates: readonly RehostedStrip[],
  toDelete: readonly FoundationEntity[],
  toCreate: readonly FoundationEntity[],
): FoundationEntity[] {
  const reflowById = new Map(reflowUpdates.map((r) => [r.rehosted.id, r.rehosted]));
  const deletedIds = new Set(toDelete.map((d) => d.id));
  const surviving = existingForReconcile
    .filter((e) => !deletedIds.has(e.id))
    .map((e) => reflowById.get(e.id) ?? e);
  return [...surviving, ...toCreate];
}

/**
 * Fold των junction-miter extends (ADR-441 Slice 8) μέσα στα reflow/rehost updates και
 * στα creates → ΕΝΑ atomic command (1 undo): τα created παίρνουν miter απευθείας, τα
 * ήδη-updated αντικαθίστανται με τη miter εκδοχή, τα μόνο-miter μπαίνουν ως νέα updates.
 */
function foldJunctions(
  junctions: readonly RehostedStrip[],
  baseUpdates: readonly RehostedStrip[],
  toCreate: readonly FoundationEntity[],
): { readonly updates: RehostedStrip[]; readonly create: FoundationEntity[] } {
  const jById = new Map(junctions.map((j) => [j.rehosted.id, j.rehosted]));
  const create = toCreate.map((c) => jById.get(c.id) ?? c);
  const baseIds = new Set(baseUpdates.map((u) => u.rehosted.id));
  const createIds = new Set(toCreate.map((c) => c.id));
  const merged = baseUpdates.map((u) => {
    const j = jById.get(u.rehosted.id);
    return j ? { original: u.original, rehosted: j } : u;
  });
  const jonly = junctions.filter((j) => !baseIds.has(j.rehosted.id) && !createIds.has(j.rehosted.id));
  return { updates: [...merged, ...jonly], create };
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
    deps.perimeterMode ?? DEFAULT_GRID_PERIMETER_MODE,
  );
  if (!target.ok) {
    return { ok: false, reason: target.reason ?? 'insufficient-guides', created: 0, deleted: 0, unchanged: 0, rehosted: 0, reJustified: 0 };
  }

  const existing = existingFoundations(deps.getLevelScene, deps.levelId);

  // ADR-441 Slice 6b — re-host ορφανών ΠΡΙΝ το reconcile: ο rehosted υιοθετεί το
  // signature του target φατνώματος → ο reconciler τον βλέπει ως `unchanged`
  // (μηδέν διπλοί/διαγραφή). Fold-in στο existing ώστε να μετρηθεί ως grid-managed.
  const rehosts = computeRehosts(existing, target.strips, deps.guideReader);
  const rehostedById = new Map(rehosts.map((r) => [r.rehosted.id, r.rehosted]));
  const existingForReconcile = existing.map((e) => rehostedById.get(e.id) ?? e);

  const { toCreate, toDelete, toUpdate, unchanged } = reconcileGridStrips(target.strips, existingForReconcile);

  // ADR-441 Slice 9 — managed updates: coordinate-follow (η λωρίδα ακολουθεί τον άξονα
  // που κουνήθηκε, κρατά id + instance overrides) + auto re-justify (5a-grid, αλλαγή
  // ρόλου άξονα). Και τα δύο είναι in-place RehostedStrip → ίδιο command με τα rehosts.
  const reflowUpdates: readonly RehostedStrip[] = toUpdate;

  // ADR-441 Slice 8 — auto-junction-join: post-pass πάνω στο τελικό σύνολο (με τις
  // πραγματικές εδράσεις) → miter extends ώστε κάθε γωνία/κόμβος να κλείνει για όποια
  // έδραση. Folded στο ίδιο atomic command (1 undo). Inward → μηδέν extend (no-op).
  const finalSet = buildFinalStripSet(existingForReconcile, reflowUpdates, toDelete, toCreate);
  const junctions = computeGridJunctionExtends(finalSet);
  const { updates, create } = foldJunctions(junctions, [...rehosts, ...reflowUpdates], toCreate);

  if (create.length === 0 && toDelete.length === 0 && updates.length === 0) {
    // Idempotent re-run: η εσχάρα είναι ήδη σε συμφωνία με τον κάναβο.
    const reason = unchanged > 0 ? 'up-to-date' : 'empty';
    return { ok: false, reason, created: 0, deleted: 0, unchanged, rehosted: 0, reJustified: 0 };
  }

  const adapter = new LevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(buildReconcileCommand(updates, toDelete, create, adapter));
  return {
    ok: true,
    created: toCreate.length,
    deleted: toDelete.length,
    unchanged,
    rehosted: rehosts.length,
    reJustified: toUpdate.length,
  };
}
