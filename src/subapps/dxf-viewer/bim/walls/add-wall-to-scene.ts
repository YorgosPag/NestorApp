/**
 * ADR-363 Phase 1G.4 / ADR-911 Φ2 — SSoT for inserting freshly-built `WallEntity`s into the
 * active level scene: no-overlap guard, ONE neighbour-join pass, ONE undo step, persistence
 * broadcast.
 *
 * ΜΙΑ ρουτίνα εισαγωγής για όλους: το εργαλείο σχεδίασης, το Ctrl-COPY hot-grip, η πλήρωση
 * περιοχής/περιγράμματος και ο βοηθός «Μοντέλο από το σχέδιο». Ο μονός τοίχος
 * ({@link addWallToScene}) είναι η παρτίδα του ενός ({@link addWallsToScene}) — όχι δεύτερη
 * υλοποίηση.
 *
 * ADR-911 Φ2 — τι άλλαξε και γιατί (πριν: γυμνό `setLevelScene` ανά τοίχο):
 *   · **Αναιρέσιμο.** Η εγγραφή περνά από το command history (`CreateWallsCommand` +
 *     `RetrimWallsCommand` σε ΜΙΑ ατομική ομάδα). Πριν, ένας σχεδιασμένος τοίχος ΔΕΝ έμπαινε
 *     ποτέ στο ιστορικό — το Ctrl+Z δεν τον αφαιρούσε.
 *   · **Ένα πέρασμα ενώσεων.** `computeWallTrims` τρέχει ΜΙΑ φορά για όλη την παρτίδα (Revit:
 *     οι ενώσεις αναγεννώνται στο commit της συναλλαγής, όχι ανά στοιχείο). Πριν, Ν τοίχοι =
 *     Ν πλήρη περάσματα + επανεκπομπή κάθε γείτονα σε κάθε πέρασμα.
 *   · **Οι ενώσεις ψήνονται ΠΡΙΝ την εντολή**, άρα το στιγμιότυπο που αποθηκεύεται πρώτη φορά
 *     φέρει ήδη τα σωστά params (ίδια εγγύηση με το παλιό «broadcast the trim-patched entity»).
 *
 * The `drawing:entity-created` broadcast is REQUIRED, not optional: it is the trigger
 * `useWallPersistence` waits on to schedule the first Firestore save. It now fires in a
 * microtask (after `CommandHistory.execute` returns — mirror of `CreateBimEntityCommand`), so a
 * structural reaction that calls `history.appendToLast` groups WITH this creation.
 *
 * @see hooks/tools/useSpecialTools.ts — DRAW callers (single + batch)
 * @see hooks/grips/grip-parametric-copy.ts — COPY caller (commitWallCopy)
 * @see core/commands/entity-commands/CreateWallsCommand.ts — the undoable create
 * @see core/commands/entity-commands/RetrimWallsCommand.ts — the undoable neighbour patch
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §Φ2
 */
import { EventBus } from '../../systems/events/EventBus';
import type { EntityCreatedOrigin } from '../../systems/events/drawing-event-map';
import type { SceneModel } from '../../types/scene';
import type { AnySceneEntity, Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallEntity, WallParams } from '../types/wall-types';
import {
  computeWallTrims,
  applyTrimPatches,
  collectColumnFootprints,
  wallTrimChanged,
  type WallTrimFields,
} from './wall-trims';
import { retrimWallEntities } from './wall-retrim';
import { partitionByStructuralOverlap } from '../placement/structural-placement-overlap';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { CreateWallsCommand } from '../../core/commands/entity-commands/CreateWallsCommand';
import { RetrimWallsCommand, type WallRetrimEntry } from '../../core/commands/entity-commands/RetrimWallsCommand';

/**
 * Minimal level-scene accessor — structurally satisfied by both
 * `LevelsHookReturn` (draw tool) and `DxfCommitDeps` (grip commit), so neither
 * caller needs an adapter.
 */
