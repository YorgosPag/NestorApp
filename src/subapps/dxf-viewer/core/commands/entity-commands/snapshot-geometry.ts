/**
 * SNAPSHOT GEOMETRY — SSoT for "restore geometry from an entity snapshot".
 *
 * Every snapshot-restore undo command (`SnapshotTransformCommand`,
 * `ArcRadiusEditCommand`, `LengthenCommand`, `PolylineVertexCommand`,
 * `StretchEntityCommand`, …) needed the SAME patch on undo: take the pre-edit
 * snapshot and produce the geometry to write back — i.e. ALL fields EXCEPT the
 * identity fields (`id`, `layer`, `visible`) which must never be overwritten by a
 * geometry restore. That destructure was copy-pasted verbatim in each command.
 *
 * `type` is intentionally KEPT (returned) so a type-changing edit (e.g. Scale
 * circle→ellipse) is reversible; for edits that never change `type` restoring it
 * is a harmless no-op.
 *
 * @see core/commands/entity-commands/SnapshotTransformCommand.ts
 */

import type { SceneEntity } from '../interfaces';

/**
 * Geometry fields of a snapshot to write back on undo — everything except the
 * identity fields (`id`, `layer`, `visible`). Keeps `type` (see module header).
 */
export function geometryFromSnapshot(snapshot: SceneEntity): Partial<SceneEntity> {
  const { id: _id, layer: _layer, visible: _visible, ...geometry } = snapshot as SceneEntity & {
    layer?: unknown;
    visible?: unknown;
  };
  return geometry as Partial<SceneEntity>;
}
