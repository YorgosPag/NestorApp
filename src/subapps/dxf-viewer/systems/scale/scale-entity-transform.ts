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
import type { ArrayParams } from '../array/types';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { DxfTextNode } from '../../text-engine/types';
import { scaleTextNodeRunHeights } from '../../utils/text-node-utils';
// ADR-646 Φ3 — reuse the geometry SSoTs: the visible-CCW arc range (shared with hit-test/snap),
// the deg→rad helper, and the rotation-aware rect corner builder (both rect representations).
import { arcVisibleCcwRange } from '../../rendering/entities/shared/geometry-arc-utils';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';
// ADR-647 — an imported hatch's preserved pattern def (inlinePattern) is absolute world geometry, so
// it MUST scale with the boundary (canonical-mm import ×mmFactor); else it renders/exports 1000× dense.
import { transformInlinePattern } from '../../data/hatch-pattern-catalog';

const TWO_PI = Math.PI * 2;
const norm2pi = (x: number): number => ((x % TWO_PI) + TWO_PI) % TWO_PI;

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

// ── Circle / arc → ellipse (non-uniform) SSoT ─────────────────────────────────

/**
 * Non-uniform scale turns a circle (radius `r`) into an axis-aligned ellipse. AutoCAD convention:
 * the LONGER world axis becomes `majorAxis`; when Y is longer the axes swap and `rotation` = 90°
 * (`majorAxis` then points along +Y). SSoT shared by `scaleCircleToEllipse` (full) AND `scaleArc`
 * (partial) so the axes/rotation/swap decision lives in exactly one place.
 */
function nonUniformEllipseAxes(radius: number, absSx: number, absSy: number): {
  majorAxis: number; minorAxis: number; rotation: number; swap: boolean;
} {
  const horizontal = radius * absSx;
  const vertical = radius * absSy;
  return absSx >= absSy
    ? { majorAxis: horizontal, minorAxis: vertical, rotation: 0, swap: false }
    : { majorAxis: vertical, minorAxis: horizontal, rotation: 90, swap: true };
}

/**
 * Map an ORIGINAL circle angle `θ` (degrees) to the ellipse parameter `t` (radians) of the
 * non-uniformly scaled arc. Derived from the local-frame projection `cos t = u/major`,
 * `sin t = v/minor` where `(u, v)` are the scaled radial vector's components along the ellipse
 * axes — so it handles the rotation-90 `swap` AND mirror signs (negative `sx`/`sy`) exactly.
 * ADR-646 #4.
 */
