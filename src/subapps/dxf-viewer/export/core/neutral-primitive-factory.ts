/**
 * ADR-608 — Neutral primitive factory (SSoT for decomposed annotation output).
 *
 * A tiny set of builders that turn raw world-space geometry into the neutral
 * `Entity[]` the shared vector emitter (`print/vector/scene-vector-emitter.ts`)
 * AND the DXF ascii writer already understand (line / lwpolyline / circle / arc /
 * text / solid-fill hatch). Every builder inherits the SOURCE entity's plot style
 * (colour / ACI / lineweight / layer / visibility) so the decomposed primitives
 * render with the exact colour the annotation had on screen. Centralised here so
 * the annotation-symbol and scale-bar decomposers share ONE construction path
 * (N.18 — no per-decomposer entity literals drifting apart).
 *
 * Solid fills are emitted as a `hatch` carrying `dxfFaces` (z = 0 planar faces),
 * the SAME carrier `overlay-dxf-collector.ts` uses for BIM poché — so both the
 * vector emitter (`emitHatch` fills each face) and the DXF writer (`3DFACE`) draw
 * them without a new code path.
 *
 * @see print/vector/scene-vector-emitter.ts — the vector backend (input contract)
 * @see export/core/overlay-dxf-collector.ts — the solid-fill hatch carrier SSoT
 * @see export/core/annotation-to-primitives.ts — the sole caller (decomposers)
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  Entity,
  LineEntity,
  LWPolylineEntity,
  CircleEntity,
  ArcEntity,
  HatchEntity,
  TextEntity,
  LineweightMm,
} from '../../types/entities';

/**
 * Optional vertical-baseline hint the vector emitter honours for a decomposed
 * label. `TextEntity.alignment` carries the horizontal side; this carries the
 * vertical anchor (annotation glyph labels + scale-bar numerals want `middle`,
 * scene text keeps the default `alphabetic`). Absent ⇒ emitter default.
 */
export interface VectorTextBaselineHint {
  readonly vBaseline?: 'alphabetic' | 'top' | 'middle' | 'bottom';
}

/** A neutral text entity that may carry the emitter baseline hint. */
export type NeutralTextEntity = TextEntity & VectorTextBaselineHint;

/** Plot-style fields copied onto every decomposed primitive (mirror what the emitter reads). */
interface InheritedStyle {
  readonly layerId: string;
  readonly color?: string;
  readonly colorAci?: number;
  /** The ISO plot-width union, NOT a free number — it is copied straight off `Entity`. */
  readonly lineweightMm?: LineweightMm;
  readonly visible: boolean;
  /**
   * ADR-608 — grouping provenance: the SOURCE annotation/scale-bar id. Every
   * primitive of ONE symbol shares it so the TEK writer emits ONE shared
   * `<taglist>` tag (and the DXF writer ONE anonymous BLOCK) per symbol → the
   * symbol re-assembles as a single selectable unit in Tekton / AutoCAD.
   */
  readonly groupId: string;
}

/** Snapshot the source entity's plot style so each primitive renders identically. */
function inheritStyle(source: Entity): InheritedStyle {
  return {
    layerId: source.layerId,
    color: source.color,
    colorAci: source.colorAci,
    lineweightMm: source.lineweightMm,
    visible: source.visible ?? true,
    groupId: source.id,
  };
}

export function makeLine(source: Entity, id: string, start: Point2D, end: Point2D): LineEntity {
  return { ...inheritStyle(source), id, type: 'line', start, end };
}

export function makePolyline(
  source: Entity, id: string, vertices: readonly Point2D[], closed: boolean,
): LWPolylineEntity {
  return { ...inheritStyle(source), id, type: 'lwpolyline', vertices: [...vertices], closed };
}

export function makeCircle(source: Entity, id: string, center: Point2D, radius: number): CircleEntity {
  return { ...inheritStyle(source), id, type: 'circle', center, radius };
}

export function makeArc(
  source: Entity, id: string, center: Point2D, radius: number, startAngle: number, endAngle: number,
): ArcEntity {
  return { ...inheritStyle(source), id, type: 'arc', center, radius, startAngle, endAngle };
}

/**
 * Solid fill → `hatch` carrying one planar `dxfFaces` face (z = 0). Boundary paths
 * mirror the ring so the DXF native-hatch fallback still has a loop; the vector
 * emitter fills the face directly.
 */
export function makeSolidFill(source: Entity, id: string, ring: readonly Point2D[]): HatchEntity {
  const style = inheritStyle(source);
  const boundary = ring.map((p) => ({ x: p.x, y: p.y }));
  return {
    ...style,
    id,
    type: 'hatch',
    fillColor: style.color,
    patternType: 'solid',
    patternName: 'SOLID',
    boundaryPaths: [boundary],
    // ONE planar (z = 0) face — same carrier as ADR-505 §C poché; x/y in scene mm.
    // `dxfFaces` is an array OF faces (each face = a corner ring), so a single
    // polygon must be wrapped: `[ring]`, NOT the bare `ring` (else `emitHatch`
    // iterates corners, `corner.length` is undefined, and nothing fills).
    dxfFaces: [ring.map((p) => ({ x: p.x, y: p.y, zMm: 0 }))],
  } as HatchEntity;
}

export interface NeutralTextOptions {
  readonly position: Point2D;
  readonly text: string;
  /** Cap height in world units (model mm). */
  readonly height: number;
  readonly alignment: 'left' | 'center' | 'right';
  /** Rotation in degrees (0 = upright label). */
  readonly rotationDeg: number;
  readonly vBaseline: VectorTextBaselineHint['vBaseline'];
}

export function makeText(source: Entity, id: string, opts: NeutralTextOptions): NeutralTextEntity {
  return {
    ...inheritStyle(source),
    id,
    type: 'text',
    position: opts.position,
    text: opts.text,
    height: opts.height,
    alignment: opts.alignment,
    rotation: opts.rotationDeg,
    vBaseline: opts.vBaseline,
  };
}

/** Δειγματοληψία κλειστού κύκλου σε ring πολυγώνου (world space) — για solid-fill glyphs. */
const SOLID_CIRCLE_SEGMENTS = 32;

/**
 * Full-circle polygon (world space) — το ring που γεμίζει ένας solid κύκλος στα flat
 * backends (μέσω `makeSolidFill`). SSoT: το χρησιμοποιούν και τα annotation-symbol και τα
 * svg-glyph decomposers (N.18 — καμία δεύτερη υλοποίηση κύκλου-σε-πολύγωνο).
 */
export function circlePolygon(
  center: Point2D, radius: number, segments: number = SOLID_CIRCLE_SEGMENTS,
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}
