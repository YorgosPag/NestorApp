/**
 * ADR-656 M10 — survey-point label configuration (data only, no logic).
 *
 * The presentation layer over the raw survey points: WHICH fields get drawn on the plan
 * and on WHICH layers. Layer NAMES are structural DXF identifiers (like the contour layers
 * in `contour-config.ts`), so they live as config constants — NOT `t()` keys (N.11).
 *
 * Big-player selectivity (Civil 3D COGO «Point Label Style» / Trimble / Carlson): a spot
 * height shows ONLY its elevation (a dot + the decimal, `•103.72`); the full X,Y is written
 * ONLY at the parcel boundary vertices, never at every ground point. `DEFAULT_POINT_LABEL_OPTS`
 * encodes that default: elevation on, everything else off.
 *
 * Units: canonical mm (ADR-462). Elevations are formatted in metres for the surveyor (÷1000).
 */

/** DXF layer name for spot elevation (Z) labels + the point node — structural id, not UI copy. */
export const TOPO_POINT_ELEV_LAYER_NAME = 'TOPO-POINT-ELEV' as const;
/** DXF layer name for feature-code labels. */
export const TOPO_POINT_CODE_LAYER_NAME = 'TOPO-POINT-CODE' as const;
/** DXF layer name for point-number labels. */
export const TOPO_POINT_NUM_LAYER_NAME = 'TOPO-POINT-NUM' as const;
/** DXF layer name for boundary-vertex X,Y(+Z) labels. */
export const TOPO_BOUNDARY_XY_LAYER_NAME = 'TOPO-BOUNDARY-XY' as const;

/** Default label colours (survey convention: black-ish text, distinct boundary highlight). */
export const TOPO_POINT_ELEV_COLOR = '#1A1A1A' as const; // near-black — the readable default
export const TOPO_POINT_CODE_COLOR = '#2E7D32' as const; // green — feature/figure code
export const TOPO_POINT_NUM_COLOR = '#555555' as const; // grey — secondary identifier
export const TOPO_BOUNDARY_XY_COLOR = '#8B0000' as const; // dark red — legal boundary vertices

/** Default text height (mm) for point labels — smaller than contour labels (denser scatter). */
export const TOPO_POINT_TEXT_HEIGHT_MM = 200 as const;

/**
 * Planimetric offset (mm) of a text label from its point/vertex, so the glyphs sit BESIDE
 * the node instead of on top of it. Simple fixed offset — auto-declutter is a future
 * differentiator (ADR-656 §5), deliberately not attempted in M10.
 */
export const TOPO_POINT_LABEL_OFFSET_MM = 250 as const;

/** Decimal places for the metre-formatted spot elevation (survey default: cm precision). */
export const TOPO_POINT_ELEV_DECIMALS = 2 as const;

/** The bullet that precedes a spot elevation, `•103.72` — the universal spot-height glyph. */
export const TOPO_SPOT_BULLET = '•' as const;

/**
 * WHICH fields the label pass draws. Three independent toggles (Civil 3D point-label style):
 *   - `showElevation`      — spot Ζ (dot + decimal) on EVERY point. The default.
 *   - `showPointNumberCode`— the point number and/or feature code beside each point.
 *   - `showBoundaryXy`     — full X,Y(+Z) + vertex number, ONLY at the boundary vertices.
 * X,Y is NEVER written at the 121 ground points — that is the whole point of the milestone.
 */
export interface PointLabelOptions {
  readonly showElevation: boolean;
  readonly showPointNumberCode: boolean;
  readonly showBoundaryXy: boolean;
}

/** Default = only Ζ (the big-player spot-height default). */
export const DEFAULT_POINT_LABEL_OPTS: PointLabelOptions = {
  showElevation: true,
  showPointNumberCode: false,
  showBoundaryXy: false,
};
