/**
 * ADR-362 Phase A2 — Arrowhead block definitions (AutoCAD parity).
 *
 * Geometry expressed in **unit space**: 1.0 = `DIMSTYLE.dimasz` (mm paper).
 * Each block's insertion point is the **apex** (the tip touching the dim line
 * endpoint) at `[0, 0]`, with the tail extending toward the negative X axis
 * (i.e. the body of the arrow lives in x ∈ [-1, 0]). The renderer rotates each
 * arrow to align with the dim-line direction at render time (ADR-150 pattern).
 *
 * `flipOnSecondArrow`: most arrows are point-symmetric; only architecturalTick
 * + oblique need a 180° flip to point the right way at the second dim endpoint.
 *
 * Geometry primitives are kept deliberately minimal (line / triangle / circle)
 * so the renderer can stamp them with a uniform draw loop — no per-block
 * special-case code in `DimensionRenderer`.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Geometry primitives (unit space)
// ──────────────────────────────────────────────────────────────────────────────

export type ArrowheadPoint = readonly [x: number, y: number];

export interface ArrowheadLine {
  readonly kind: 'line';
  readonly from: ArrowheadPoint;
  readonly to: ArrowheadPoint;
}

export interface ArrowheadTriangle {
  readonly kind: 'triangle';
  readonly v1: ArrowheadPoint;
  readonly v2: ArrowheadPoint;
  readonly v3: ArrowheadPoint;
  /** True = filled fill, False = stroke-only outline. */
  readonly solid: boolean;
}

export interface ArrowheadCircle {
  readonly kind: 'circle';
  readonly center: ArrowheadPoint;
  readonly radius: number;
  readonly solid: boolean;
}

export type ArrowheadPrimitive = ArrowheadLine | ArrowheadTriangle | ArrowheadCircle;

// ──────────────────────────────────────────────────────────────────────────────
// Block definition
// ──────────────────────────────────────────────────────────────────────────────

