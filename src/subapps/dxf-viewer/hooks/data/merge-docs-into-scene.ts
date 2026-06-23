/**
 * Generic Firestore-snapshot → scene diff-merge SSoT (ADR-390 / ADR-397).
 *
 * Πριν, ΚΑΘΕ per-entity persistence hook (column/wall/opening/hatch/beam/mep/…) είχε
 * το ΙΔΙΟ διφφ-merge loop **copy-pasted** (selective-skip dirty/pending/grace,
 * add/update/drop, ADR-397 baseline seed, `'remote-echo'` write). Πλέον ζει **ΜΙΑ
 * φορά** εδώ, παραμετροποιημένο με pure callbacks. Tier-1 entities (params-only) χρειάζονται
 * μόνο τα 4 βασικά callbacks· τα optional callbacks απορροφούν τις αποκλίσεις:
 *   - **Tier 2 (type-resolution wall/slab/roof/opening):** `differs` (reuse των
 *     `*EntityDiffersFromDoc` helpers — «type always wins») + `seedExtraBaseline`
 *     (δεύτερο family-type baseline map) + `docToEntity → null` (ADR-440 host-wall
 *     lookup μέσω `prepareContext`).
 *   - **Tier 3 (MEP connector projection, ADR-408):** `docToEntity(doc, existing)`
 *     project-άρει το live `systemIds` πάνω στο fresh doc-entity· `differs` συγκρίνει
 *     το projected candidate (anti-ping-pong).
 *   - **Tier 4 (MepSegment):** `shouldDropOrphan` κρατά un-persisted DXF segments.
 *
 * Συμπεριφορά (byte-equivalent με τα πρώην inline loops):
 *   1. partition του scene σε «δικά μου» entities (`isEntity`) + others.
 *   2. ανά doc: skip αν tombstoned· add αν λείπει & όχι dirty· keep local αν
 *      dirty/grace· replace αν `differs` (default: comparable διαφέρει).
 *   3. ADR-397 — seed baseline (`lastSavedBaseline`) για ΚΑΘΕ doc (auto-save gate).
 *   4. ADR-390 — drop scene entities των οποίων το doc εξαφανίστηκε, εκτός dirty/pending.
 *   5. write μόνο όταν `mutated`, με origin `'remote-echo'` (ADR-040 — δεν πυροδοτεί autosave).
 *
 * @see ./column-persistence-helpers.ts — column adapter (canonical Tier-1 reference)
 * @see ./useHatchPersistence.ts — hatch consumer (ADR-507)
 * @see docs/centralized-systems/reference/adrs/ADR-390-symmetric-bim-delete-undo.md
 */

import { dequal } from 'dequal';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';

