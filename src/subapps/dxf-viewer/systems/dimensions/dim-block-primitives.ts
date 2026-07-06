/**
 * ADR-362 Round 26 — Dimension anonymous-block primitive builder (pure).
 *
 * Turns a `DimensionEntity` + resolved `DimStyle` into the flat list of WORLD-space
 * drawing primitives that make up the dimension's anonymous block (`*Dn`) in the
 * exported DXF — extension lines, dim line / arc / leader, arrowheads, and the
 * measured text. AutoCAD always writes this cached "picture" alongside the
 * DIMENSION entity; emitting it ourselves means dimensions render reliably in
 * every reader, even ones that do NOT regenerate dimension geometry from the
 * def-points + DIMSTYLE (no DIMREGEN).
 *
 * FULL SSoT — this module computes NO geometry of its own:
 *   - shape of the dimension       → `buildDimensionGeometry` (the on-screen SSoT)
 *   - shape of each arrowhead       → `getArrowheadBlock` (unit-space block defs)
 *   - measured label string         → `resolveDimensionText` (the on-screen SSoT)
 * It only places those into world coordinates. DXF serialization is the writer's
 * job (`export/core/dxf-ascii-writer.ts`), so this stays free of DXF knowledge and
 * is unit-testable on its own.
 *
 * Sizing parity with the canvas renderer: arrowheads are `dimasz × dimscale` world
 * units and text is `dimtxt × dimscale` world units (the renderer applies the same
 * factors before the view transform). The dim line / extension geometry already
 * comes out of `buildDimensionGeometry` in world units, so the writer only applies
 * the export coordinate scale — never `dimscale` twice.
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
import type { ArrowheadPoint } from './dim-arrowhead-blocks';
import { getArrowheadBlock, resolveArrowBlockNames } from './dim-arrowhead-blocks';
import {
  buildDimensionGeometry,
  type AngularDimGeometry,
  type DimGeometry,
  type DimensionLookup,
} from './dim-geometry-builder';
import { resolveDimensionText } from './dim-text-formatter';

const RAD_TO_DEG = 180 / Math.PI;
/** A direction shorter than this is the geometry builder's "no arrow on this side" signal. */
const ZERO_DIRECTION_EPSILON = 1e-9;

// ──────────────────────────────────────────────────────────────────────────────
// World-space primitive union (DXF-agnostic)
// ──────────────────────────────────────────────────────────────────────────────

export type DimBlockPrimitive =
  | { readonly kind: 'line'; readonly a: Point2D; readonly b: Point2D }
  | {
      readonly kind: 'arc';
      readonly center: Point2D;
      readonly radius: number;
      /** CCW start/end in degrees (DXF convention). */
      readonly startDeg: number;
      readonly endDeg: number;
    }
  | { readonly kind: 'circle'; readonly center: Point2D; readonly radius: number }
  /** Filled convex polygon (a solid arrowhead) — writer emits a 3DFACE. */
  | { readonly kind: 'fill'; readonly points: readonly Point2D[] }
  | {
      readonly kind: 'text';
      readonly position: Point2D;
      readonly text: string;
      /** Text height in world units (= dimtxt × dimscale). */
      readonly heightWorld: number;
      /** CCW rotation in degrees. */
      readonly rotationDeg: number;
    };

// ──────────────────────────────────────────────────────────────────────────────
// Public builder
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build the world-space primitives for a dimension's anonymous block.
 *
 * Throws (via `buildDimensionGeometry`) on degenerate / partial def points or a
 * missing baseline/continued chain parent — the caller wraps in try/catch and
 * simply skips the block (the DIMENSION entity stays, so a regen-capable reader
 * still shows it).
 */
