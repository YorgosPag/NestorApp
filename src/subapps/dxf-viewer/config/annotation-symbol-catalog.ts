/**
 * ADR-583 — Annotation Symbol catalog SSoT (Βιβλιοθήκη Συμβόλων Σχεδίασης).
 *
 * Static, code-shipped registry of drawing-annotation glyphs (North arrow first;
 * scale bar / section mark to follow). Modelled 1:1 on the dimension arrowhead
 * catalog (`systems/dimensions/dim-arrowhead-blocks.ts`): each definition is
 * **unit-space** vector geometry stamped by a uniform draw loop — no per-symbol
 * special-case render code.
 *
 * ## Unit space
 * - `1.0` = the symbol's nominal paper height (`AnnotationSymbolEntity.sizeMm`).
 * - `+Y` points to the glyph's authored "north" (up); `entity.rotation` rotates
 *   the whole glyph at render time.
 * - `[0, 0]` = the glyph centre (the entity's anchor / insertion reference).
 *
 * Catalog ids are stable camelCase strings (e.g. `northArrowSimple`) — NEVER
 * enterprise ids (those are reserved for mutable, persisted Firestore docs, N.6).
 *
 * @see config/linetype-iso-catalog.ts — sibling static catalog pattern
 * @see systems/dimensions/dim-arrowhead-blocks.ts — the unit-space glyph template
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { AnnotationSymbolKind } from '../types/annotation-symbol';

// ──────────────────────────────────────────────────────────────────────────────
// Geometry primitives (unit space)
// ──────────────────────────────────────────────────────────────────────────────

export type AnnotationSymbolPoint = readonly [x: number, y: number];

export interface AnnotationSymbolLine {
  readonly kind: 'line';
  readonly from: AnnotationSymbolPoint;
  readonly to: AnnotationSymbolPoint;
}

export interface AnnotationSymbolPolyline {
  readonly kind: 'polyline';
  readonly points: readonly AnnotationSymbolPoint[];
  /** Close the path back to the first point. */
  readonly closed: boolean;
  /** True = fill the closed area; false = stroke-only. Ignored when `!closed`. */
  readonly solid: boolean;
}

export interface AnnotationSymbolCircle {
  readonly kind: 'circle';
  readonly center: AnnotationSymbolPoint;
  readonly radius: number;
  readonly solid: boolean;
}

/**
 * A circular arc segment (unit space). Angles are DXF-style **world-CCW degrees**
 * (0° = +X, 90° = +Y), matching the `circle` primitive's world frame — the
 * renderer negates them for the canvas Y-flip (mirror `ArcRenderer`). Used for
 * revision-cloud scallops and rounded callout leaders.
 */
export interface AnnotationSymbolArc {
  readonly kind: 'arc';
  readonly center: AnnotationSymbolPoint;
  readonly radius: number;
  /** Start angle, world-CCW degrees. */
  readonly startAngle: number;
  /** End angle, world-CCW degrees (swept CCW from `startAngle`). */
  readonly endAngle: number;
}

/**
 * A text label baked into the glyph (unit space) — e.g. the letter in a grid
 * bubble, the number in a callout, the elevation value. `heightFrac` is a
 * fraction of the glyph's nominal paper height (`sizeMm`), so the label stays
 * proportional and annotative together with the geometry (never a second,
 * drifting `paperHeightToModel` call). Text is drawn upright by default so
 * numbers/letters stay readable even when the whole symbol is rotated
 * (`uprightOnRotate`); set it `false` to let the label rotate with the glyph.
 */
export interface AnnotationSymbolText {
  readonly kind: 'text';
  readonly at: AnnotationSymbolPoint;
  readonly value: string;
  /** Cap height as a fraction of the glyph's nominal paper height (0–1). */
  readonly heightFrac: number;
  readonly align?: CanvasTextAlign;
  readonly baseline?: CanvasTextBaseline;
  readonly bold?: boolean;
  /** Keep the label horizontal even when the entity is rotated (default true). */
  readonly uprightOnRotate?: boolean;
}

export type AnnotationSymbolPrimitive =
  | AnnotationSymbolLine
  | AnnotationSymbolPolyline
  | AnnotationSymbolCircle
  | AnnotationSymbolArc
  | AnnotationSymbolText;

// ──────────────────────────────────────────────────────────────────────────────
// Definition
// ──────────────────────────────────────────────────────────────────────────────

export interface AnnotationSymbolDefinition {
  /** Stable catalog id (camelCase). Referenced by `AnnotationSymbolEntity.symbolId`. */
  readonly id: string;
  /** Symbol family. */
  readonly kind: AnnotationSymbolKind;
  /** i18n key for the UI label (ribbon picker / properties). No hardcoded text (N.11). */
  readonly labelKey: string;
  /** Unit-space glyph geometry (1.0 = nominal paper height). */
  readonly geometry: readonly AnnotationSymbolPrimitive[];
  /** Provenance (built-in vs future user/import). */
  readonly origin: 'builtin';
}

// ──────────────────────────────────────────────────────────────────────────────
// Geometry factory helpers (keep definitions readable)
// ──────────────────────────────────────────────────────────────────────────────

