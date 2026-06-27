/**
 * should-render-faced — ADR-539 SSoT για το «faced ή legacy;» gate των δομικών converters.
 *
 * Ένα δομικό solid render-άρεται ως **faced** (multi-material prism, pickable per-face) αντί
 * για legacy single-material extrude όταν ΕΙΤΕ:
 *   - φέρει ήδη per-face `faceAppearance` (βαμμένο → πρέπει να δείξει τη βαφή), Ή
 *   - το **Polygon Mode είναι ενεργό** — τότε ΟΛΑ τα solids γίνονται faced ώστε οι όψεις τους
 *     να είναι pickable. Έτσι το multi-face select δουλεύει **cross-entity** (Cinema 4D «Polygon
 *     Mode»: όλες οι όψεις όλων των αντικειμένων επιλέξιμες — όχι μόνο του ενός solid που άνοιξε
 *     τη λειτουργία). Λύνει το chicken-and-egg (faced render ↔ face pick) για ΚΑΘΕ solid.
 *
 * Όταν το Polygon Mode είναι κλειστό + το solid άβαφο → legacy path (byte-for-byte, zero
 * regression). Ένα κεντρικό gate — οι 6 converters (slab/column/beam/wall/foundation/roof) το
 * καλούν, μηδέν διπλότυπα (Boy-Scout: πριν ήταν inline `poly.active && targetBimId === id` ×6).
 *
 * @see bim-3d/stores/PolygonMode3DStore.ts
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';

/** True → render faced (pickable per-face)· false → legacy single-material path. */
export function shouldRenderFaced(faceAppearance: FaceAppearanceMap | undefined): boolean {
  if (faceAppearance !== undefined && Object.keys(faceAppearance).length > 0) return true;
  return usePolygonMode3DStore.getState().active;
}
