/**
 * ADR-650 Milestone 1 — Topography / contour configuration (data only, no logic).
 *
 * Layer NAMES here follow the established `config/layer-config.ts` precedent
 * (`DXF_DEFAULT_LAYER = '0'`): DXF layer names are structural identifiers, not
 * user-facing UI copy, so they live as config constants — NOT `t()` keys (N.11).
 * The layer names mirror the AutoCAD/Civil 3D convention for contour layers.
 *
 * Units: canonical mm (ADR-462). Survey elevations are stored in mm; labels are
 * formatted in metres for the surveyor (÷1000), the field convention.
 */

import type { LineweightMm } from '../../types/scene-types';

/** Canonical contour-generation parameters. */
export interface ContourConfig {
  /** Minor contour interval in canonical mm (e.g. 500 = 0.5 m). Must be > 0. */
  readonly intervalMm: number;
  /** Every N-th contour is a MAJOR (index) contour. e.g. 5 → majors at each 5·interval. */
  readonly majorEvery: number;
  /**
   * Elevation (mm) that the interval grid is anchored to. Levels are generated at
   * `baseElevationMm + k·intervalMm`. Default 0 (contours at 0, ±interval, …).
   */
  readonly baseElevationMm: number;
  /** Emit elevation TextEntity labels on major contours. */
  readonly labelMajors: boolean;
  /** Decimal places for the metre-formatted elevation label. */
  readonly labelDecimals: number;
}

/** Sensible topographic defaults (0.5 m minor, 2.5 m major index every 5th). */
export const DEFAULT_CONTOUR_CONFIG: ContourConfig = {
  intervalMm: 500,
  majorEvery: 5,
  baseElevationMm: 0,
  labelMajors: true,
  labelDecimals: 2,
};

/**
 * ADR-650 M3 — display style of the SAME contours (non-destructive; the raw
 * `ContourLine` geometry and the contour entities' `vertices` are identical in
 * both). `exact` = straight chords through the surveyed crossings (the legal /
 * Κτηματολόγιο default). `smooth` = a fitted Catmull-Rom curve DISPLAYED through
 * those same vertices (Civil 3D «Contour Smoothing»). Export always reads the
 * exact vertices, so smoothing never reaches a legal deliverable.
 */
export type ContourDisplayStyle = 'exact' | 'smooth';

/** Default contour display style — EXACT (smoothing is an opt-in presentation choice). */
export const DEFAULT_CONTOUR_DISPLAY_STYLE: ContourDisplayStyle = 'exact';

/** DXF layer name for MINOR (intermediate) contours — structural id, not UI copy. */
export const TOPO_MINOR_LAYER_NAME = 'TOPO-CONTOUR-MINOR' as const;
/** DXF layer name for MAJOR (index) contours. */
export const TOPO_MAJOR_LAYER_NAME = 'TOPO-CONTOUR-MAJOR' as const;
/** DXF layer name for elevation labels. */
export const TOPO_LABEL_LAYER_NAME = 'TOPO-CONTOUR-LABEL' as const;

/** Default contour layer colours (AutoCAD topo convention: brown family). */
export const TOPO_MINOR_COLOR = '#B5651D' as const; // light brown
export const TOPO_MAJOR_COLOR = '#8B4513' as const; // saddle brown (heavier)
export const TOPO_LABEL_COLOR = '#8B4513' as const;

/**
 * ADR-656 M9 — index/intermediate lineweights (mm). The universal cartographic
 * rule (Civil 3D / USGS / ΤΕΕ): MAJOR (index) contours are drawn ~2.5–3× heavier
 * than the MINOR (intermediate) ones so the reader can count elevation quickly.
 * ISO catalog values (`LineweightMm`). Applied ByLayer — the contour entities
 * stay lineweight-free and inherit these via the `resolveEntityStyle` cascade.
 */
export const TOPO_MAJOR_LINEWEIGHT_MM: LineweightMm = 0.5; // index — heavy
export const TOPO_MINOR_LINEWEIGHT_MM: LineweightMm = 0.18; // intermediate — hairline (~2.8×)

/** Default text height (mm) for elevation labels. */
export const TOPO_LABEL_HEIGHT_MM = 300 as const;