/** The letter "N" as three vector strokes (language-neutral CAD convention). */
function northLetter(): AnnotationSymbolPolyline {
  return {
    kind: 'polyline',
    // bottom-left → top-left → bottom-right → top-right
    points: [
      [-0.1, 0.4],
      [-0.1, 0.5],
      [0.1, 0.4],
      [0.1, 0.5],
    ],
    closed: false,
    solid: false,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Catalog registry
// ──────────────────────────────────────────────────────────────────────────────

export const ANNOTATION_SYMBOL_CATALOG: Readonly<Record<string, AnnotationSymbolDefinition>> = {
  /** Classic surveyor's north arrow: filled arrowhead on a shaft, "N" on top. */
  northArrowSimple: {
    id: 'northArrowSimple',
    kind: 'north-arrow',
    labelKey: 'annotationSymbol.northArrow.simple',
    geometry: [
      // shaft
      { kind: 'line', from: [0, -0.5], to: [0, 0.06] },
      // filled arrowhead (tip up)
      {
        kind: 'polyline',
        points: [
          [0, 0.34],
          [0.12, 0.06],
          [-0.12, 0.06],
        ],
        closed: true,
        solid: true,
      },
      northLetter(),
    ],
    origin: 'builtin',
  },

  /** 4-point compass rose: hollow star, filled north petal, centre hub. */
  northArrowStar: {
    id: 'northArrowStar',
    kind: 'north-arrow',
    labelKey: 'annotationSymbol.northArrow.star',
    geometry: [
      // full 4-point star outline (hollow)
      {
        kind: 'polyline',
        points: [
          [0, 0.5],
          [0.11, 0.11],
          [0.5, 0],
          [0.11, -0.11],
          [0, -0.5],
          [-0.11, -0.11],
          [-0.5, 0],
          [-0.11, 0.11],
        ],
        closed: true,
        solid: false,
      },
      // filled north petal
      {
        kind: 'polyline',
        points: [
          [0, 0.5],
          [0.11, 0.11],
          [-0.11, 0.11],
        ],
        closed: true,
        solid: true,
      },
      // centre hub
      { kind: 'circle', center: [0, 0], radius: 0.05, solid: false },
    ],
    origin: 'builtin',
  },

  /** Compass rose: ring + filled north pointer + N/E/S/W cardinal letters. */
  northArrowCompass: {
    id: 'northArrowCompass',
    kind: 'north-arrow',
    labelKey: 'annotationSymbol.northArrow.compass',
    geometry: [
      // outer ring
      { kind: 'circle', center: [0, 0], radius: 0.34, solid: false },
      // filled north pointer (up)
      {
        kind: 'polyline',
        points: [
          [0, 0.34],
          [0.09, 0],
          [-0.09, 0],
        ],
        closed: true,
        solid: true,
      },
      // hollow south pointer (down)
      {
        kind: 'polyline',
        points: [
          [0, -0.34],
          [0.09, 0],
          [-0.09, 0],
        ],
        closed: true,
        solid: false,
      },
      // cardinal letters (upright, sized as a fraction of the glyph)
      { kind: 'text', at: [0, 0.46], value: 'N', heightFrac: 0.2, bold: true },
      { kind: 'text', at: [0.46, 0], value: 'E', heightFrac: 0.16 },
      { kind: 'text', at: [0, -0.46], value: 'S', heightFrac: 0.16 },
      { kind: 'text', at: [-0.46, 0], value: 'W', heightFrac: 0.16 },
    ],
    origin: 'builtin',
  },

  /** Minimalist circled "N" with an up arrow — common on modern architectural sheets. */
  northArrowCircledN: {
    id: 'northArrowCircledN',
    kind: 'north-arrow',
    labelKey: 'annotationSymbol.northArrow.circledN',
    geometry: [
      { kind: 'circle', center: [0, 0], radius: 0.4, solid: false },
      // up arrow through the circle
      { kind: 'line', from: [0, -0.18], to: [0, 0.26] },
      {
        kind: 'polyline',
        points: [
          [0, 0.4],
          [0.11, 0.22],
          [-0.11, 0.22],
        ],
        closed: true,
        solid: true,
      },
      // big centred "N"
      { kind: 'text', at: [0, -0.02], value: 'N', heightFrac: 0.3, bold: true },
    ],
    origin: 'builtin',
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Lookup with fallback
// ──────────────────────────────────────────────────────────────────────────────

const FALLBACK_SYMBOL_ID = 'northArrowSimple';

/**
 * Resolve an annotation symbol definition by id. Unknown ids fall back to
 * `northArrowSimple` so a stale/renamed reference still renders something.
 */
export function getAnnotationSymbol(id: string): AnnotationSymbolDefinition {
  const found = ANNOTATION_SYMBOL_CATALOG[id];
  if (found) return found;
  const fallback = ANNOTATION_SYMBOL_CATALOG[FALLBACK_SYMBOL_ID];
  if (!fallback) {
    throw new Error('ANNOTATION_SYMBOL_FALLBACK_MISSING');
  }
  return fallback;
}

/** All catalog definitions (for UI enumeration). */
export function listAnnotationSymbols(): readonly AnnotationSymbolDefinition[] {
  return Object.values(ANNOTATION_SYMBOL_CATALOG);
}

/** Catalog definitions of one family (e.g. all north arrows) — ribbon picker source. */
export function listAnnotationSymbolsByKind(
  kind: AnnotationSymbolKind,
): readonly AnnotationSymbolDefinition[] {
  return Object.values(ANNOTATION_SYMBOL_CATALOG).filter((d) => d.kind === kind);
}

/** Default catalog id for a family (first entry) — used when a tool starts. */
export function defaultAnnotationSymbolId(kind: AnnotationSymbolKind): string {
  return listAnnotationSymbolsByKind(kind)[0]?.id ?? FALLBACK_SYMBOL_ID;
}
