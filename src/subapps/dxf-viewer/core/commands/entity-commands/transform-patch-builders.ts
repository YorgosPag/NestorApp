/**
 * TRANSFORM PATCH BUILDERS — SSoT for "what does this transform do to one entity".
 *
 * The per-entity geometry patch is the ONLY thing that genuinely varies across the
 * transform family (ADR-507 §8). It was already the universal seam — the in-place
 * spine (`SnapshotTransformCommand.executeInPlace/redoInPlace`), both associative
 * follower engines (`cascadeConnectedPipes`, `cascadeTransformedSlabOpenings`) and
 * every copy path all funnel through the same `computeUpdates(entity)` shape.
 *
 * It was NOT reusable, though: `computeUpdates` is a `protected` method, so the
 * copy path could only reach it from INSIDE a transform subclass. That is exactly
 * why each of Rotate/Scale/Mirror grew its own copy branch (jscpd t222 + the
 * name-shifted Mirror twin jscpd can't see).
 *
 * Hoisting the patch to a free function breaks that coupling: the in-place command
 * and `CloneWithTransformCommand` now consume the SAME builder, so "rotate an
 * entity by θ about P" has ONE definition regardless of whether the result lands
 * on the original or on a clone.
 *
 * ⚠️ This file does NOT own transform math — it only binds the parameters. The math
 * stays where it already is (`rotation-math`, `scale-entity-transform`, `mirror-math`,
 * `bim/transforms/bim-*-geometry`). Do not inline geometry here.
 *
 * @see CloneWithTransformCommand — the copy consumer
 * @see SnapshotTransformCommand — the in-place consumer (via each subclass's computeUpdates)
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §8
 */

import type { SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import { rotateEntity } from '../../../utils/rotation-math';
import { scaleEntity } from '../../../systems/scale/scale-entity-transform';
import { mirrorEntity } from '../../../utils/mirror-math';
import type { MirrorAxis } from '../../../utils/mirror-math';
// ADR-363 Phase 7.2 — BIM-aware transforms (per-kind pivot/axis handling + atomic
// geometry recompute). Each returns null for non-BIM, falling through to the
// generic path below.
import { calculateBimRotatedGeometry } from '../../../bim/transforms/bim-rotate-geometry';
import { calculateBimMirroredGeometry } from '../../../bim/transforms/bim-mirror-geometry';

/** Scale factors — uniform (sx=sy) or non-uniform (sx≠sy). */
export type ScaleParams =
  | { mode: 'uniform'; factor: number }
  | { mode: 'non-uniform'; sx: number; sy: number };

/**
 * A parameter-bound, per-entity geometry patch.
 *
 * MUST be a pure function of its input: the in-place spine calls it with the live
 * entity on execute and with the pre-transform snapshot on redo, and relies on both
 * producing the same patch.
 */
export type TransformPatch = (entity: SceneEntity) => Partial<SceneEntity>;

/**
 * Rotation about `pivot` by `angleDeg`. ADR-363 Phase 7.2: BIM-aware rotate first
 * (atomic `{params, geometry}` patch for the BIM kinds), else generic `rotateEntity`.
 */
export function buildRotatePatch(pivot: Point2D, angleDeg: number): TransformPatch {
  return (entity) => {
    const bimPatch = calculateBimRotatedGeometry(entity as unknown as Entity, pivot, angleDeg);
    if (bimPatch !== null) return bimPatch as Partial<SceneEntity>;
    return rotateEntity(entity as unknown as Entity, pivot, angleDeg) as Partial<SceneEntity>;
  };
}

/**
 * Scale about `basePoint`. CIRCLE → ELLIPSE conversion under non-uniform factors is
 * owned by `scale-entity-transform` (ADR-348 SSoT).
 */
export function buildScalePatch(basePoint: Point2D, params: ScaleParams): TransformPatch {
  const sx = params.mode === 'uniform' ? params.factor : params.sx;
  const sy = params.mode === 'uniform' ? params.factor : params.sy;
  return (entity) => scaleEntity(entity as unknown as Entity, basePoint, sx, sy) as Partial<SceneEntity>;
}

/**
 * Reflection across `axis`. ADR-363 Phase 7.2: BIM-aware mirror first, else generic
 * `mirrorEntity`.
 */
export function buildMirrorPatch(axis: MirrorAxis): TransformPatch {
  return (entity) => {
    const bimPatch = calculateBimMirroredGeometry(entity as unknown as Entity, axis);
    if (bimPatch !== null) return bimPatch as Partial<SceneEntity>;
    return mirrorEntity(entity as unknown as Entity, axis) as Partial<SceneEntity>;
  };
}

// ============================================================================
// PARAM VALIDATION — shared by the in-place commands and the clone command, so a
// degenerate transform is rejected identically on both paths (callers gate on
// `command.validate() !== null`). Returns null when the params are valid.
// ============================================================================

export function rotateParamError(angleDeg: number): string | null {
  return angleDeg === 0 ? 'Rotation angle must be non-zero' : null;
}

export function scaleParamError(params: ScaleParams): string | null {
  if (params.mode === 'uniform') {
    return params.factor === 0 ? 'Scale factor cannot be zero' : null;
  }
  return params.sx === 0 || params.sy === 0 ? 'Scale factors cannot be zero' : null;
}

export function mirrorParamError(axis: MirrorAxis): string | null {
  const dx = axis.p2.x - axis.p1.x;
  const dy = axis.p2.y - axis.p1.y;
  return dx * dx + dy * dy < 1e-10 ? 'Mirror axis points must be distinct' : null;
}
