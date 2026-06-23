/**
 * Generic Firestore-snapshot → scene diff-merge SSoT (ADR-390 / ADR-397).
 *
 * Πριν, ΚΑΘΕ per-entity persistence hook (column/wall/opening/hatch/…) είχε το ΙΔΙΟ
 * διφφ-merge loop **copy-pasted** (selective-skip dirty/pending/grace, add/update/drop,
 * ADR-397 baseline seed, `'remote-echo'` write). Πλέον ζει **ΜΙΑ φορά** εδώ,
 * παραμετροποιημένο με 4 pure callbacks (type-guard, converter, comparable×2).
 *
 * Συμπεριφορά (byte-equivalent με το πρώην `mergeColumnDocsIntoScene`):
 *   1. partition του scene σε «δικά μου» entities (`isEntity`) + others.
 *   2. ανά doc: skip αν tombstoned· add αν λείπει & όχι dirty· keep local αν
 *      dirty/grace· replace αν `dequal(entityComparable, docComparable)` διαφέρει.
 *   3. ADR-397 — seed baseline (`lastSavedBaseline`) για ΚΑΘΕ doc (auto-save gate).
 *   4. ADR-390 — drop scene entities των οποίων το doc εξαφανίστηκε, εκτός dirty/pending.
 *   5. write μόνο όταν `mutated`, με origin `'remote-echo'` (ADR-040 — δεν πυροδοτεί autosave).
 *
 * @see ./column-persistence-helpers.ts — column adapter (canonical reference)
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

/**
 * Per-entity-type adapter. `TComparable` = το payload που συγκρίνεται για «άλλαξε;»
 * (π.χ. `column.params` / `pickHatchData(hatch)`) — ΚΑΙ η τιμή που seed-άρεται ως
 * baseline (ADR-397). `entityComparable(entity)` ΠΡΕΠΕΙ να παράγει το ΙΔΙΟ σχήμα με
 * `docComparable(doc)` ώστε το `dequal` να συγκρίνει like-for-like.
 */
export interface DocsMergeConfig<TDoc extends { id: string }, TEntity extends AnySceneEntity, TComparable> {
  readonly isEntity: (e: AnySceneEntity) => e is TEntity;
  readonly docToEntity: (doc: TDoc) => TEntity;
  readonly entityComparable: (entity: TEntity) => TComparable;
  readonly docComparable: (doc: TDoc) => TComparable;
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

export function mergeDocsIntoScene<TDoc extends { id: string }, TEntity extends AnySceneEntity, TComparable>(
  docs: readonly TDoc[],
  levelId: string,
  lm: DocsMergeLevelManager,
  config: DocsMergeConfig<TDoc, TEntity, TComparable>,
  refs: DocsMergeRefs<TComparable>,
): void {
  const scene = lm.getLevelScene(levelId);
  if (!scene) return;

  const { isEntity, docToEntity, entityComparable, docComparable } = config;
  const { dirty, deleted, pending, isWithinGrace, lastSavedBaseline } = refs;

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
      if (!dirty.has(doc.id)) { next.push(docToEntity(doc)); mutated = true; }
      continue;
    }
    if (dirty.has(doc.id)) { next.push(existing); continue; }
    // Grace-period guard (useBimFirestoreWriteGrace SSoT) — suppress stale post-reset snapshots.
    if (isWithinGrace(doc.id)) { next.push(existing); continue; }
    if (!dequal(entityComparable(existing), docComparable(doc))) {
      next.push(docToEntity(doc)); mutated = true;
    } else {
      next.push(existing);
    }
  }

  // ADR-397 — seed the "last-saved" baseline for every doc so a subsequently edited
  // entity passes the auto-save gate (else pre-existing edits snap back).
  for (const doc of docs) {
    if (!lastSavedBaseline.has(doc.id)) lastSavedBaseline.set(doc.id, docComparable(doc));
  }

  // ADR-390 — drop scene entities whose doc disappeared, unless dirty/pending.
  for (const [id, entity] of sceneEntities) {
    if (docsById.has(id)) continue;
    if (dirty.has(id) || pending.has(id)) next.push(entity);
    else mutated = true;
  }

  if (mutated) {
    lm.setLevelScene(levelId, { ...scene, entities: [...others, ...next] }, 'remote-echo');
  }
}
