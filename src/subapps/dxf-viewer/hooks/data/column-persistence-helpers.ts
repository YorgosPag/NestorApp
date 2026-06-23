/**
 * Column persistence — pure helpers + snapshot diff-merge.
 * Extracted from `useColumnPersistence.ts` for file-size compliance (<500 lines);
 * behavior-preserving (mirror of the mep/beam persistence-helper splits).
 *
 * @module hooks/data/column-persistence-helpers
 * @see ./useColumnPersistence.ts
 */

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { ColumnEntity } from '../../bim/types/column-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../bim/validators/column-validator';
import type { ColumnDoc } from '../../bim/columns/column-firestore-service';
import { mergeDocsIntoScene } from './merge-docs-into-scene';

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
 * locally-dirty/pending/grace columns). Thin column adapter πάνω από το
 * `mergeDocsIntoScene` SSoT (μηδέν copy-pasted loop)· comparable = `params`.
 */
export function mergeColumnDocsIntoScene(
  docs: readonly ColumnDoc[],
  levelId: string,
  lm: ColumnMergeLevelManager,
  refs: ColumnMergeRefs,
): void {
  mergeDocsIntoScene<ColumnDoc, ColumnEntity, ColumnEntity['params']>(
    docs,
    levelId,
    lm,
    {
      isEntity: isColumn,
      docToEntity: columnDocToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
    {
      dirty: refs.dirty,
      deleted: refs.deleted,
      pending: refs.pending,
      isWithinGrace: refs.isWithinGrace,
      lastSavedBaseline: refs.lastSavedParams,
    },
  );
}
