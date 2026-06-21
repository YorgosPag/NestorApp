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
 * `type` is intentionally KEPT (returned) by default so a type-changing edit
 * (e.g. Scale circle→ellipse) is reversible; for edits that never change `type`
 * restoring it is a harmless no-op.
 *
 * Some edits (Extend/Trim) restore PURE geometry onto an existing entity via
 * `updateEntity` and must NOT carry `type` (the entity already has its type, and
 * Extend/Trim never change it). Those pass `{ excludeType: true }`.
 *
 * @see core/commands/entity-commands/SnapshotTransformCommand.ts
 * @see core/commands/entity-commands/ExtendEntityCommand.ts (excludeType)
 * @see core/commands/entity-commands/TrimEntityCommand.ts (excludeType)
 */

import type { SceneEntity } from '../interfaces';

/** Options for {@link geometryFromSnapshot}. */
export interface GeometryFromSnapshotOptions {
  /** When true, also drop `type` — for geometry-only restores onto an entity that keeps its type. */
  readonly excludeType?: boolean;
}

/**
 * Geometry fields of a snapshot to write back on undo — everything except the
 * identity fields (`id`, `layer`, `visible`). Keeps `type` unless
 * `options.excludeType` is set (see module header).
 */
export function geometryFromSnapshot(
  snapshot: SceneEntity,
  options?: GeometryFromSnapshotOptions,
): Partial<SceneEntity> {
  const { id: _id, layer: _layer, visible: _visible, ...geometry } = snapshot as SceneEntity & {
    layer?: unknown;
    visible?: unknown;
  };
  if (options?.excludeType) {
    const { type: _type, ...withoutType } = geometry as Record<string, unknown>;
    return withoutType as Partial<SceneEntity>;
  }
  return geometry as Partial<SceneEntity>;
}
