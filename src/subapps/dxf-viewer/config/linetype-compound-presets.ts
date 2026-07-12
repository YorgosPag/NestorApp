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

/** Half the rail gauge (mm) — a rail sits at ±this offset from the centre line. */
const RAIL_HALF_GAUGE_MM = 0.75;

/** Half the road double-line separation (mm). */
const ROAD_HALF_SEPARATION_MM = 0.5;

/** Cross-tie spacing (mm gap between consecutive ticks) + the tick glyph scale. */
const TIE_GAP_MM = 4;
const TIE_SCALE = 1.6;

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
        // Centre line carrying perpendicular cross-ties: the vertical `tick` glyph repeated as a
        // side symbol (Φ3) between gaps — exactly a railroad's ties.
        segments: [
          { kind: 'gap', lengthMm: TIE_GAP_MM },
          { kind: 'symbol', glyphId: 'tick', role: 'side', scale: TIE_SCALE, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
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
