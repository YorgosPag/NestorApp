/**
 * ADR-358 Phase 8 — Pure stair snapshot diff-merge (DD-4, 2026-05-17).
 *
 * Extracted from `useStairPersistence` to keep the hook under the Google SRP
 * 500-line limit. This module owns the *reconciliation* responsibility: given a
 * Firestore stair snapshot and the active scene, decide the next entity list.
 *
 * Diff-merge with selective skip:
 *  - locally-dirty stairs are NEVER overwritten — local edits always win until
 *    the debounced save round-trips,
 *  - ADR-402 seeds the saved baseline for freshly-loaded stairs so the
 *    auto-save gate treats them as `known` (fixes the gizmo-edit revert bug),
 *  - ADR-390 preserves only `dirty` / `pendingFirstSave` orphans, closing the
 *    Bug B ghost-render path where a fresh refresh kept orphan entities.
 *
 * SSoT NOTE (ADR-390 mergeDocsIntoScene rollout, 2026-06-24): the stair merge is
 * deliberately NOT migrated onto the generic `hooks/data/merge-docs-into-scene.ts`
 * SSoT. It diverges on three axes the generic does not model:
 *   1. **Return contract** — returns `{entities, mutated}` and lets the CALLER own
 *      the `setLevelScene` write (the generic writes internally). Stairs need the
 *      caller-owned write for their selection-debounce persist path.
 *   2. **ADR-402 seed-before-existing** — seeds `lastSavedParams` INSIDE the doc
 *      loop, BEFORE the existing-entity check, and gated on `!dirty` (the generic
 *      seeds unconditionally AFTER the loop).
 *   3. **Composite compare** — `params` AND `editingBy` (soft-lock).
 * Forcing it onto the generic would require either widening the generic's contract
 * (a return-only mode for a single consumer) or a throw-away level-manager shim —
 * both worse than this self-contained pure function. Kept intentionally special.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.1
 * @see ../../hooks/data/merge-docs-into-scene.ts — generic SSoT (column/wall/opening/MEP/…)
 */

import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { StairDoc, StairEntity } from '../types/stair-types';
import { stairDocToEntity } from '../stairs/stair-doc-hydration';

export function isStair(entity: AnySceneEntity): entity is StairEntity {
  return (entity as { type?: string }).type === 'stair';
}

export interface StairSnapshotMergeRefs {
  /** Stairs currently in a local edit, awaiting the debounced save flush. */
  readonly dirty: Set<string>;
  /** Tombstoned stairs — ignore their incoming docs. */
  readonly deleted: Set<string>;
  /** Drawn / undo-restored stairs awaiting their first save. */
  readonly pending: Set<string>;
  /** Saved-params baseline keyed by stair id (seeded here for loaded stairs). */
  readonly lastSavedParams: Map<string, StairEntity['params']>;
}

export interface StairSnapshotMergeResult {
  readonly entities: AnySceneEntity[];
  readonly mutated: boolean;
}

/**
 * Reconcile a Firestore stair snapshot against the active scene. Returns the
 * next entity list plus a `mutated` flag — callers only write the scene when
 * `mutated` is true. Mutates `refs.lastSavedParams` to seed loaded baselines.
 */
export function mergeStairSnapshot(
  docs: readonly StairDoc[],
  scene: SceneModel,
  refs: StairSnapshotMergeRefs,
): StairSnapshotMergeResult {
  const { dirty, deleted, pending, lastSavedParams } = refs;

  const docsById = new Map<string, StairDoc>();
  for (const d of docs) docsById.set(d.id, d);

  const nonStairs: AnySceneEntity[] = [];
  const sceneStairs = new Map<string, StairEntity>();
  for (const e of scene.entities) {
    if (isStair(e)) sceneStairs.set(e.id, e);
    else nonStairs.push(e);
  }

  const nextStairs: StairEntity[] = [];
  let mutated = false;

  for (const doc of docs) {
    if (deleted.has(doc.id)) continue;
    // ADR-402 — seed the saved baseline for loaded stairs (mirror
    // useWallPersistence) so the auto-save gate treats them as `known`.
    if (!dirty.has(doc.id) && !lastSavedParams.has(doc.id)) {
      lastSavedParams.set(doc.id, doc.params);
    }
    const existing = sceneStairs.get(doc.id);
    if (!existing) {
      // Remote add — only if not currently in local-create flow.
      if (!dirty.has(doc.id)) {
        nextStairs.push(stairDocToEntity(doc));
        mutated = true;
      }
      continue;
    }
    if (dirty.has(doc.id)) {
      // Local wins — preserve in-flight edit.
      nextStairs.push(existing);
      continue;
    }
    // Remote update — merge if params actually differ.
    if (!dequal(existing.params, doc.params) || !dequal(existing.editingBy, doc.editingBy)) {
      nextStairs.push(stairDocToEntity(doc));
      mutated = true;
    } else {
      nextStairs.push(existing);
    }
  }

  // ADR-390 — preserve scene stairs absent from the snapshot only if dirty or
  // pendingFirstSave (drawn / restored via undo). Otherwise drop as orphans.
  for (const [id, entity] of sceneStairs) {
    if (docsById.has(id)) continue;
    if (dirty.has(id) || pending.has(id)) {
      nextStairs.push(entity);
    } else {
      mutated = true;
    }
  }

  return { entities: [...nonStairs, ...nextStairs], mutated };
}