export interface WallSceneAccessor {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** Τι γίνεται όταν μέλος της παρτίδας θα καθόταν πάνω σε υπάρχουσα δομική (ADR-567). */
export type WallOverlapPolicy = 'skip' | 'refuse';

export interface AddWallsOptions {
  /**
   * Το `origin` των εκπομπών δημιουργίας. Απόν / `'create'` = μεμονωμένες δημιουργίες (οι
   * ανά-οντότητα ανιχνευτές αντιδρούν). `'bulk'` = εγκεκριμένη παρτίδα βοηθού (σιωπούν).
   */
  readonly origin?: Extract<EntityCreatedOrigin, 'create' | 'bulk'>;
  /**
   * `'skip'` (default) — τα κομμένα μέλη παραλείπονται, τα υπόλοιπα γράφονται (η ιστορική
   * ανά-τοίχο συμπεριφορά). `'refuse'` — αν κοπεί ΕΣΤΩ ΕΝΑ, δεν γράφεται ΤΙΠΟΤΑ: για εγγραφή
   * που ο άνθρωπος ενέκρινε ως σύνολο (προεπισκόπηση ≡ αποτέλεσμα), η μερική εγγραφή είναι ψέμα.
   */
  readonly onOverlap?: WallOverlapPolicy;
  /** Η περιγραφή της εγγραφής στο ιστορικό αναίρεσης. */
  readonly undoName?: string;
}

/** Γιατί δεν γράφτηκε τίποτα. */
export type AddWallsRefusal = 'no-active-scene' | 'nothing-to-write' | 'overlap';

export interface AddWallsResult {
  /** Οι τοίχοι ΟΠΩΣ γράφτηκαν (με ψημένες ενώσεις), στη σειρά εισόδου. Κενό σε άρνηση. */
  readonly written: readonly WallEntity[];
  /** Πόσα μέλη κόπηκαν από τον έλεγχο ADR-567. */
  readonly blocked: number;
  /** Πόσοι ΥΠΑΡΧΟΝΤΕΣ τοίχοι άλλαξαν ένωση. */
  readonly retrimmedNeighbours: number;
  /** Παρόν ⇔ δεν γράφτηκε τίποτα. */
  readonly refusal?: AddWallsRefusal;
}

const DEFAULT_UNDO_NAME = 'Δημιουργία τοίχων';

function refused(refusal: AddWallsRefusal, blocked = 0): AddWallsResult {
  return { written: [], blocked, retrimmedNeighbours: 0, refusal };
}

/** Τα τέσσερα πεδία ένωσης ενός τοίχου, ως ανεξάρτητο στιγμιότυπο. */
function trimFieldsOf(params: WallParams): WallTrimFields {
  return {
    startMiter: params.startMiter,
    endMiter: params.endMiter,
    startBevel: params.startBevel,
    endBevel: params.endBevel,
  };
}

/**
 * Το ΕΝΑ πέρασμα ενώσεων της παρτίδας: οι νέοι τοίχοι με ψημένη ένωση (σειρά εισόδου) + οι
 * υπάρχοντες γείτονες των οποίων η ένωση ΑΛΛΑΞΕ (όχι «έχουν patch» — ο γείτονας που είχε ήδη
 * την ίδια ένωση δεν ξαναγράφεται ούτε ξαναεκπέμπεται). Καθαρός υπολογισμός.
 */
function planWallBatch(
  existing: readonly AnySceneEntity[],
  accepted: readonly WallEntity[],
): { walls: WallEntity[]; neighbours: WallRetrimEntry[] } {
  // Include the new walls BEFORE computing trims so neighbours are also patched.
  const entitiesWithNew = [...existing, ...accepted];
  const trims = computeWallTrims(entitiesWithNew.filter(isWallEntity), collectColumnFootprints(entitiesWithNew));
  const patchedById = new Map<string, WallEntity>();
  for (const e of applyTrimPatches(entitiesWithNew, trims)) {
    if (isWallEntity(e)) patchedById.set(e.id, e);
  }
  const neighbours: WallRetrimEntry[] = [];
  for (const e of existing) {
    if (!isWallEntity(e) || !trims.has(e.id)) continue;
    const next = patchedById.get(e.id)?.params;
    if (!next || !wallTrimChanged(e.params, next)) continue;
    neighbours.push({ entityId: e.id, prev: e.params, next, kind: e.kind });
  }
  return { walls: accepted.map((w) => patchedById.get(w.id) ?? w), neighbours };
}

/**
 * Γράφει ΜΙΑ παρτίδα τοίχων στην ενεργή σκηνή: έλεγχος ADR-567 → ένα πέρασμα ενώσεων → μία
 * εγγραφή ιστορικού (δημιουργία + ενώσεις γειτόνων) → εκπομπές persistence. Οι τοίχοι γράφονται
 * ΑΥΤΟΥΣΙΟΙ εκτός από τα τέσσερα πεδία ένωσης — καμία άλλη μεταβολή (ADR-911 Α-3).
 */
export function addWallsToScene(
  walls: readonly WallEntity[],
  accessor: WallSceneAccessor,
  options: AddWallsOptions = {},
): AddWallsResult {
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  if (!levelId || !scene) return refused('no-active-scene');
  const existing = scene.entities ?? [];

  // ADR-567 — ΠΟΤΕ τοίχος πάνω σε υπάρχουσα δομική οντότητα (ουσιαστική επικάλυψη εμβαδού).
  // Γωνίες/ενώσεις/διασταυρώσεις (κοινή παρειά ή μικρό τετράγωνο) περνούν (ratio < κατώφλι).
  const { accepted, blocked, firstBlockedById } = partitionByStructuralOverlap(
    walls,
    existing as unknown as Entity[],
  );
  if (blocked > 0 && firstBlockedById) {
    EventBus.emit('bim:placement-blocked', { entityType: 'wall', blockedById: firstBlockedById, count: blocked });
  }
  if (blocked > 0 && options.onOverlap === 'refuse') return refused('overlap', blocked);
  if (accepted.length === 0) return refused('nothing-to-write', blocked);

  const plan = planWallBatch(existing, accepted);
  // ADR-527: shared singleton adapter per (accessor, level) — not a fresh `new` per call.
  const adapter = createLevelSceneManagerAdapter(accessor.getLevelScene, accessor.setLevelScene, levelId);
  const history = getGlobalCommandHistory();
  history.runAsSingleUndo(options.undoName ?? DEFAULT_UNDO_NAME, () => {
    history.execute(new CreateWallsCommand(plan.walls, adapter, { origin: options.origin }));
    if (plan.neighbours.length > 0) history.execute(new RetrimWallsCommand(plan.neighbours, adapter));
  });
  return { written: plan.walls, blocked, retrimmedNeighbours: plan.neighbours.length };
}

/**
 * Append ONE `wallEntity` to the active level scene — the batch of one. Same guard, same
 * join pass, same undo step, same broadcasts as {@link addWallsToScene}. No-op when there is
 * no active level / scene, or when the wall would sit on an existing structural entity.
 */
export function addWallToScene(wallEntity: WallEntity, accessor: WallSceneAccessor): void {
  addWallsToScene([wallEntity], accessor, { undoName: 'Δημιουργία τοίχου' });
}

/**
 * SSoT idempotent wall-junction recompute (ADR-363 Phase 1E / 1L-J). Strips ALL
 * existing trim data (`startMiter`/`endMiter`/`startBevel`/`endBevel`) from every
 * wall, recomputes from current geometry + explicit join overrides, applies the
 * fresh patches, and emits `drawing:entity-created` for each wall whose params
 * changed so `useWallPersistence` saves the corrected state to Firestore.
 *
 * The strip-first design makes the result a pure function of current geometry +
 * overrides — so a wall that NO LONGER mitres (deleted neighbour, or a join
 * override switched to `butt`/`disallow`) has its stale miter cleared instead of
 * frozen (the `applyTrimPatches`-only overlay never clears, it only adds).
 *
 * Shared by:
 *   - `recomputeWallTrimsAfterDelete` (after a wall is removed)
 *   - `useWallRetrimEffect` (after a grip commit or a join-override change)
 */
export function recomputeWallTrims(accessor: WallSceneAccessor): void {
  const levelId = accessor.currentLevelId;
  if (!levelId) return;
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return;

  // Snapshot of trim-field values BEFORE recompute so we can detect changes.
  const prevTrimById = new Map<string, WallTrimFields>();
  for (const e of scene.entities) {
    if (isWallEntity(e)) prevTrimById.set(e.id, trimFieldsOf(e.params));
  }

  const patchedEntities = retrimWallEntities(scene.entities);
  accessor.setLevelScene(levelId, { ...scene, entities: patchedEntities });

  // Emit for every wall whose trim params changed (gained, lost, or different).
  for (const entity of patchedEntities) {
    if (!isWallEntity(entity)) continue;
    const prev = prevTrimById.get(entity.id);
    if (!prev || !wallTrimChanged(prev, entity.params)) continue;
    // ADR-533 — retrim persistence re-save (strip→recompute→apply), ΟΧΙ νέος τοίχος.
    // `origin:'retrim'` κρατά τον opening-detector σιωπηλό όταν ένα move/rotate
    // (ακόμη και άσχετης γραμμής) πυροδοτεί wall-retrim μέσω `bim:entities-moved`.
    EventBus.emit('drawing:entity-created', { entity, tool: 'wall', origin: 'retrim' });
  }
}

/**
 * Recompute wall trims after one wall is deleted. Thin alias over the SSoT
 * {@link recomputeWallTrims} — kept as a named entry point for the delete caller.
 * Must be called AFTER the deleted wall has been removed from the scene.
 *
 * @see hooks/data/useWallPersistence.ts — deleteWall caller
 */
export function recomputeWallTrimsAfterDelete(accessor: WallSceneAccessor): void {
  recomputeWallTrims(accessor);
}
