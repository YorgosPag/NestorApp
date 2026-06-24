/**
 * gizmo-constants.ts — visual & interaction constants for the 3D BIM gizmo.
 *
 * PORTED from GenArc ADR-022 (Gizmo System) — pure values, no store coupling.
 * @related ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port.
 */

// -- Axis Colors (reference HTML: warmer red, brighter green, purple-blue) ----
export const GIZMO_COLOR_X = 0xe52d2d;
// Vertical (Y) axis — darker green per Giorgio (was lime 0x2de52d).
export const GIZMO_COLOR_Y = 0x1f8a1f;
export const GIZMO_COLOR_Z = 0x2d2de5;
export const GIZMO_COLOR_HOVER = 0xc8a020;

// -- Plane Handle Colors (perpendicular axis color) ----------------------------
export const GIZMO_PLANE_COLOR_XY = GIZMO_COLOR_Z; // purple-blue (perp Z-axis)
export const GIZMO_PLANE_COLOR_XZ = GIZMO_COLOR_Y; // green       (perp Y-axis)
export const GIZMO_PLANE_COLOR_YZ = GIZMO_COLOR_X; // red         (perp X-axis)

// -- Center Handle Color (reference: orange tetrahedron) -----------------------
export const GIZMO_COLOR_CENTER = 0xe8731a;

// -- Arrow Geometry (Line stem + concave chevron head) -------------------------
export const ARROW_STEM_LENGTH = 0.85;
export const ARROW_STEM_LINE_OPACITY = 0.62;
export const ARROW_HEAD_RADIUS = 0.03;
export const ARROW_HEAD_LENGTH = 0.12;
/** Notch position as fraction of head length from tip (ref: 0.6/cos(0.28) ~= 0.624). */
export const ARROW_NOTCH_FACTOR = 0.624;
/** Revolution segments for concave chevron head. */
export const ARROW_CHEVRON_SEGMENTS = 8;

// -- Hitbox (invisible, fat cylinders for easy clicking) -----------------------
export const HITBOX_RADIUS = 0.1;
export const HITBOX_LENGTH = 1.0;

// -- Plane Handle Geometry (L-bracket + diagonal + arm extensions) -------------
export const PLANE_SIZE = 0.14;
export const PLANE_OFFSET = 0.36;
export const PLANE_OPACITY_DEFAULT = 0.07;
export const PLANE_OPACITY_HOVER = 0.20;
export const PLANE_DIAGONAL_OPACITY_FACTOR = 0.5;
export const PLANE_ARM_EXTENSION = 0.10;

// -- Center Pyramid (orange, positioned on diagonal between axes) --------------
/** Offset along each positive axis from origin (ref: 1/3 of axis length). */
export const PYRAMID_OFFSET = 0.33;
/** Tip length from pyramid center outward along diagonal (ref: 0.055). */
export const PYRAMID_TIP_LEN = 0.055;
/** Base offset from center inward along diagonal (ref: 0.030). */
export const PYRAMID_BASE_OFF = 0.030;
/** Base triangle circumradius (ref: 0.045). */
export const PYRAMID_BASE_R = 0.045;
/** Per-face fill opacities for pseudo-lighting [face0, face1, face2, base]. */
export const PYRAMID_FACE_OPACITIES = [0.13, 0.08, 0.05, 0.04] as const;

// -- Resize Handle Geometry (wireframe octahedron + L-brackets + crosshair) ----
export const RESIZE_OCTA_RADIUS = 0.0375;
/** L-bracket corner distance relative to octahedron radius (ref: 7/5 = 1.4). */
export const RESIZE_BRACKET_SCALE = 1.4;
/** L-bracket arm fraction -- arm goes from corner to this fraction toward center (ref: 4/7). */
export const RESIZE_BRACKET_ARM_FRAC = 0.57;
/** Crosshair half-length relative to octahedron radius (ref: 2/5 = 0.4). */
export const RESIZE_CROSSHAIR_SCALE = 0.4;
/** Invisible center hitbox side length (larger for easy clicking). */
export const RESIZE_HITBOX_SIZE = 0.12;
/** Corner hitbox side length for scale-corner picking. */
export const RESIZE_CORNER_HITBOX_SIZE = 0.13;
/** Offset along axis stem (midpoint of ARROW_STEM_LENGTH). */
export const RESIZE_HANDLE_OFFSET = 0.40;
/** Idle tick count per side (ref: 2 ticks each side, 4 total). */
export const RESIZE_TICK_COUNT = 2;
/** Tick spacing as multiple of octahedron radius (ref: 6/5 = 1.2). */
export const RESIZE_TICK_SPACING = 1.2;
/** Major tick half-length as multiple of R (ref: 3/5 = 0.6). */
export const RESIZE_TICK_HALF_MAJOR = 0.6;
/** Minor tick half-length as multiple of R (ref: 2/5 = 0.4). */
export const RESIZE_TICK_HALF_MINOR = 0.4;
/** Mirror-corner accent (from reference HTML scale_mir corner color). */
export const RESIZE_MIRROR_COLOR = 0xa07840;

// -- Origin Reticle (circle + crosshair) ---------------------------------------
export const RETICLE_RADIUS = 0.03;
export const RETICLE_CROSS_INNER = 0.045;
export const RETICLE_CROSS_OUTER = 0.075;
export const RETICLE_COLOR = 0x444444;
export const RETICLE_SEGMENTS = 24;

// -- Screen-Space Scaling ------------------------------------------------------
/** Multiplier: gizmoScale = cameraDistance * tan(fov/2) * GIZMO_SCREEN_SCALE */
export const GIZMO_SCREEN_SCALE = 0.45;

