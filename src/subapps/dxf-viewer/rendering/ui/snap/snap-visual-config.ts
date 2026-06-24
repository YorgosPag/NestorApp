/**
 * 🏢 ADR-515 — Snap Marker Visual SSoT (χρώμα ανά τύπο)
 *
 * Single Source of Truth για το ΧΡΩΜΑ κάθε snap marker. Συμπληρώνει το ADR-137
 * (`snap-icon-config.ts`, geometry/μέγεθος) — εδώ ζει ΜΟΝΟ ο χρωματικός χάρτης
 * + ο resolver. Καταναλώνεται ταυτόχρονα από:
 *   - 2D: `canvas-v2/overlays/SnapIndicatorOverlay.tsx` (SVG leaf)
 *   - 3D: `bim-3d/shared/snap-marker-core.ts` (Three.js marker, derived 0x χρώμα)
 *
 * Χρωματικό μοντέλο: **type-specific (Revit-rich)** — κάθε τύπος έλξης = δικό του
 * χρώμα ώστε η αναγνώριση να είναι ακαριαία (Giorgio 2026-06-24). Αλλαγή policy σε
 * μονόχρωμο = δείξε όλες τις εγγραφές στο `SNAP_MARKER_BASE_COLOR` εδώ, σε ΕΝΑ αρχείο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-515-snap-marker-visual-ssot.md
 */

import { ExtendedSnapType } from '../../../snapping/extended-types';
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
 * Base / fallback χρώμα marker (κυανό — κρατά το 3D marker στο ιστορικό cyan και
 * χρησιμεύει ως ασφαλές fallback για άγνωστο τύπο). Mirror του ADR-378 3D marker.
 */
export const SNAP_MARKER_BASE_COLOR = '#00e5ff' as const;

/**
 * 🎯 ADR-515 — type → χρώμα. Type-safe `Record`: προσθήκη νέου `ExtendedSnapType`
 * χωρίς εγγραφή εδώ = compile error (exhaustiveness guard). Palette: Revit/Material
 * grade, διακριτά χρώματα ανά οικογένεια (geometric / BIM / construction / dim / rotation).
 */
export const SNAP_COLORS: Record<ExtendedSnapType, string> = {
  // ── Geometric core (AutoCAD OSNAP) ──────────────────────────────────────────
  [ExtendedSnapType.ENDPOINT]:      '#ff3b30', // κόκκινο   — άκρο
  [ExtendedSnapType.MIDPOINT]:      '#00e676', // πράσινο   — μέσο
  [ExtendedSnapType.CENTER]:        '#2196f3', // μπλε      — κέντρο
  [ExtendedSnapType.INTERSECTION]:  '#ff00ff', // magenta   — τομή
  [ExtendedSnapType.PERPENDICULAR]: '#ffeb3b', // κίτρινο   — κάθετο
  [ExtendedSnapType.TANGENT]:       '#ff9100', // amber     — εφαπτομένη
  [ExtendedSnapType.QUADRANT]:      '#00bcd4', // teal      — τεταρτημόριο
  [ExtendedSnapType.NEAREST]:       '#9e9e9e', // γκρι      — πλησιέστερο
  [ExtendedSnapType.NEAR]:          '#9e9e9e', // γκρι      — πλησιέστερο (alias)

  // ── Advanced ────────────────────────────────────────────────────────────────
  [ExtendedSnapType.EXTENSION]:     '#b0bec5', // γκρι-μπλε — προέκταση
  [ExtendedSnapType.NODE]:          '#ffc107', // amber     — κόμβος
  [ExtendedSnapType.INSERTION]:     '#ffc107', // amber     — εισαγωγή
  [ExtendedSnapType.PARALLEL]:      '#9b59b6', // μωβ       — παράλληλο
  [ExtendedSnapType.ORTHO]:         '#ffeb3b', // κίτρινο   — ορθο (= perpendicular family)
  [ExtendedSnapType.GRID]:          SNAP_MARKER_BASE_COLOR, // δεν ζωγραφίζεται (overlay return null)
  [ExtendedSnapType.GUIDE]:         '#00bcd4', // cyan      — οδηγός (δεν ζωγραφίζεται· βλ. overlay)

  // ── Dimensions (ADR-362) ──────────────────────────────────────────────────────
  [ExtendedSnapType.CONSTRUCTION_POINT]: '#ff4081', // pink — σημείο κατασκευής (ADR-189)
  [ExtendedSnapType.DIM_DEF_POINT]: '#b388ff', // λιλά      — def point διάστασης
  [ExtendedSnapType.DIM_LINE]:      '#b388ff', // λιλά      — γραμμή διάστασης

  // ── BIM family (ADR-370 / 363 / 408) ─────────────────────────────────────────
  [ExtendedSnapType.BIM_CORNER]:        '#ff9800', // πορτοκαλί — γωνία BIM
  [ExtendedSnapType.BIM_MIDPOINT]:      '#1de9b6', // teal-green — μέσο BIM
  [ExtendedSnapType.BIM_CENTER]:        '#00e5ff', // κυανό      — κέντρο BIM
  [ExtendedSnapType.BIM_WALL_FACE]:     '#80d8ff', // αν. κυανό  — παρειά τοίχου
  [ExtendedSnapType.BIM_MEP_CONNECTOR]: '#e040fb', // purple-pink — MEP connector

  // ── Text (ADR-378) ────────────────────────────────────────────────────────────
  [ExtendedSnapType.TEXT]:          '#ffd740', // χρυσό     — κείμενο

  // ── Rotation (ADR-397) ──────────────────────────────────────────────────────
  [ExtendedSnapType.ROTATION_PIVOT]: '#ff6e40', // βαθύ πορτοκαλί — κέντρο περιστροφής
  [ExtendedSnapType.ROTATION_GRIP]:  '#ff6e40', // βαθύ πορτοκαλί — λαβή υπό περιστροφή

  // ── Auto / fallback ───────────────────────────────────────────────────────────
  [ExtendedSnapType.AUTO]:          SNAP_MARKER_BASE_COLOR,
} as const;

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

/**
 * 🎯 ADR-515 — Three.js helper: hex `#rrggbb` → 0xRRGGBB number για
 * `LineBasicMaterial({ color })`. Έτσι το 3D marker είναι **derived** από τον ίδιο
 * χρωματικό SSoT (2D & 3D κινούνται μαζί).
 */
export function snapColorToThreeHex(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
