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

// ─── ADR-720 — points measured in plan only ───────────────────────────────────

/**
 * What a spot label prints when the elevation was **never measured**.
 *
 * An em dash, not `0.00` and not an empty string. `0.00` is a lie that reads as a sea-level shot
 * and gets triangulated and priced; an empty label is indistinguishable from «nobody ran the
 * labels yet». The dash is the standard typographic statement of «no value here», it is what
 * Civil 3D's `*PROPERTY NOT SET*` means in one character, and — crucially — it is VISIBLE, so the
 * engineer can see at a glance which corners the surface does not know about.
 *
 * Not an i18n key (N.11): a punctuation mark carries no language, and this string is baked into a
 * DXF `text` entity — drawing content that must read identically in every locale, exactly like
 * `TOPO_SPOT_BULLET` above.
 */
export const TOPO_ELEVATION_ABSENT_LABEL = '—' as const;

/**
 * The point glyphs that tell the two kinds apart **at a glance, on the plan** (ADR-720).
 *
 * A filled dot for a measured shot; a hollow ring for a point that carries position only. This is
 * where we go past the big players rather than matching them: Carlson gets the same distinction
 * only after the surveyor tags the shots «Non-Surface» BY HAND, and Civil 3D only reveals it when
 * a surface rebuild reports missing elevations — after the fact, in a dialog. Here the absence of
 * Ζ *is* the tag, so the drawing shows the truth for free and nothing can be forgotten.
 *
 * The hollow/filled pairing is not arbitrary: it matches the surveying convention where an open
 * circle marks a monument or boundary corner and a filled dot marks a ground shot — which is
 * precisely what these two populations usually are.
 */
export const TOPO_POINT_MEASURED_STYLE = 'dot' as const;
export const TOPO_POINT_PLANIMETRIC_STYLE = 'circle' as const;

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