/** Minimal level-manager surface used by the snapshot merge. */
export interface DocsMergeLevelManager {
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/** Mutable bookkeeping the merge consults (owned by the hook refs). */
export interface DocsMergeRefs<TComparable> {
  readonly dirty: Set<string>;
  readonly deleted: Set<string>;
  readonly pending: Set<string>;
  readonly isWithinGrace: (id: string) => boolean;
  /** ADR-397 — last-saved comparable per doc id (auto-save gate baseline). */
  readonly lastSavedBaseline: Map<string, TComparable>;
}

/**
 * Per-entity-type adapter. `TComparable` = το payload που συγκρίνεται για «άλλαξε;»
 * (π.χ. `column.params` / `pickHatchData(hatch)`) — ΚΑΙ η τιμή που seed-άρεται ως
 * baseline (ADR-397). `entityComparable(entity)` ΠΡΕΠΕΙ να παράγει το ΙΔΙΟ σχήμα με
 * `docComparable(doc)` ώστε το default `dequal` να συγκρίνει like-for-like.
 *
 * `TContext` = optional per-merge lookup (π.χ. opening host walls) που χτίζεται μία
 * φορά από το scene μέσω `prepareContext` και περνά σε κάθε `docToEntity`.
 */
export interface DocsMergeConfig<
  TDoc extends { id: string },
  TEntity extends AnySceneEntity,
  TComparable,
  TContext = void,
> {
  readonly isEntity: (e: AnySceneEntity) => e is TEntity;
  /**
   * Build the scene entity from a doc. `existing` = current in-scene entity όταν
   * γίνεται replace (`null` στο first add) — επιτρέπει στο MEP να project-άρει το
   * reconciler-owned `systemIds` πάνω στο fresh doc-entity (ADR-408). `ctx` =
   * optional pre-built lookup. Επιστρέφει `null` για **skip** του doc (opening του
   * οποίου ο host wall δεν είναι ακόμα στο scene → retry στο επόμενο snapshot, ADR-440).
   */
  readonly docToEntity: (doc: TDoc, existing: TEntity | null, ctx: TContext) => TEntity | null;
  readonly entityComparable: (entity: TEntity) => TComparable;
  readonly docComparable: (doc: TDoc) => TComparable;
  /** Optional: build a per-merge lookup context from the scene (opening hosts). */
  readonly prepareContext?: (scene: SceneModel) => TContext;
  /**
   * Optional replace-decision override. Default: `!dequal(entityComparable(existing),
   * docComparable(doc))`. Type-resolved entities (wall/opening/slab/roof) περνούν τον
   * υπάρχοντα `*EntityDiffersFromDoc` helper («type always wins»)· το MEP συγκρίνει
   * το projected `getCandidate()` (build-once memo — δεν χτίζεται όταν δεν χρειάζεται).
   */
  readonly differs?: (existing: TEntity, doc: TDoc, getCandidate: () => TEntity | null) => boolean;
  /**
   * Optional: seed ΕΝΑ δεύτερο baseline map (Tier-2 family-type link). Καλείται ανά
   * doc μετά το default `lastSavedBaseline` seed.
   */
  readonly seedExtraBaseline?: (doc: TDoc) => void;
  /**
   * Optional orphan-drop override (scene entity χωρίς matching doc). Default: drop
   * εκτός αν dirty ή pending. Το MepSegment κρατά επιπλέον un-persisted DXF segments
   * (`!lastSavedBaseline.has(id)`).
   */
  readonly shouldDropOrphan?: (id: string, refs: DocsMergeRefs<TComparable>) => boolean;
}

export function mergeDocsIntoScene<
  TDoc extends { id: string },
  TEntity extends AnySceneEntity,
  TComparable,
  TContext = void,
>(
  docs: readonly TDoc[],
  levelId: string,
  lm: DocsMergeLevelManager,
  config: DocsMergeConfig<TDoc, TEntity, TComparable, TContext>,
  refs: DocsMergeRefs<TComparable>,
): void {
  const scene = lm.getLevelScene(levelId);
  if (!scene) return;

  const {
    isEntity, docToEntity, entityComparable, docComparable,
    prepareContext, differs, seedExtraBaseline, shouldDropOrphan,
  } = config;
  const { dirty, deleted, pending, isWithinGrace, lastSavedBaseline } = refs;

  const ctx = (prepareContext ? prepareContext(scene) : undefined) as TContext;

  const docsById = new Map<string, TDoc>();
  for (const d of docs) docsById.set(d.id, d);

  const sceneEntities = new Map<string, TEntity>();
  const others: AnySceneEntity[] = [];
  for (const e of scene.entities) {
    if (isEntity(e)) sceneEntities.set(e.id, e);
    else others.push(e);
  }

  const next: TEntity[] = [];
  let mutated = false;

  for (const doc of docs) {
    if (deleted.has(doc.id)) continue;
    const existing = sceneEntities.get(doc.id);
    if (!existing) {
      if (!dirty.has(doc.id)) {
        const created = docToEntity(doc, null, ctx);
        if (created !== null) { next.push(created); mutated = true; }
      }
      continue;
    }
    if (dirty.has(doc.id)) { next.push(existing); continue; }
    // Grace-period guard (useBimFirestoreWriteGrace SSoT) — suppress stale post-reset snapshots.
    if (isWithinGrace(doc.id)) { next.push(existing); continue; }

    // Build-once memo: ο default path χτίζει το candidate ΜΟΝΟ όταν το comparable
    // διαφέρει· το MEP differ το χτίζει για να project-άρει· τα type-resolution
    // differs (wall/opening/slab/roof) δεν το αγγίζουν (κάνουν δικό τους resolve).
    let built: TEntity | null | undefined;
    const getCandidate = (): TEntity | null => {
      if (built === undefined) built = docToEntity(doc, existing, ctx);
      return built;
    };

    const changed = differs
      ? differs(existing, doc, getCandidate)
      : !dequal(entityComparable(existing), docComparable(doc));
    if (changed) {
      const candidate = getCandidate();
      if (candidate !== null) { next.push(candidate); mutated = true; }
      else next.push(existing); // host-missing on replace → keep existing (ADR-440)
    } else {
      next.push(existing);
    }
  }

  // ADR-397 — seed the "last-saved" baseline for every doc so a subsequently edited
  // entity passes the auto-save gate (else pre-existing edits snap back).
  for (const doc of docs) {
    if (!lastSavedBaseline.has(doc.id)) lastSavedBaseline.set(doc.id, docComparable(doc));
    seedExtraBaseline?.(doc);
  }

  // ADR-390 — drop scene entities whose doc disappeared, unless kept by the policy.
  const dropOrphan = shouldDropOrphan ?? ((id) => !dirty.has(id) && !pending.has(id));
  for (const [id, entity] of sceneEntities) {
    if (docsById.has(id)) continue;
    if (dropOrphan(id, refs)) mutated = true;
    else next.push(entity);
  }

  if (mutated) {
    lm.setLevelScene(levelId, { ...scene, entities: [...others, ...next] }, 'remote-echo');
  }
}