export interface ArrowheadBlockDefinition {
  /** DXF block name (matches AutoCAD convention — lowercase camel for in-app use). */
  readonly name: string;
  /** UI labels (bilingual for left panel + ribbon dropdowns). */
  readonly displayName: { readonly en: string; readonly el: string };
  /** Primitive list rendered in unit space (1.0 = dimasz mm paper). */
  readonly geometry: readonly ArrowheadPrimitive[];
  /** True when the 2nd-arrow rendering needs a 180° rotation flip. */
  readonly flipOnSecondArrow: boolean;
  /** Convenience flag = block has at least one solid primitive. */
  readonly solid: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Geometry constants
// ──────────────────────────────────────────────────────────────────────────────

/** Half-width of standard mechanical arrowheads (15° half-angle equivalent). */
const ARROW_HALF_WIDTH = 0.15;
/** Dot/origin marker radius. */
const DOT_RADIUS = 0.18;
const DOT_SMALL_RADIUS = 0.09;
/** Box edge half-length. */
const BOX_HALF = 0.2;

// ──────────────────────────────────────────────────────────────────────────────
// Block factory helpers (keep definitions readable)
// ──────────────────────────────────────────────────────────────────────────────

function closedTriangle(solid: boolean): ArrowheadTriangle {
  return {
    kind: 'triangle',
    v1: [0, 0],
    v2: [-1, ARROW_HALF_WIDTH],
    v3: [-1, -ARROW_HALF_WIDTH],
    solid,
  };
}

function dotMarker(radius: number, solid: boolean): ArrowheadCircle {
  return { kind: 'circle', center: [-radius, 0], radius, solid };
}

function obliqueTick(): ArrowheadLine {
  // 45° tick rotated through apex — runs from upper-left to lower-right.
  return { kind: 'line', from: [-0.5, 0.5], to: [0.5, -0.5] };
}

function architecturalTick(): ArrowheadLine {
  return { kind: 'line', from: [-0.5, -0.5], to: [0.5, 0.5] };
}

// ──────────────────────────────────────────────────────────────────────────────
// Block registry — AutoCAD standard set
// ──────────────────────────────────────────────────────────────────────────────

export const ARROWHEAD_BLOCKS: Readonly<Record<string, ArrowheadBlockDefinition>> = {
  none: {
    name: 'none',
    displayName: { en: 'None', el: 'Καμία' },
    geometry: [],
    flipOnSecondArrow: false,
    solid: false,
  },

  closedFilled: {
    name: 'closedFilled',
    displayName: { en: 'Closed Filled', el: 'Πλήρες Κλειστό' },
    geometry: [closedTriangle(true)],
    flipOnSecondArrow: false,
    solid: true,
  },

  closedBlank: {
    name: 'closedBlank',
    displayName: { en: 'Closed Blank', el: 'Κενό Κλειστό' },
    geometry: [closedTriangle(false)],
    flipOnSecondArrow: false,
    solid: false,
  },

  closed: {
    name: 'closed',
    displayName: { en: 'Closed', el: 'Κλειστό' },
    // Outlined triangle + base line — distinguishes from `closedBlank`.
    geometry: [
      closedTriangle(false),
      { kind: 'line', from: [-1, ARROW_HALF_WIDTH], to: [-1, -ARROW_HALF_WIDTH] },
    ],
    flipOnSecondArrow: false,
    solid: false,
  },

  dot: {
    name: 'dot',
    displayName: { en: 'Dot', el: 'Τελεία' },
    geometry: [dotMarker(DOT_RADIUS, true)],
    flipOnSecondArrow: false,
    solid: true,
  },

  dotSmall: {
    name: 'dotSmall',
    displayName: { en: 'Dot Small', el: 'Μικρή Τελεία' },
    geometry: [dotMarker(DOT_SMALL_RADIUS, true)],
    flipOnSecondArrow: false,
    solid: true,
  },

  dotBlank: {
    name: 'dotBlank',
    displayName: { en: 'Dot Blank', el: 'Κενή Τελεία' },
    geometry: [dotMarker(DOT_RADIUS, false)],
    flipOnSecondArrow: false,
    solid: false,
  },

  dotSmallBlank: {
    name: 'dotSmallBlank',
    displayName: { en: 'Dot Small Blank', el: 'Μικρή Κενή Τελεία' },
    geometry: [dotMarker(DOT_SMALL_RADIUS, false)],
    flipOnSecondArrow: false,
    solid: false,
  },

  architecturalTick: {
    name: 'architecturalTick',
    displayName: { en: 'Architectural Tick', el: 'Αρχιτεκτονικό Tick' },
    geometry: [architecturalTick()],
    flipOnSecondArrow: true,
    solid: false,
  },

  oblique: {
    name: 'oblique',
    displayName: { en: 'Oblique', el: 'Λοξό' },
    geometry: [obliqueTick()],
    flipOnSecondArrow: true,
    solid: false,
  },

  open: {
    name: 'open',
    displayName: { en: 'Open', el: 'Ανοιχτό' },
    // V-shape (two lines from apex to wings).
    geometry: [
      { kind: 'line', from: [0, 0], to: [-1, ARROW_HALF_WIDTH] },
      { kind: 'line', from: [0, 0], to: [-1, -ARROW_HALF_WIDTH] },
    ],
    flipOnSecondArrow: false,
    solid: false,
  },

  openRightAngle: {
    name: 'openRightAngle',
    displayName: { en: 'Open Right-Angle', el: 'Ανοιχτό Ορθή Γωνία' },
    geometry: [
      { kind: 'line', from: [0, 0], to: [-0.7, 0.7] },
      { kind: 'line', from: [0, 0], to: [-0.7, -0.7] },
    ],
    flipOnSecondArrow: false,
    solid: false,
  },

  openSlanted: {
    name: 'openSlanted',
    displayName: { en: 'Open Slanted', el: 'Ανοιχτό Πλάγιο' },
    geometry: [
      { kind: 'line', from: [0, 0], to: [-1, 0.35] },
      { kind: 'line', from: [0, 0], to: [-1, -0.05] },
    ],
    flipOnSecondArrow: true,
    solid: false,
  },

  origin: {
    name: 'origin',
    displayName: { en: 'Origin Indicator', el: 'Δείκτης Αρχής' },
    // Hollow circle centered on apex — datum indicator.
    geometry: [{ kind: 'circle', center: [0, 0], radius: DOT_RADIUS, solid: false }],
    flipOnSecondArrow: false,
    solid: false,
  },

  origin2: {
    name: 'origin2',
    displayName: { en: 'Origin Indicator 2', el: 'Δείκτης Αρχής 2' },
    // Two concentric circles — alternate datum indicator.
    geometry: [
      { kind: 'circle', center: [0, 0], radius: DOT_RADIUS, solid: false },
      { kind: 'circle', center: [0, 0], radius: DOT_RADIUS * 0.6, solid: false },
    ],
    flipOnSecondArrow: false,
    solid: false,
  },

  box: {
    name: 'box',
    displayName: { en: 'Box', el: 'Κουτί' },
    geometry: [
      { kind: 'line', from: [-BOX_HALF, BOX_HALF], to: [BOX_HALF, BOX_HALF] },
      { kind: 'line', from: [BOX_HALF, BOX_HALF], to: [BOX_HALF, -BOX_HALF] },
      { kind: 'line', from: [BOX_HALF, -BOX_HALF], to: [-BOX_HALF, -BOX_HALF] },
      { kind: 'line', from: [-BOX_HALF, -BOX_HALF], to: [-BOX_HALF, BOX_HALF] },
    ],
    flipOnSecondArrow: false,
    solid: false,
  },

  boxFilled: {
    name: 'boxFilled',
    displayName: { en: 'Box Filled', el: 'Πλήρες Κουτί' },
    // Render via two triangles (renderer compositor handles filled polys).
    geometry: [
      {
        kind: 'triangle',
        v1: [-BOX_HALF, BOX_HALF],
        v2: [BOX_HALF, BOX_HALF],
        v3: [BOX_HALF, -BOX_HALF],
        solid: true,
      },
      {
        kind: 'triangle',
        v1: [-BOX_HALF, BOX_HALF],
        v2: [BOX_HALF, -BOX_HALF],
        v3: [-BOX_HALF, -BOX_HALF],
        solid: true,
      },
    ],
    flipOnSecondArrow: false,
    solid: true,
  },

  datumTriangle: {
    name: 'datumTriangle',
    displayName: { en: 'Datum Triangle', el: 'Τρίγωνο Αναφοράς' },
    // Equilateral-ish hollow triangle apex at origin, larger than closedBlank.
    geometry: [
      {
        kind: 'triangle',
        v1: [0, 0],
        v2: [-1, 0.5],
        v3: [-1, -0.5],
        solid: false,
      },
    ],
    flipOnSecondArrow: false,
    solid: false,
  },

  datumTriangleFilled: {
    name: 'datumTriangleFilled',
    displayName: { en: 'Datum Triangle Filled', el: 'Πλήρες Τρίγωνο Αναφοράς' },
    geometry: [
      {
        kind: 'triangle',
        v1: [0, 0],
        v2: [-1, 0.5],
        v3: [-1, -0.5],
        solid: true,
      },
    ],
    flipOnSecondArrow: false,
    solid: true,
  },

  integral: {
    name: 'integral',
    displayName: { en: 'Integral', el: 'Ολοκλήρωμα' },
    // S-curve approximated with 4 short segments — distinctive symbol.
    geometry: [
      { kind: 'line', from: [0, 0.5], to: [-0.3, 0.25] },
      { kind: 'line', from: [-0.3, 0.25], to: [-0.3, -0.25] },
      { kind: 'line', from: [-0.3, -0.25], to: [-0.6, -0.5] },
      { kind: 'line', from: [-0.6, -0.5], to: [-1, -0.5] },
    ],
    flipOnSecondArrow: true,
    solid: false,
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Lookup with fallback
// ──────────────────────────────────────────────────────────────────────────────

const FALLBACK_BLOCK_NAME = 'closedFilled';

/**
 * Resolve an arrowhead block by name. Unknown names fall back to `closedFilled`
 * (AutoCAD's default), matching the behavior of imported drawings that
 * reference custom blocks we don't recognize.
 */
export function getArrowheadBlock(name: string): ArrowheadBlockDefinition {
  const found = ARROWHEAD_BLOCKS[name];
  if (found) return found;
  const fallback = ARROWHEAD_BLOCKS[FALLBACK_BLOCK_NAME];
  if (!fallback) {
    throw new Error('ARROWHEAD_FALLBACK_MISSING');
  }
  return fallback;
}

/** All registered arrowhead block names (for UI dropdowns). */
export function listArrowheadBlockNames(): readonly string[] {
  return Object.keys(ARROWHEAD_BLOCKS);
}
