/**
 * SCALE ENTITY TRANSFORM — ADR-348 SSOT
 *
 * Single Source of Truth for all per-entity scale transformations.
 * No scale math exists anywhere else in the codebase.
 *
 * Uniform scale (sx = sy): all geometry scales proportionally.
 * Non-uniform scale (sx ≠ sy): CIRCLE → ELLIPSE conversion applied.
 *
 * @see ADR-348 §Entity Transform
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { DxfTextNode } from '../../text-engine/types';
import { scaleTextNodeRunHeights } from '../../utils/text-node-utils';

// ── Point scale ───────────────────────────────────────────────────────────────

export function scalePoint(p: Point2D, base: Point2D, sx: number, sy: number): Point2D {
  return {
    x: base.x + (p.x - base.x) * sx,
    y: base.y + (p.y - base.y) * sy,
  };
}

function scalePoints(pts: Point2D[], base: Point2D, sx: number, sy: number): Point2D[] {
  return pts.map(p => scalePoint(p, base, sx, sy));
}

// ── Entity-specific transforms ────────────────────────────────────────────────

function scaleLine(e: Entity & { type: 'line' }, base: Point2D, sx: number, sy: number) {
  return {
    start: scalePoint(e.start, base, sx, sy),
    end: scalePoint(e.end, base, sx, sy),
  };
}

function scaleArc(e: Entity & { type: 'arc' }, base: Point2D, sx: number, sy: number) {
  if (sx === sy) {
    return { center: scalePoint(e.center, base, sx, sy), radius: e.radius * Math.abs(sx) };
  }
  // Non-uniform arc → elliptical arc (type stays 'arc'; render will approximate)
  return { center: scalePoint(e.center, base, sx, sy), radius: e.radius * Math.abs(sx) };
}

function scaleCircleUniform(e: Entity & { type: 'circle' }, base: Point2D, s: number) {
  return { center: scalePoint(e.center, base, s, s), radius: e.radius * Math.abs(s) };
}

function scaleCircleToEllipse(e: Entity & { type: 'circle' }, base: Point2D, sx: number, sy: number) {
  const absSx = Math.abs(sx);
  const absSy = Math.abs(sy);
  const center = scalePoint(e.center, base, sx, sy);
  const horizontal = e.radius * absSx;
  const vertical = e.radius * absSy;
  if (absSx >= absSy) {
    return { type: 'ellipse' as const, center, majorAxis: horizontal, minorAxis: vertical, rotation: 0 };
  }
  return { type: 'ellipse' as const, center, majorAxis: vertical, minorAxis: horizontal, rotation: 90 };
}

function scaleEllipse(e: Entity & { type: 'ellipse' }, base: Point2D, sx: number, sy: number) {
  return {
    center: scalePoint(e.center, base, sx, sy),
    majorAxis: e.majorAxis * Math.abs(sx),
    minorAxis: e.minorAxis * Math.abs(sy),
  };
}

function scalePolyline(e: Entity & { type: 'polyline' | 'lwpolyline' }, base: Point2D, sx: number, sy: number) {
  return { vertices: scalePoints(e.vertices, base, sx, sy) };
}

function scaleSpline(e: Entity & { type: 'spline' }, base: Point2D, sx: number, sy: number) {
  return { controlPoints: scalePoints(e.controlPoints, base, sx, sy) };
}

function scaleText(e: Entity & { type: 'text' }, base: Point2D, sx: number, sy: number) {
  const node = (e as { textNode?: DxfTextNode }).textNode;
  return {
    position: scalePoint(e.position, base, sx, sy),
    height: (e.height ?? e.fontSize ?? 1) * Math.abs(sy),
    fontSize: (e.fontSize ?? e.height ?? 1) * Math.abs(sy),
    // ADR-635 Φ3-text — `widthFactor` is a RATIO (glyph width ÷ height), NOT an absolute width like
    // MTEXT's `width`. A scale by (sx,sy) takes width→sx·w and height→sy·h, so the ratio
    // becomes `widthFactor · sx/sy` — a UNIFORM scale (sx===sy, e.g. the ADR-462 canonical-mm
    // ×1000 import) must leave it UNCHANGED. The old `* |sx|` multiplied it by 1000 on import →
    // once the height fix made text visible, glyphs stretched 1000× wide («τεράστιες οριζόντιες
    // γραμμές»). `|sx/sy|` is identical to `|sx|` for the e/w grip (sy===1), so that path is
    // unchanged. `sy===0` (degenerate) falls back to 1× (no stretch).
    widthFactor: ((e as { widthFactor?: number }).widthFactor ?? 1) * (sy !== 0 ? Math.abs(sx / sy) : 1),
    // ADR-635 — the AUTHORITATIVE height lives in the `textNode`: `resolveTextHeight`
    // reads run `style.height` FIRST, so scaling only the flat `height` above is SHADOWED
    // (imported DXF text rendered ~1000× too short after the canonical-mm import scale →
    // «κείμενα χωρίς ύψος, μία γραμμή»). Scale the run heights through the SSoT so
    // render / grip / ghost / 3D all read the scaled value. Reuses the same helper the
    // grip-resize path uses — no duplicate scaler.
    ...(node ? { textNode: scaleTextNodeRunHeights(node, Math.abs(sy)) } : {}),
  };
}

function scaleMText(e: Entity & { type: 'mtext' }, base: Point2D, sx: number, sy: number) {
  const node = (e as { textNode?: DxfTextNode }).textNode;
  return {
    position: scalePoint(e.position, base, sx, sy),
    height: e.height !== undefined ? e.height * Math.abs(sy) : undefined,
    fontSize: e.fontSize !== undefined ? e.fontSize * Math.abs(sy) : undefined,
    width: e.width * Math.abs(sx),
    // ADR-635 — mirror `scaleText`: the run `style.height` in the `textNode` is what
    // `resolveTextHeight` reads first, so the flat-height scale alone is shadowed.
    ...(node ? { textNode: scaleTextNodeRunHeights(node, Math.abs(sy)) } : {}),
  };
}

function scalePoint2(e: Entity & { type: 'point' }, base: Point2D, sx: number, sy: number) {
  return { position: scalePoint(e.position, base, sx, sy) };
}

function scaleDimension(e: Entity & { type: 'dimension' }, base: Point2D, sx: number, sy: number) {
  return {
    ...(e.startPoint !== undefined && { startPoint: scalePoint(e.startPoint, base, sx, sy) }),
    ...(e.endPoint !== undefined && { endPoint: scalePoint(e.endPoint, base, sx, sy) }),
    ...(e.textPosition !== undefined && { textPosition: scalePoint(e.textPosition, base, sx, sy) }),
  };
}

function scaleHatch(e: Entity & { type: 'hatch' }, base: Point2D, sx: number, sy: number) {
  return {
    boundaryPaths: e.boundaryPaths.map(path => scalePoints(path, base, sx, sy)),
    patternScale: (e.patternScale ?? 1) * Math.abs(sx),
  };
}

function scaleRectangle(
  e: Entity & { type: 'rectangle' | 'rect' },
  base: Point2D,
  sx: number,
  sy: number,
) {
  const origin = scalePoint({ x: e.x, y: e.y }, base, sx, sy);
  return {
    x: origin.x,
    y: origin.y,
    width: e.width * Math.abs(sx),
    height: e.height * Math.abs(sy),
  };
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

/**
 * Scale entity geometry around `base` by factors `sx` (X) and `sy` (Y).
 *
 * Returns a partial update object for `sceneManager.updateEntity()`.
 * For CIRCLE with sx ≠ sy, includes `type: 'ellipse'` in the return value
 * to trigger entity type conversion.
 *
 * @param entity - Entity to scale
 * @param base   - Fixed point of the transformation
 * @param sx     - Horizontal scale factor (negative = mirror + scale)
 * @param sy     - Vertical scale factor (negative = mirror + scale)
 */
export function scaleEntity(
  entity: Entity,
  base: Point2D,
  sx: number,
  sy: number,
): Partial<SceneEntity> {
  switch (entity.type) {
    case 'line':
      return scaleLine(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'arc':
      return scaleArc(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'circle':
      if (sx === sy) return scaleCircleUniform(entity, base, sx) as Partial<SceneEntity>;
      return scaleCircleToEllipse(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'ellipse':
      return scaleEllipse(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'polyline':
    case 'lwpolyline':
      return scalePolyline(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'spline':
      return scaleSpline(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'text':
      return scaleText(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'mtext':
      return scaleMText(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'point':
      return scalePoint2(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'dimension':
      return scaleDimension(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'hatch':
      return scaleHatch(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'rectangle':
    case 'rect':
      return scaleRectangle(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'group': {
      // ADR-575 — GROUP container: scaling the group scales every member about the
      // SAME base. Recurse the SAME SSoT per member (handles nested groups).
      const members = (entity as unknown as { members: Entity[] }).members.map((m) => ({
        ...m,
        ...scaleEntity(m, base, sx, sy),
      }));
      return { members } as unknown as Partial<SceneEntity>;
    }
    default:
      return {};
  }
}
