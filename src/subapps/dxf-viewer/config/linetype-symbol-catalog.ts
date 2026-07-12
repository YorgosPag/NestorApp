/**
 * linetype-symbol-catalog — ADR-642 §6.3 / Φ3: builtin symbol library for complex
 * linetypes (`──×──×──` φράχτης, batting μόνωση, βέλος φοράς, …).
 *
 * A complex linetype can embed **symbols** (#3): a `SymbolElement.glyphId` references
 * a glyph in THIS catalog. Each glyph is authored as **unit-space vector geometry**
 * reusing the SAME `AnnotationSymbolPrimitive` vocabulary the annotation-symbol library
 * uses (`line·polyline·circle·arc`) — NOT a rasterised `Path2D` — so it is testable in
 * node, scales/rotates crisply at any zoom, and shares the ONE `stampSymbolPrimitive`
 * painter (N.18, Boy-Scout). Unit space: `1.0` = nominal glyph height, `+Y` = up,
 * `[0,0]` = centre (mirror `annotation-symbol-catalog.ts`).
 *
 * Static, code-shipped catalog (mirror `linetype-iso-catalog` / `annotation-symbol-catalog`):
 * builtin seed only. A mutable registry (user-authored glyphs, `.shx` import) is a later
 * phase (ADR-642 §9.1 — out of scope now), exactly as `LinetypeRegistry` layered
 * ISO-baseline-then-runtime. Data file (geometry only) → no 500-line limit (N.7.1).
 *
 * Ids are stable camelCase strings (NEVER enterprise ids — those are for persisted
 * Firestore docs, N.6). The builtin seed = the topographic/utility symbols Giorgio asked
 * for: `×` `*` `+` `○` `□` tick, βέλος, μόνωση, δέντρο.
 *
 * @see config/annotation-symbol-catalog.ts — sibling unit-space glyph catalog + primitives
 * @see rendering/entities/shared/symbol-primitive-stamp.ts — the shared painter
 * @see rendering/linetype/complex-symbol-draw.ts — places a glyph along the line tangent
 */

import type { AnnotationSymbolPrimitive } from './annotation-symbol-catalog';

/** A builtin linetype symbol glyph — unit-space vector geometry + its UI label key. */
export interface LinetypeSymbolDefinition {
  /** Stable catalog id (camelCase). Referenced by `SymbolElement.glyphId`. */
  readonly id: string;
  /** i18n key suffix for the UI label (picker) — resolved under the editor namespace. */
  readonly labelKey: string;
  /** Unit-space glyph geometry (1.0 = nominal height, +Y = up, centred at origin). */
  readonly geometry: readonly AnnotationSymbolPrimitive[];
  /** Provenance (builtin vs future user/import). */
  readonly origin: 'builtin';
}

// ──────────────────────────────────────────────────────────────────────────────
// Geometry helpers (unit space) — authored ONCE so a stroke is never hand-repeated
// ──────────────────────────────────────────────────────────────────────────────

/** A straight stroke between two unit-space points. */
function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): AnnotationSymbolPrimitive {
  return { kind: 'line', from: [x1, y1], to: [x2, y2] };
}

/** A diameter stroke through the origin at `angleDeg`, half-length `h` (spoke SSoT). */
function spoke(angleDeg: number, h: number): AnnotationSymbolPrimitive {
  const a = (angleDeg * Math.PI) / 180;
  const cx = Math.cos(a) * h;
  const cy = Math.sin(a) * h;
  return { kind: 'line', from: [-cx, -cy], to: [cx, cy] };
}

// ──────────────────────────────────────────────────────────────────────────────
// Catalog registry
// ──────────────────────────────────────────────────────────────────────────────

