/**
 * Wall 2Δ render palette + function helpers (ADR-375 C.9).
 *
 * Εξήχθη από τον `WallRenderer` (inline `CATEGORY_FILL`) ώστε ο renderer να μην
 * κρατά hardcoded χρώματα (FULL SSOT, μηδέν hardcoded χρώμα σε renderer).
 *
 * Διαχωρισμός ευθυνών:
 *   - **Line color** (outline) → Object Styles SSoT (`DEFAULT_OBJECT_STYLES.wall`),
 *     resolver-driven (parent = εξωτ. τοίχος, subcategory `interior` = εσωτ. τοίχος).
 *   - **Fill tint** (translucent γέμισμα, 2D-only) → εδώ (`WALL_CATEGORY_FILL`).
 *
 * @see config/bim-object-styles.ts (BIM_CATEGORY_LINE_COLORS)
 */
import type { WallCategory } from '../types/wall-types';

/**
 * Brighter line contrast για το wall **outline + γραμμή άξονα** ενάντια στο live 2D canvas
 * (ADR-509). Σαφώς υψηλότερο από το default `MIN_ENTITY_CONTRAST` (3.0): ο Giorgio ζήτησε τα
 * περιγράμματα + τον κεντρικό άξονα πιο φωτεινά ώστε να ξεχωρίζουν καθαρά πάνω από το poché
 * body fill σε μαύρο φόντο. Σε μαύρο canvas το near-black #2b2f36 → ~`#a8aaac` (ανοιχτό γκρι,
 * όχι λευκό-harsh). Περνιέται ως `adaptEntityColorForCanvas(color, WALL_LINE_CONTRAST)`.
 *
 * NB: το 4.5 (πρώτη απόπειρα) έδινε `#727579` — μόλις +28/κανάλι από το προηγ. `#565a5f` (3.0),
 * ανεπαίσθητο. Το 9.0 δίνει σαφή, ορατή διαφορά διατηρώντας τον CAD γκρι χαρακτήρα.
 */
export const WALL_LINE_CONTRAST = 9.0;

/** Translucent fill colour per category (CAD industry convention). 2D-only. */
export const WALL_CATEGORY_FILL: Readonly<Record<WallCategory, string>> = {
  exterior:  'rgba(120, 144, 156, 0.18)', // concrete slate
  interior:  'rgba(205, 158, 110, 0.16)', // brick warm
  partition: 'rgba(205, 158, 110, 0.10)', // brick lighter
  parapet:   'rgba(120, 144, 156, 0.22)', // concrete deeper
  fence:     'rgba(141, 110, 99, 0.18)',  // stone brown
};

/**
 * Whether a wall function reads as "interior" for line-colour purposes.
 * interior + partition (διαχωριστικός) → εσωτερικός γκρι τόνος· exterior/parapet/
 * fence → εξωτερικός βαρύς τόνος (parent χρώμα). Local helper του
 * `wallFootprintSubcategory` (όχι exported — αποφυγή dead-code ratchet).
 */
function isInteriorWallCategory(category: WallCategory): boolean {
  return category === 'interior' || category === 'partition';
}

/**
 * Object Styles subcategory key για το footprint outline pass ανά function.
 * Εσωτ./διαχωριστικός → `'interior'` (subcategory line color)· αλλιώς
 * `'common-edges'` (κενό color → πέφτει σε parent = εξωτ. χρώμα).
 *
 * SSoT: το μοιράζονται 2D `WallRenderer` ΚΑΙ 3D `attachEdgesProjection`.
 */
export function wallFootprintSubcategory(category: WallCategory): 'interior' | 'common-edges' {
  return isInteriorWallCategory(category) ? 'interior' : 'common-edges';
}
