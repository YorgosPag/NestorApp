/**
 * 🏢 ADR-515 — Snap Marker Visual SSoT (χρώμα ανά τύπο)
 *
 * Single Source of Truth για το **semantic** mapping κάθε snap type → χρώμα. Δύο επίπεδα
 * (Google design-token pattern):
 *   - primitive palette (raw hex)  → `SNAP_MARKER_COLORS` στο `config/color-config.ts`
 *   - semantic mapping + resolver  → ΕΔΩ (`ExtendedSnapType` → palette token)
 * Συμπληρώνει το ADR-137 (`snap-icon-config.ts`, geometry/μέγεθος). Καταναλωτές:
 *   - 2D: `canvas-v2/overlays/SnapIndicatorOverlay.tsx` (SVG leaf)
 *   - 3D: `bim-3d/shared/snap-marker-core.ts` (Three.js marker)
 *
 * Χρωματικό μοντέλο: **type-specific (Revit-rich)** — κάθε τύπος έλξης = δικό του χρώμα
 * (Giorgio 2026-06-24). Αλλαγή τιμής χρώματος → στο `SNAP_MARKER_COLORS` (color-config).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-515-snap-marker-visual-ssot.md
 */

import { ExtendedSnapType } from '../../../snapping/extended-types';
// 🏢 ADR-515: primitive snap palette SSoT (δεν ξαναγράφουμε hex literals εδώ).
import { SNAP_MARKER_COLORS } from '../../../config/color-config';
// ADR-137: geometry SSoT — re-export ώστε οι consumers να έχουν ΕΝΑ import σημείο για snap visuals.
export {
  SNAP_ICON_GEOMETRY,
  getSnapIconHalf,
  getSnapIconQuarter,
  getTangentCircleRadius,
  getGridDotRadius,
  getNodeDotRadius,
} from './snap-icon-config';

/**
 * Base / fallback marker χρώμα — primitive από το palette SSoT (κρατά το 3D marker στο
 * ιστορικό cyan & χρησιμεύει ως fallback για άγνωστο τύπο).
 */
export const SNAP_MARKER_BASE_COLOR = SNAP_MARKER_COLORS.BASE;

/**
 * 🎯 ADR-515 — type → χρώμα. Type-safe `Record`: προσθήκη νέου `ExtendedSnapType`
 * χωρίς εγγραφή εδώ = compile error (exhaustiveness guard). Όλες οι τιμές δείχνουν στο
 * `SNAP_MARKER_COLORS` palette (color-config) — μηδέν hex literal εδώ.
 */
export const SNAP_COLORS: Record<ExtendedSnapType, string> = {
  // ── Geometric core (AutoCAD OSNAP) ──────────────────────────────────────────
  [ExtendedSnapType.ENDPOINT]:      SNAP_MARKER_COLORS.ENDPOINT,
  [ExtendedSnapType.MIDPOINT]:      SNAP_MARKER_COLORS.MIDPOINT,
  [ExtendedSnapType.CENTER]:        SNAP_MARKER_COLORS.CENTER,
  [ExtendedSnapType.INTERSECTION]:  SNAP_MARKER_COLORS.INTERSECTION,
  [ExtendedSnapType.PERPENDICULAR]: SNAP_MARKER_COLORS.PERPENDICULAR,
  [ExtendedSnapType.TANGENT]:       SNAP_MARKER_COLORS.TANGENT,
  [ExtendedSnapType.QUADRANT]:      SNAP_MARKER_COLORS.QUADRANT,
  [ExtendedSnapType.NEAREST]:       SNAP_MARKER_COLORS.NEAREST,
  [ExtendedSnapType.NEAR]:          SNAP_MARKER_COLORS.NEAREST,

  // ── Advanced ────────────────────────────────────────────────────────────────
  [ExtendedSnapType.EXTENSION]:     SNAP_MARKER_COLORS.EXTENSION,
  [ExtendedSnapType.NODE]:          SNAP_MARKER_COLORS.NODE,
  [ExtendedSnapType.INSERTION]:     SNAP_MARKER_COLORS.NODE,
  [ExtendedSnapType.PARALLEL]:      SNAP_MARKER_COLORS.PARALLEL,
  [ExtendedSnapType.ORTHO]:         SNAP_MARKER_COLORS.PERPENDICULAR,
  [ExtendedSnapType.GRID]:          SNAP_MARKER_COLORS.BASE, // δεν ζωγραφίζεται (silent)
  [ExtendedSnapType.GUIDE]:         SNAP_MARKER_COLORS.BASE, // δεν ζωγραφίζεται (silent)

  // ── Dimensions / construction (ADR-189 / 362) ───────────────────────────────
  [ExtendedSnapType.CONSTRUCTION_POINT]: SNAP_MARKER_COLORS.CONSTRUCTION,
  [ExtendedSnapType.DIM_DEF_POINT]: SNAP_MARKER_COLORS.DIM,
  [ExtendedSnapType.DIM_LINE]:      SNAP_MARKER_COLORS.DIM,

  // ── BIM family (ADR-370 / 363 / 408) ─────────────────────────────────────────
  [ExtendedSnapType.BIM_CORNER]:        SNAP_MARKER_COLORS.BIM_CORNER,
  [ExtendedSnapType.BIM_MIDPOINT]:      SNAP_MARKER_COLORS.BIM_MIDPOINT,
  [ExtendedSnapType.BIM_CENTER]:        SNAP_MARKER_COLORS.BIM_CENTER,
  [ExtendedSnapType.BIM_WALL_FACE]:     SNAP_MARKER_COLORS.BIM_WALL_FACE,
  [ExtendedSnapType.BIM_MEP_CONNECTOR]: SNAP_MARKER_COLORS.BIM_MEP_CONNECTOR,

  // ── Text (ADR-378) ────────────────────────────────────────────────────────────
  [ExtendedSnapType.TEXT]:          SNAP_MARKER_COLORS.TEXT,

  // ── Rotation (ADR-397) ──────────────────────────────────────────────────────
  [ExtendedSnapType.ROTATION_PIVOT]: SNAP_MARKER_COLORS.ROTATION,
  [ExtendedSnapType.ROTATION_GRIP]:  SNAP_MARKER_COLORS.ROTATION,

  // ── Auto / fallback ───────────────────────────────────────────────────────────
  [ExtendedSnapType.AUTO]:          SNAP_MARKER_COLORS.BASE,
};

/**
 * 🎯 ADR-515 — ΕΝΑΣ resolver. Δέχεται string (το `SnapIndicatorView.type` είναι
 * lowercase enum value) και επιστρέφει το χρώμα του τύπου, με ασφαλές fallback στο
 * base color για άγνωστο/κενό τύπο. Pure — μηδέν state.
 */
export function resolveSnapColor(type: string | ExtendedSnapType | null | undefined): string {
  if (!type) return SNAP_MARKER_BASE_COLOR;
  const key = String(type).toLowerCase() as ExtendedSnapType;
  return SNAP_COLORS[key] ?? SNAP_MARKER_BASE_COLOR;
}