// -- Snap Marker (ADR-402 Phase B — drag snap indicator) -----------------------
// ADR-378 §Step 5: the marker geometry/scaling + these tuning constants are the
// shared SSoT in `bim-3d/shared/snap-marker-core.ts` (reused by the gizmo AND the
// BIM placement tools). Re-exported here so existing gizmo consumers keep importing
// SNAP_MARKER_* from gizmo-constants unchanged.
export {
  SNAP_MARKER_COLOR,
  SNAP_MARKER_RADIUS,
  SNAP_MARKER_SCREEN_SCALE,
  SNAP_MARKER_RENDER_ORDER,
} from '../shared/snap-marker-core';
/**
 * ADR-363 Φ1G.5 Slice 2i — smaller screen scale for the snap marker during a collapsed
 * planar MOVE (wall/column/slab drag). The full 0.13 cube read as a giant cyan box
 * (Giorgio); a small square (~⅓) is the Revit "face snap" glyph. Replaces the old
 * full suppression (`suppressSnapMarker`) so the user SEES where the face landed.
 * Gizmo-only (not part of the shared core).
 */
export const SNAP_MARKER_MOVE_SCREEN_SCALE = 0.045;

// -- Alignment line (ADR-363 Φ1G.5 Slice 2i — Revit dashed face-alignment line) ---
/** Dashed alignment line colour — Revit reference blue (distinct from the cyan snap glyph). */
export const ALIGNMENT_LINE_COLOR = 0x4a90d9;
/** Dash size in world metres (screen feel is fine at architectural scale; no black outline). */
export const ALIGNMENT_LINE_DASH = 0.12;
/** Gap size in world metres between dashes. */
export const ALIGNMENT_LINE_GAP = 0.08;
/** Render order — above geometry, below the snap glyph + gizmo handles. */
export const ALIGNMENT_LINE_RENDER_ORDER = 1998;

// -- Endpoint shape handle (ADR-408 Φ-D — drag ONE end of a linear MEP segment) -
/**
 * Endpoint handle colour — a clear teal "control point", distinct from the axis
 * reds/greens/blues and the orange centre, so a pipe-end grab reads unambiguously.
 */
export const GIZMO_ENDPOINT_COLOR = 0x16b8c0;
/** Endpoint visual = a small camera-facing RING (torus). Hollow centre keeps the pipe-end
 *  cap visible (a solid disc hid it). Outer ring radius, before screen-constant scaling. */
export const ENDPOINT_RING_RADIUS = 0.045;
/** Ring tube (thickness) — thin so it reads as a hollow ring, not a disc. */
export const ENDPOINT_RING_TUBE = 0.011;
/** Invisible endpoint hitbox side length (covers the thin ring for easy clicking). */
export const ENDPOINT_HITBOX_SIZE = 0.12;

// -- Base-point / rotation-centre marker (ADR-408 — relocatable gizmo origin) ---
/**
 * Revit-style rotation-centre glyph (camera-facing circle + crosshair, ⊙) drawn at
 * the relocated base point. Orange so it reads as "the pivot moved here", distinct
 * from the cyan snap marker. Above the gizmo handles so the moved origin is obvious.
 */
export const BASE_POINT_MARKER_COLOR = 0xe8731a;
/** Base ring radius in world metres before screen-constant scaling. */
export const BASE_POINT_MARKER_RADIUS = 0.09;
/** Screen-constant multiplier: markerScale = cameraDistance * tan(fov/2) * this. */
export const BASE_POINT_MARKER_SCREEN_SCALE = 0.16;
/** Render order — above the gizmo handles so the moved origin is always visible. */
export const BASE_POINT_MARKER_RENDER_ORDER = 2001;
/** Circle outline segment count. */
export const BASE_POINT_MARKER_SEGMENTS = 32;
/** Crosshair half-length as a multiple of the ring radius (arms poke past the ring). */
export const BASE_POINT_MARKER_CROSS_FACTOR = 1.4;

// -- Rendering -----------------------------------------------------------------
export const GIZMO_RENDER_ORDER = 2000;

// -- Interaction Thresholds ----------------------------------------------------
/** Minimum camera |dir.y| above which Y-axis projection falls back to screen-space. */
export const Y_AXIS_TOP_DOWN_THRESHOLD = 0.95;

/** Minimum pixel movement to consider a gizmo drag started (squared). */
export const GIZMO_DRAG_THRESHOLD_SQ = 9;

// -- Geometry Segments (level of detail for cylinders) -------------------------
export const CYLINDER_SEGMENTS = 8;

// -- Negative Axis Indicators (subtle directional hints) -----------------------
export const NEG_AXIS_LENGTH = 0.15;
export const NEG_AXIS_OPACITY = 0.14;

// -- Handle ID -> Color Maps ---------------------------------------------------
export const AXIS_COLORS: Record<string, number> = {
  x: GIZMO_COLOR_X,
  y: GIZMO_COLOR_Y,
  z: GIZMO_COLOR_Z,
};

export const PLANE_COLORS: Record<string, number> = {
  xy: GIZMO_PLANE_COLOR_XY,
  xz: GIZMO_PLANE_COLOR_XZ,
  yz: GIZMO_PLANE_COLOR_YZ,
};

// -- Resize Handle Idle Colors (desaturated axis colors, ref: hCol) -----------
export const RESIZE_IDLE_COLORS: Record<string, number> = {
  x: GIZMO_COLOR_HOVER,
  y: GIZMO_COLOR_HOVER,
  z: GIZMO_COLOR_HOVER,
};