function circleAngleToEllipseParam(angleDeg: number, sx: number, sy: number, swap: boolean): number {
  const a = degToRad(angleDeg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const sgnX = sx < 0 ? -1 : 1;
  const sgnY = sy < 0 ? -1 : 1;
  return swap
    ? Math.atan2(-sgnX * cos, sgnY * sin)
    : Math.atan2(sgnY * sin, sgnX * cos);
}

function scaleArc(e: Entity & { type: 'arc' }, base: Point2D, sx: number, sy: number) {
  const center = scalePoint(e.center, base, sx, sy);
  // Uniform scale keeps a circular ARC (AutoCAD) — only the radius scales by |s|.
  if (sx === sy) {
    return { center, radius: e.radius * Math.abs(sx) };
  }
  // Non-uniform scale → TRUE elliptical arc (AutoCAD/ArchiCAD). Axes/rotation reuse the
  // circle→ellipse SSoT; the arc's VISIBLE CCW range maps to startParam/endParam via the
  // param SSoT above. A mirror (`sx·sy < 0`) reverses CCW↔CW in param space, so swap the
  // endpoints to keep the ellipse sweep CCW (ellipses render start→end CCW).
  const axes = nonUniformEllipseAxes(e.radius, Math.abs(sx), Math.abs(sy));
  const range = arcVisibleCcwRange(e.startAngle, e.endAngle, e.counterclockwise);
  const mirrored = sx * sy < 0;
  const deg0 = mirrored ? range.end : range.start;
  const deg1 = mirrored ? range.start : range.end;
  const rawStart = circleAngleToEllipseParam(deg0, sx, sy, axes.swap);
  const rawEnd = circleAngleToEllipseParam(deg1, sx, sy, axes.swap);
  const startParam = norm2pi(rawStart);
  const sweep = norm2pi(rawEnd - rawStart) || TWO_PI;
  return {
    type: 'ellipse' as const,
    center,
    majorAxis: axes.majorAxis,
    minorAxis: axes.minorAxis,
    rotation: axes.rotation,
    startParam,
    endParam: startParam + sweep,
  };
}

function scaleCircleUniform(e: Entity & { type: 'circle' }, base: Point2D, s: number) {
  return { center: scalePoint(e.center, base, s, s), radius: e.radius * Math.abs(s) };
}

function scaleCircleToEllipse(e: Entity & { type: 'circle' }, base: Point2D, sx: number, sy: number) {
  const center = scalePoint(e.center, base, sx, sy);
  const axes = nonUniformEllipseAxes(e.radius, Math.abs(sx), Math.abs(sy));
  return {
    type: 'ellipse' as const,
    center,
    majorAxis: axes.majorAxis,
    minorAxis: axes.minorAxis,
    rotation: axes.rotation,
  };
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

// ADR-635 Φάση B Batch 2 Part B — LEADER: scale the callout path like a polyline and the
// arrow size / hook length like a scalar radius (`|sx|`, matching the arc/circle convention).
// Without this the leader fell through to `default: {}` and stayed at raw DXF coordinates while
// every other entity scaled by the canonical-mm factor → misplaced callout in metre/cm drawings.
function scaleLeader(e: Entity & { type: 'leader' }, base: Point2D, sx: number, sy: number) {
  const s = Math.abs(sx);
  return {
    vertices: scalePoints(e.vertices, base, sx, sy),
    ...(e.arrowHead ? { arrowHead: { ...e.arrowHead, size: e.arrowHead.size * s } } : {}),
    ...(e.hookLineLength !== undefined ? { hookLineLength: e.hookLineLength * s } : {}),
  };
}

function scalePoint2(e: Entity & { type: 'point' }, base: Point2D, sx: number, sy: number) {
  // ADR-635 Φάση C — $PDSIZE > 0 is in drawing units, so it scales with the canonical-mm
  // factor like any length (|sx|). 0 / <0 are viewport-relative (resolved at draw time) → untouched.
  const pdSize = (e as { pdSize?: number }).pdSize;
  return {
    position: scalePoint(e.position, base, sx, sy),
    ...(pdSize !== undefined && pdSize > 0 ? { pdSize: pdSize * Math.abs(sx) } : {}),
  };
}

function scaleDimension(e: Entity & { type: 'dimension' }, base: Point2D, sx: number, sy: number) {
  return {
    ...(e.startPoint !== undefined && { startPoint: scalePoint(e.startPoint, base, sx, sy) }),
    ...(e.endPoint !== undefined && { endPoint: scalePoint(e.endPoint, base, sx, sy) }),
    ...(e.textPosition !== undefined && { textPosition: scalePoint(e.textPosition, base, sx, sy) }),
  };
}

function scaleHatch(e: Entity & { type: 'hatch' }, base: Point2D, sx: number, sy: number) {
  const inlinePattern = (e as { inlinePattern?: Parameters<typeof transformInlinePattern>[0] }).inlinePattern;
  return {
    boundaryPaths: e.boundaryPaths.map(path => scalePoints(path, base, sx, sy)),
    patternScale: (e.patternScale ?? 1) * Math.abs(sx),
    // Scale-only: base→base, angle 0 ⇒ origin scales about base, delta/dashes × |sx| (ADR-647).
    ...(inlinePattern ? { inlinePattern: transformInlinePattern(inlinePattern, base, sx, sy, 0, base) } : {}),
  };
}

function scaleRectangle(
  e: Entity & { type: 'rectangle' | 'rect' },
  base: Point2D,
  sx: number,
  sy: number,
) {
  // ADR-646 #5 — a ROTATED rect under NON-uniform scale is no longer a rectangle: the two edge
  // directions scale by different factors and the corner angles shear → it becomes a
  // parallelogram. AutoCAD/ArchiCAD/Figma bake it to an explicit 4-vertex polyline. Reuse the
  // rotation-aware corner SSoT (`rectangleEntityVertices`, handles corner1/corner2 AND x/y/w/h),
  // then scale each corner. Uniform scale (any rotation) OR an axis-aligned rect stays a rect.
  if (e.rotation && sx !== sy) {
    const vertices = rectangleEntityVertices(e).map(v => scalePoint(v, base, sx, sy));
    return { type: 'polyline' as const, vertices, closed: true };
  }
  const origin = scalePoint({ x: e.x, y: e.y }, base, sx, sy);
  return {
    x: origin.x,
    y: origin.y,
    width: e.width * Math.abs(sx),
    height: e.height * Math.abs(sy),
  };
}

// ── Construction / annotation geometry (ADR-646 Φ2) ───────────────────────────

// XLINE / RAY: two anchor points scale like any world point; `direction` is a unit
// vector (orientation only) → untouched. Without this both fell to `default:{}`.
function scaleConstructionLine(e: Entity & { type: 'xline' | 'ray' }, base: Point2D, sx: number, sy: number) {
  return {
    basePoint: scalePoint(e.basePoint, base, sx, sy),
    ...(e.secondPoint ? { secondPoint: scalePoint(e.secondPoint, base, sx, sy) } : {}),
  };
}

function scaleAngleMeasurement(e: Entity & { type: 'angle-measurement' }, base: Point2D, sx: number, sy: number) {
  // Three world points; the reported `angle` is derived at render time from them.
  return {
    vertex: scalePoint(e.vertex, base, sx, sy),
    point1: scalePoint(e.point1, base, sx, sy),
    point2: scalePoint(e.point2, base, sx, sy),
  };
}

function scaleCenterMark(e: Entity & { type: 'center-mark' }, base: Point2D, sx: number, sy: number) {
  // `size` is annotative paper-mm → preserved (AutoCAD annotative). Only the world center moves.
  return { center: scalePoint(e.center, base, sx, sy) };
}

function scaleCenterLine(e: Entity & { type: 'centerline' }, base: Point2D, sx: number, sy: number) {
  // `extension` is annotative paper-mm → preserved. Endpoints are world → scaled.
  return { start: scalePoint(e.start, base, sx, sy), end: scalePoint(e.end, base, sx, sy) };
}

function scaleAnnotationSymbol(e: Entity & { type: 'annotation-symbol' }, base: Point2D, sx: number, sy: number) {
  // `sizeMm` is annotative paper-mm → preserved; the insertion point follows the geometry.
  return { position: scalePoint(e.position, base, sx, sy) };
}

function scaleScaleBar(e: Entity & { type: 'scale-bar' }, base: Point2D, sx: number, sy: number) {
  // `length` is scale-INVARIANT by design; bar/label heights are annotative paper-mm. Only the
  // world origin follows the transform (params are the SSoT; derived geometry recomputes on render).
  return { position: scalePoint(e.position, base, sx, sy) };
}

function scaleOpeningInfoTag(e: Entity & { type: 'opening-info-tag' }, base: Point2D, sx: number, sy: number) {
  // `widthMm` is WORLD canonical-mm (NOT annotative) → scales like a length (|sx|). Height is
  // derived (locked aspect); the geometry cache recomputes from these params.
  return { position: scalePoint(e.position, base, sx, sy), widthMm: e.widthMm * Math.abs(sx) };
}

// ARRAY (ADR-353): scale the source copies (recursive SSoT, like GROUP) AND the spacing params so
// the whole associative pattern scales; the array regenerates its items from these downstream.
function scaleArrayParams(params: ArrayParams, base: Point2D, sx: number, sy: number): ArrayParams {
  switch (params.kind) {
    case 'rect':
      return { ...params, colSpacing: params.colSpacing * Math.abs(sx), rowSpacing: params.rowSpacing * Math.abs(sy) };
    case 'polar':
      return { ...params, center: scalePoint(params.center, base, sx, sy), radius: params.radius * Math.abs(sx) };
    case 'path':
      return params.spacing !== undefined ? { ...params, spacing: params.spacing * Math.abs(sx) } : params;
  }
}

function scaleArray(e: Entity & { type: 'array' }, base: Point2D, sx: number, sy: number) {
  return {
    hiddenSources: e.hiddenSources.map(m => ({ ...m, ...scaleEntity(m, base, sx, sy) })),
    params: scaleArrayParams(e.params, base, sx, sy),
    ...(e.basePointOverride ? { basePointOverride: scalePoint(e.basePointOverride, base, sx, sy) } : {}),
  };
}

// ── Supported-type gate (SSoT — MUST mirror the `scaleEntity` switch below) ────

/**
 * The entity types the scale transform actually handles. The tool reads this to
 * skip parametric BIM (wall/column/beam/slab/stair/…) with an explicit message
 * instead of a silent no-op (ADR-646 #3) — Revit/ArchiCAD «cannot be scaled».
 */
const SCALABLE_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'line', 'arc', 'circle', 'ellipse', 'polyline', 'lwpolyline', 'spline', 'text', 'mtext',
  'point', 'leader', 'dimension', 'hatch', 'rectangle', 'rect', 'block', 'group',
  'xline', 'ray', 'array', 'angle-measurement', 'center-mark', 'centerline',
  'annotation-symbol', 'scale-bar', 'opening-info-tag',
]);

