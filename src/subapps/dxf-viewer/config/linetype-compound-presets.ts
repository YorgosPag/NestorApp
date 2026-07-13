/**
 * Compound linetype presets — ADR-642 Φ5 (#9, MicroStation compound line styles).
 *
 * Ready-made multi-layer compounds the user can drop into the pattern editor: a **road**
 * (two parallel solid rails) and a **railway** (two rails + centred cross-ties). Each preset
 * builds a fresh `LinePatternLayer[]` (deep-owned, mutable copies) so applying it never shares
 * references with the catalog. Pure data/config (no logic) → outside the 500-line limit (N.7.1).
 *
 * FULL SSoT: a preset is just authored `LinePatternLayer`s — it flows through the SAME
 * `layersToComplex` bridge + `strokeStyledPolyline` render the free-form editor uses. No second
 * compound mechanism. The tie ticks reuse the `tick` glyph from `linetype-symbol-catalog` (Φ3).
 */

import {
  type LinePatternLayer,
  DEFAULT_SEGMENT_LENGTH_MM,
} from './line-pattern-segments';

// ── Real-world standard-gauge railway dimensions (mm) — Giorgio 2026-07-13, sourced ──
// Track gauge = 1435 mm (inner faces of the rail heads). Rail head width (UIC 60/60E1) = 72 mm, so the
// distance between the two rail **centre axes** = 1435 + 72 = 1507 mm. A rail sits at ±half that.
const RAIL_CENTRE_TO_CENTRE_MM = 1507;
const RAIL_HALF_GAUGE_MM = RAIL_CENTRE_TO_CENTRE_MM / 2; // 753.5 mm

// Sleeper (crosstie) centre-to-centre spacing — mainline standard 650 mm (±25). The rails rest on the
// sleepers; consecutive sleeper centres are this far apart along the track.
const TIE_SPACING_MM = 650;

// Sleeper length (standard-gauge concrete sleeper) = 2600 mm → the perpendicular height of the tick glyph
// (unit-space nominal height 1.0, so `scale` = height in mm). The sleeper spans beyond both rails.
const TIE_LENGTH_MM = 2600;

/** Half the road double-line separation (mm). */
const ROAD_HALF_SEPARATION_MM = 0.5;

/** A continuous solid layer (one dash, no gap → drawn end-to-end) at a perpendicular offset. */
function solidRail(offsetMm: number): LinePatternLayer {
  return { segments: [{ kind: 'dash', lengthMm: DEFAULT_SEGMENT_LENGTH_MM }], offsetMm };
}

/** One compound preset — a stable id + i18n label key + a fresh-layers builder. */
export interface CompoundPreset {
  readonly id: string;
  /** i18n key suffix (resolved under the editor's `presets.*` namespace). */
  readonly labelKey: string;
  /** Build a fresh, deep-owned `LinePatternLayer[]` (never shares refs with the catalog). */
  readonly build: () => LinePatternLayer[];
}

export const COMPOUND_PRESETS: readonly CompoundPreset[] = [
  {
    id: 'road',
    labelKey: 'road',
    build: () => [solidRail(ROAD_HALF_SEPARATION_MM), solidRail(-ROAD_HALF_SEPARATION_MM)],
  },
  {
    id: 'railway',
    labelKey: 'railway',
    build: () => [
      solidRail(RAIL_HALF_GAUGE_MM),
      solidRail(-RAIL_HALF_GAUGE_MM),
      {
        // Centre line carrying perpendicular cross-ties (sleepers): the vertical `tick` glyph repeated as
        // a side symbol (Φ3) between gaps — a railroad's ties at their real 650 mm centre-to-centre spacing
        // (the near-zero-length tick makes the gap ≈ the tie period), each 2600 mm long (spanning the rails).
        segments: [
          { kind: 'gap', lengthMm: TIE_SPACING_MM },
          { kind: 'symbol', glyphId: 'tick', role: 'side', scale: TIE_LENGTH_MM, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
        ],
        offsetMm: 0,
      },
    ],
  },
];

/** All compound presets in catalog order — the editor's preset-picker source. */
export function listCompoundPresets(): readonly CompoundPreset[] {
  return COMPOUND_PRESETS;
}
