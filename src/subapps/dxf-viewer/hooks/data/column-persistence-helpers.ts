/**
 * Column persistence — pure helpers + snapshot diff-merge.
 * Extracted from `useColumnPersistence.ts` for file-size compliance (<500 lines);
 * behavior-preserving (mirror of the mep/beam persistence-helper splits).
 *
 * @module hooks/data/column-persistence-helpers
 * @see ./useColumnPersistence.ts
 */

import { dequal } from 'dequal';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { ColumnEntity } from '../../bim/types/column-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../bim/validators/column-validator';
import type { ColumnDoc } from '../../bim/columns/column-firestore-service';

/** Minimal level-manager surface used by the snapshot merge. */
export interface ColumnMergeLevelManager {
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/** Mutable bookkeeping the snapshot merge consults (owned by the hook refs). */
export interface ColumnMergeRefs {
  readonly dirty: Set<string>;
  readonly deleted: Set<string>;
  readonly pending: Set<string>;
  readonly lastSavedParams: Map<string, ColumnEntity['params']>;
  readonly isWithinGrace: (id: string) => boolean;
}

export function isColumn(entity: AnySceneEntity): entity is ColumnEntity {
  return (entity as { type?: string }).type === 'column';
}

/**
 * Build scene-side `ColumnEntity` από persisted `ColumnDoc`. Geometry +
 * validation recomputed via SSoT pure functions.
 */
export function columnDocToEntity(doc: ColumnDoc): ColumnEntity {
  const validation = doc.validation ?? validateColumnParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'column',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeColumnGeometry(doc.params),
    validation,
    visible: true,
    // ADR-441 Slice COL — restore grid hosting bindings so the reconciler keeps the
    // column following its axes after reload.
    ...(doc.guideBindings !== undefined ? { guideBindings: doc.guideBindings } : {}),
  } as ColumnEntity;
}

/**
 * Diff-merge a Firestore column snapshot into the active scene (selective skip of
 * locally-dirty/pending/grace columns). Mutates via `lm.setLevelScene` only when the
 * merged set differs. Behavior-identical to the former inline subscribe handler.
 */
export function mergeColumnDocsIntoScene(
  docs: readonly ColumnDoc[],
  levelId: string,
  lm: ColumnMergeLevelManager,
  refs: ColumnMergeRefs,
): void {
  const scene = lm.getLevelScene(levelId);
  if (!scene) return;

  const docsById = new Map<string, ColumnDoc>();
  for (const d of docs) docsById.set(d.id, d);

  const { dirty, deleted, pending, lastSavedParams, isWithinGrace } = refs;
  const sceneColumns = new Map<string, ColumnEntity>();
  const nonColumns: AnySceneEntity[] = [];
  for (const e of scene.entities) {
    if (isColumn(e)) sceneColumns.set(e.id, e);
    else nonColumns.push(e);
  }

  const nextColumns: ColumnEntity[] = [];
  let mutated = false;

  for (const doc of docs) {
    if (deleted.has(doc.id)) continue;
    const existing = sceneColumns.get(doc.id);
    if (!existing) {
      if (!dirty.has(doc.id)) {
        nextColumns.push(columnDocToEntity(doc));
        mutated = true;
      }
      continue;
    }
    if (dirty.has(doc.id)) {
      nextColumns.push(existing);
      continue;
    }
    // Grace-period guard (useBimFirestoreWriteGrace SSoT).
    if (isWithinGrace(doc.id)) {
      nextColumns.push(existing);
      continue;
    }
    if (!dequal(existing.params, doc.params)) {
      nextColumns.push(columnDocToEntity(doc));
      mutated = true;
    } else {
      nextColumns.push(existing);
    }
  }

  // ADR-397 — seed the "known/last-saved" baseline for every Firestore doc so a
  // subsequently edited column passes the auto-save gate + its dirty flag protects
  // the local edit from this snapshot (else pre-existing column edits snap back).
  for (const doc of docs) {
    if (!lastSavedParams.has(doc.id)) {
      lastSavedParams.set(doc.id, doc.params);
    }
  }

  // ADR-390 — drop scene columns whose doc disappeared, unless dirty/pending.
  for (const [id, entity] of sceneColumns) {
    if (docsById.has(id)) continue;
    if (dirty.has(id) || pending.has(id)) {
      nextColumns.push(entity);
    } else {
      mutated = true;
    }
  }

  if (mutated) {
    lm.setLevelScene(levelId, {
      ...scene,
      entities: [...nonColumns, ...nextColumns],
    }, 'remote-echo');
  }
}