/** Whether the scale transform produces a real geometry change for `type` (ADR-646 #3). */
export function isScalableEntityType(type: string): boolean {
  return SCALABLE_ENTITY_TYPES.has(type);
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
    case 'leader':
      return scaleLeader(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'dimension':
      return scaleDimension(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'hatch':
      return scaleHatch(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'rectangle':
    case 'rect':
      return scaleRectangle(entity, base, sx, sy) as Partial<SceneEntity>;
    // ADR-646 Φ2 — construction lines + standalone annotations (were silent `default:{}` no-ops).
    case 'xline':
    case 'ray':
      return scaleConstructionLine(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'angle-measurement':
      return scaleAngleMeasurement(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'center-mark':
      return scaleCenterMark(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'centerline':
      return scaleCenterLine(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'annotation-symbol':
      return scaleAnnotationSymbol(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'scale-bar':
      return scaleScaleBar(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'opening-info-tag':
      return scaleOpeningInfoTag(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'array':
      return scaleArray(entity, base, sx, sy) as Partial<SceneEntity>;
    case 'block': {
      // ADR-640 — BLOCK instance (DXF INSERT): scaling about `base` moves the insertion point
      // toward/away from base AND multiplies the placement scale factors (INSERT semantics — the
      // block definition/local members are immutable). Scaling about the origin (import mm-pass)
      // grows the rendered geometry by the same factor because the member contribution is
      // `scale · member` → this is the correct AutoCAD block scale.
      const e = entity as unknown as { position: { x: number; y: number }; scale?: { x: number; y: number } };
      const curScale = e.scale ?? { x: 1, y: 1 };
      return {
        position: { x: base.x + (e.position.x - base.x) * sx, y: base.y + (e.position.y - base.y) * sy },
        scale: { x: curScale.x * sx, y: curScale.y * sy },
      } as unknown as Partial<SceneEntity>;
    }
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
