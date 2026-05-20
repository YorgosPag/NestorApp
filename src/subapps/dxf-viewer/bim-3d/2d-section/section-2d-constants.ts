/**
 * ADR-366 §A.3 Q3 Phase 7.0B — 2D Section Panel constants.
 *
 * Standalone WebGLRenderer + OrthographicCamera για το 2D αρχιτεκτονικό section
 * view. Port από GenArc `constants/sectionView.constants` με Nestor scoping
 * (όλα τα coords σε meters — Three.js world units match Nestor BIM convention).
 *
 * Colors → SSoT `SECTION_2D_PANEL_COLORS` στο `config/color-config.ts`.
 *
 * @see SPEC-3D-004A §3.2 — GenArc reference
 * @see ADR-366 §A.3.Q3
 */

/** Default ortho frustum half-size (m) πριν fit-to-bbox zoom. */
export const SECTION_2D_DEFAULT_ORTHO_SIZE_M = 5;

/** Devicepixel ratio cap — limits canvas footprint σε retina displays. */
export const SECTION_2D_PIXEL_RATIO_CAP = 2;

/** Padding multiplier για fit-to-bbox — leaves whitespace around content. */
export const SECTION_2D_CAMERA_PADDING = 1.15;

/** Wheel zoom step — multiplicative (1 step = 1/factor when zooming out). */
export const SECTION_2D_ZOOM_FACTOR = 1.1;

/** Min zoom (zoomed out further than this disabled). */
export const SECTION_2D_ZOOM_MIN = 0.01;

/** Max zoom (zoomed in further than this disabled). */
export const SECTION_2D_ZOOM_MAX = 1000;

/** Raycaster line pick threshold (m). Generous για 2D outline picking. */
export const SECTION_2D_LINE_PICK_THRESHOLD_M = 0.05;

/** Default panel container size όταν δεν έχει mountarized resize observer. */
export const SECTION_2D_DEFAULT_WIDTH_PX = 600;
export const SECTION_2D_DEFAULT_HEIGHT_PX = 280;

/** Min/Max συνολικού ύψους panel στο BimViewport3D bottom strip. */
export const SECTION_2D_PANEL_MIN_HEIGHT_PX = 180;
export const SECTION_2D_PANEL_MAX_HEIGHT_PX = 480;
export const SECTION_2D_PANEL_DEFAULT_HEIGHT_PX = 280;

/** Section camera looks along -Z; world Y is up. */
export const SECTION_2D_CAMERA_DISTANCE_M = 100;