export const LINETYPE_SYMBOL_CATALOG: Readonly<Record<string, LinetypeSymbolDefinition>> = {
  /** Διαγώνιος σταυρός `×` — ο κλασικός τοπογραφικός φράχτης (`──×──×──`). */
  cross: {
    id: 'cross',
    labelKey: 'cross',
    geometry: [spoke(45, 0.5), spoke(135, 0.5)],
    origin: 'builtin',
  },

  /** Σταυρός `+` — utility/κάνναβος. */
  plus: {
    id: 'plus',
    labelKey: 'plus',
    geometry: [spoke(0, 0.5), spoke(90, 0.5)],
    origin: 'builtin',
  },

  /** Αστερίσκος `*` — 6 ακτίνες (φράχτης/βλάστηση). */
  asterisk: {
    id: 'asterisk',
    labelKey: 'asterisk',
    geometry: [spoke(0, 0.5), spoke(60, 0.5), spoke(120, 0.5)],
    origin: 'builtin',
  },

  /** Κύκλος `○` — hollow (όρια/κόμβοι). */
  circle: {
    id: 'circle',
    labelKey: 'circle',
    geometry: [{ kind: 'circle', center: [0, 0], radius: 0.45, solid: false }],
    origin: 'builtin',
  },

  /** Τετράγωνο `□` — hollow (utility marker). */
  square: {
    id: 'square',
    labelKey: 'square',
    geometry: [
      {
        kind: 'polyline',
        points: [
          [-0.42, -0.42],
          [0.42, -0.42],
          [0.42, 0.42],
          [-0.42, 0.42],
        ],
        closed: true,
        solid: false,
      },
    ],
    origin: 'builtin',
  },

  /** Παυλίτσα — κάθετη short mark στη γραμμή (όρια/βαθμονόμηση). */
  tick: {
    id: 'tick',
    labelKey: 'tick',
    geometry: [line(0, -0.5, 0, 0.5)],
    origin: 'builtin',
  },

  /** Βέλος φοράς — γεμάτη κεφαλή προς +X (ακολουθεί την κατεύθυνση της γραμμής). */
  arrow: {
    id: 'arrow',
    labelKey: 'arrow',
    geometry: [
      {
        kind: 'polyline',
        points: [
          [0.5, 0],
          [-0.1, 0.28],
          [-0.1, -0.28],
        ],
        closed: true,
        solid: true,
      },
    ],
    origin: 'builtin',
  },

  /** Μόνωση — γωνιώδες zigzag (batting/thermal· repeat κατά μήκος = συνεχής κυματισμός). */
  insulation: {
    id: 'insulation',
    labelKey: 'insulation',
    geometry: [
      {
        kind: 'polyline',
        points: [
          [-0.5, 0],
          [-0.25, 0.4],
          [0, -0.4],
          [0.25, 0.4],
          [0.5, 0],
        ],
        closed: false,
        solid: false,
      },
    ],
    origin: 'builtin',
  },

  /** Δέντρο/φυλλωσιά — τόξο-scallop (canopy bump· repeat = φράχτης βλάστησης). */
  tree: {
    id: 'tree',
    labelKey: 'tree',
    geometry: [
      // canopy bump (top scallop· angles chosen so the shared stamper's world-CCW→screen
      // Y-flip sweeps OVER the top) + a short trunk tick down to the line
      { kind: 'arc', center: [0, -0.05], radius: 0.45, startAngle: 160, endAngle: 20 },
      line(0, -0.05, 0, -0.4),
    ],
    origin: 'builtin',
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Lookup + enumeration (mirror the annotation-symbol catalog)
// ──────────────────────────────────────────────────────────────────────────────

/** The default glyph id a fresh symbol row / an unknown reference falls back to. */
export const DEFAULT_LINETYPE_SYMBOL_ID = 'cross';

/**
 * Resolve a symbol glyph by id. Unknown ids fall back to `cross` so a stale/renamed
 * reference (or a `.shx` shape number we don't ship) still renders something.
 */
export function getLinetypeSymbol(id: string): LinetypeSymbolDefinition {
  const found = LINETYPE_SYMBOL_CATALOG[id];
  if (found) return found;
  const fallback = LINETYPE_SYMBOL_CATALOG[DEFAULT_LINETYPE_SYMBOL_ID];
  if (!fallback) throw new Error('LINETYPE_SYMBOL_FALLBACK_MISSING');
  return fallback;
}

/** All catalog glyphs in insertion order — the editor's symbol-picker source. */
export function listLinetypeSymbols(): readonly LinetypeSymbolDefinition[] {
  return Object.values(LINETYPE_SYMBOL_CATALOG);
}

/** Every builtin glyph id (stable order) — for the picker + validation. */
export function listLinetypeSymbolIds(): readonly string[] {
  return Object.keys(LINETYPE_SYMBOL_CATALOG);
}
