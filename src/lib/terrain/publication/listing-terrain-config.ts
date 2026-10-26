/**
 * ADR-920 Β2 — the knobs of the published terrain, in ONE place (data only, no logic).
 *
 * @module lib/terrain/publication/listing-terrain-config
 */

/**
 * Slope class upper bounds, percent: `<5` gentle · `5–15` moderate · `15–25` steep · `≥25` very steep.
 *
 * ⚠️ INDICATIVE, not an earthworks price. Jurisdictions disagree on where «steep» begins (Cupertino
 * calls 15–30 % «very significant», Washington County UT starts hillside rules at 20 %), so the bands
 * live here, the viewer labels them as indicative, and the snapshot carries the bands it was built with.
 */
export const LISTING_TERRAIN_SLOPE_BANDS_PCT: readonly number[] = [5, 15, 25];

/**
 * Contour interval candidates, metres — the cartographic ladder (1·2·2.5·5 × 10ⁿ). The builder takes
 * the FINEST one that keeps the minor contours under {@link LISTING_TERRAIN_MAX_MINOR_LEVELS}: a flat
 * plot gets 0.1 m contours, a hillside gets 2 m ones, both stay readable.
 */
export const LISTING_TERRAIN_CONTOUR_LADDER_M: readonly number[] = [
  0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50,
];

/** At most this many minor contour levels across the whole relief. */
export const LISTING_TERRAIN_MAX_MINOR_LEVELS = 30;

/** Every N-th contour is an index contour; intervals of the 2.5 family index every 4th (whole metres). */
export const LISTING_TERRAIN_MAJOR_EVERY_DEFAULT = 5;
export const LISTING_TERRAIN_MAJOR_EVERY_QUARTER = 4;

/** A surveyed plot is hundreds to a few thousand triangles; past this the input is not survey-grade. */
export const LISTING_TERRAIN_MAX_TRIANGLES = 60_000;

/** Plan / elevation rounding of everything published: centimetres. */
export const LISTING_TERRAIN_DECIMALS = 2;

/** Below this mean gradient (percent) the ground has no meaningful downslope direction. */
export const LISTING_TERRAIN_FLAT_GRADIENT_PCT = 0.5;

// ── Β3: the survey source the door accepts ─────────────────────────────────

/**
 * Ceiling of the source file, bytes — the bound that actually caps the work (every count below is
 * implied by it). ~8 MB holds ≈ 250 000 numbers: an order of magnitude above a surveyed plot, so the
 * builder — not the size check — is what refuses an over-dense survey, by name (`too-dense`).
 */
export const LISTING_TERRAIN_SOURCE_MAX_BYTES = 8 * 1024 * 1024;

/** Sanity caps per collection: past them the file is not a plot survey, whatever its size. */
export const LISTING_TERRAIN_SOURCE_MAX_POINTS = 100_000;
export const LISTING_TERRAIN_SOURCE_MAX_BREAKLINES = 2_000;
export const LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES = 5_000;

/**
 * Largest absolute plan / elevation coordinate accepted, WORLD mm (10 000 km). ΕΓΣΑ'87 northings are
 * ≈ 4.5·10⁹ mm; anything past this is a unit mistake (e.g. micrometres), not a place on Earth.
 */
export const LISTING_TERRAIN_SOURCE_MAX_ABS_MM = 1e10;

/** Longest surveyor name kept in the declaration (it travels in object metadata, ≤ 8 KB in total). */
export const LISTING_TERRAIN_SURVEYOR_NAME_MAX = 160;

// ── Β4.8: the 2D map (`terrain-map-model.ts`) ─────────────────────────────
// Sizes are FRACTIONS (of the length each knob names), so the picture reads the same at any plot size and any
// screen/PDF width (the SVG scales as a whole).

/** Margin around the surface (fraction of the SURFACE's longer side), for the north arrow and the scale bar. */
export const LISTING_TERRAIN_MAP_PADDING_FRACTION = 0.1;

/** The scale bar spans the 1-2-5 length nearest to this share of the map width (Esri / QGIS practice). */
export const LISTING_TERRAIN_MAP_SCALE_BAR_FRACTION = 0.25;

/** Height of the north arrow, as a fraction of the MARGIN (it lives in the margin, never over the ground). */
export const LISTING_TERRAIN_MAP_NORTH_ARROW_FRACTION = 0.5;

/** Height of a contour label (and of every map text), as a fraction of the view box's longer side. */
export const LISTING_TERRAIN_MAP_LABEL_FRACTION = 0.028;

/**
 * Width classes (css px) of an ON-SCREEN map (the owner's preview, §13.8 decision 4). The measured width is floored to a
 * class, so the model is rebuilt only when the class changes — never on every pixel of a resize — and a label sized for
 * the class is at least as large on the real, wider-or-equal screen. Below the first class the first one applies.
 */
export const LISTING_TERRAIN_MAP_WIDTH_CLASSES_PX: readonly number[] = [320, 480, 640, 960];

/**
 * Advance width of one label character, in ems. Labels are digits (+ a decimal point) set in tabular figures, whose
 * advance is ≈ 0.55–0.6 em in common UI faces; the upper value keeps a label from overrunning its straight stretch.
 * ⚠️ An ESTIMATE in the pure model (no layout exists here, CHECK 3.64) — it only sizes the window a label needs.
 */
export const LISTING_TERRAIN_MAP_DIGIT_EM = 0.6;

/**
 * «Sparse area»: a triangle whose longest edge exceeds this multiple of the MEDIAN edge of the surface spans ground
 * nobody measured — the surface there is interpolation, not survey. Civil 3D exposes the same idea as the surface
 * definition's «maximum triangle length»; we flag such triangles (hatched on the map) instead of deleting them.
 */
export const LISTING_TERRAIN_MAP_SPARSE_EDGE_FACTOR = 3;