export function buildDimensionBlockPrimitives(
  entity: DimensionEntity,
  style: DimStyle,
  lookup?: DimensionLookup,
): DimBlockPrimitive[] {
  const g = buildDimensionGeometry(entity, style, lookup);
  const out: DimBlockPrimitive[] = [];

  // 1) Extension / witness lines (linear + angular carry them).
  if (g.kind === 'linear' || g.kind === 'angular') {
    if (g.extLine1 && !style.suppressExtLine1) {
      out.push({ kind: 'line', a: g.extLine1.start, b: g.extLine1.end });
    }
    if (g.extLine2 && !style.suppressExtLine2) {
      out.push({ kind: 'line', a: g.extLine2.start, b: g.extLine2.end });
    }
  }

  // 2) Dim line (linear) / dim arc (angular) / leader polyline (radial).
  if (g.kind === 'linear') {
    if (!style.suppressDimLine1 && !style.suppressDimLine2) {
      out.push({ kind: 'line', a: g.dimLine.start, b: g.dimLine.end });
    }
  } else if (g.kind === 'angular') {
    out.push(buildArcPrimitive(g));
  } else {
    for (let i = 0; i < g.leaderPath.length - 1; i += 1) {
      out.push({ kind: 'line', a: g.leaderPath[i], b: g.leaderPath[i + 1] });
    }
  }

  // 3) Arrowheads (size = dimasz × dimscale, like the renderer's unitPx without the view scale).
  // ADR-362 §7 — share the `dimblk{1,2} || dimblk` fallback SSoT with both canvas
  // renderers. This DXF-export path intentionally does NOT honor the per-side
  // `suppressArrow{1,2}` visibility gate (arrowhead visibility does not round-trip
  // through DXF — see `dxf-dimstyle-writer`), so it keeps its own `pushArrowhead`.
  const arrowSizeWorld = style.dimasz * style.dimscale;
  const { block1, block2 } = resolveArrowBlockNames(style);
  pushArrowhead(out, block1, g.arrowAnchor1, g.arrowDirection1, arrowSizeWorld, 1);
  pushArrowhead(out, block2, g.arrowAnchor2, g.arrowDirection2, arrowSizeWorld, 2);

  // 4) Measured text (centered on textAnchor, rotated to textRotation).
  const text = resolveDimensionText(g, style, entity.userText);
  if (text) {
    out.push({
      kind: 'text',
      position: g.textAnchor,
      text,
      heightWorld: style.dimtxt * style.dimscale,
      rotationDeg: g.textRotation * RAD_TO_DEG,
    });
  }

  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Normalise degrees into [0, 360). */
function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Angular dim line → DXF arc. `arcStartAngle`/`arcEndAngle` are unwrapped radians;
 * a negative sweep (CW) is re-expressed as a CCW arc (DXF arcs are always CCW
 * start→end) by swapping the endpoints — the traced span is identical.
 */
function buildArcPrimitive(g: AngularDimGeometry): DimBlockPrimitive {
  const startDeg = g.arcStartAngle * RAD_TO_DEG;
  const endDeg = g.arcEndAngle * RAD_TO_DEG;
  const ccw = g.arcEndAngle - g.arcStartAngle >= 0;
  return {
    kind: 'arc',
    center: g.arcCenter,
    radius: g.arcRadius,
    startDeg: norm360(ccw ? startDeg : endDeg),
    endDeg: norm360(ccw ? endDeg : startDeg),
  };
}

/**
 * Place one arrowhead block at `anchor`, rotated so its native `-X` tail aligns
 * with `direction` (world Y-up: rotate by +atan2(dir.y, dir.x) — the canvas
 * renderer negates this only because screen Y points down). A zero-length
 * direction means "no arrow here" (radial single-arrow) → emit nothing.
 */
function pushArrowhead(
  out: DimBlockPrimitive[],
  blockName: string,
  anchor: Point2D,
  direction: Point2D,
  sizeWorld: number,
  side: 1 | 2,
): void {
  if (Math.hypot(direction.x, direction.y) < ZERO_DIRECTION_EPSILON) return;
  const block = getArrowheadBlock(blockName);
  if (block.geometry.length === 0) return; // 'none'

  const flip = side === 2 && block.flipOnSecondArrow;
  const angle = Math.atan2(direction.y, direction.x) + (flip ? Math.PI : 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const place = (p: ArrowheadPoint): Point2D => {
    const x = p[0] * sizeWorld;
    const y = p[1] * sizeWorld;
    return { x: anchor.x + (x * cos - y * sin), y: anchor.y + (x * sin + y * cos) };
  };

  for (const prim of block.geometry) {
    switch (prim.kind) {
      case 'line':
        out.push({ kind: 'line', a: place(prim.from), b: place(prim.to) });
        break;
      case 'triangle': {
        const v1 = place(prim.v1);
        const v2 = place(prim.v2);
        const v3 = place(prim.v3);
        if (prim.solid) {
          out.push({ kind: 'fill', points: [v1, v2, v3] });
        } else {
          out.push({ kind: 'line', a: v1, b: v2 });
          out.push({ kind: 'line', a: v2, b: v3 });
          out.push({ kind: 'line', a: v3, b: v1 });
        }
        break;
      }
      case 'circle':
        // DXF CIRCLE is an outline; a solid dot renders as a small ring (acceptable
        // — dot arrowheads are rare and the entity is tiny). Center already placed.
        out.push({ kind: 'circle', center: place(prim.center), radius: prim.radius * sizeWorld });
        break;
    }
  }
}
