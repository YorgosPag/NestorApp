/**
 * ADR-650 / ADR-920 — contour-generation parameters (data only, no logic).
 *
 * Moved here from `subapps/dxf-viewer/systems/topography/contour-config.ts` (ADR-920 Β1) so the
 * public plot listing generates contours with the SAME parameters. The DXF-only presentation
 * (layer names, colours, lineweights, label height) stays in the viewer file, which re-exports these.
 *
 * Units: canonical mm (ADR-462). Survey elevations are stored in mm; labels are
 * formatted in metres for the surveyor (÷1000), the field convention.
 *
 * @module lib/terrain/contour-config
 */

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
