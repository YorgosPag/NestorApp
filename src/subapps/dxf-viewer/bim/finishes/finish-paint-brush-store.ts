/**
 * finish-paint-brush-store — ADR-449 PART B Slice C (2D) «Βαφή σοβά» paintbrush.
 *
 * Micro-store για το τρέχον **πινέλο** του 2D paintbrush mode (Revit «Paint» / Cinema 4D
 * polygon mode parity): ποιο υλικό/χρώμα εφαρμόζει το επόμενο κλικ σε όψη σοβά. Το ίδιο το
 * «ενεργό mode» ΔΕΝ ζει εδώ — είναι το `activeTool === 'finish-paint'` (canonical
 * `ToolStateStore` SSoT), ώστε το 2D εργαλείο να συμπεριφέρεται όπως ΟΛΑ τα άλλα (pressed
 * highlight στο ribbon, Esc-disarm, reactive active-state — δωρεάν). Μηδέν δεύτερος
 * mode-μηχανισμός (N.0.2/N.12). Αδελφό του 3D `PolygonMode3DStore` (που κρατά δικό του
 * `active` μόνο επειδή το 3D δεν έχει tool-state σύστημα).
 *
 * `brush = FinishFaceOverride` → βάψε/ντύσε την όψη· `brush = null` → **σβήσε** (eraser: καθαρίζει
 * το per-face override, η όψη γυρνά στο default υλικό σοβά). Το panel γράφει το `brush`, ο
 * canvas click (event-time `getFinishPaintBrush()`) το εφαρμόζει μέσω του κοινού apply SSoT.
 *
 * @see ./FinishPaint2DPanel — swatches/χρώμα → setBrush
 * @see ../../hooks/canvas/useFinishPaintClick — canvas click → pick + apply
 * @see ../../bim-3d/stores/PolygonMode3DStore — 3D αδελφό (per-face paint)
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import { create } from 'zustand';
import {
  STRUCTURAL_FINISH_INTERIOR_MATERIAL,
  type FinishFaceOverride,
} from './structural-finish-types';

/** Default πινέλο: εσωτερικός σοβάς (το πρώτο swatch) → το πρώτο κλικ βάφει χωρίς προ-επιλογή. */
const DEFAULT_BRUSH: FinishFaceOverride = { materialId: STRUCTURAL_FINISH_INTERIOR_MATERIAL };

interface FinishPaintBrushState {
  /** Το τρέχον πινέλο (υλικό ή custom χρώμα), ή `null` = σβήσιμο (eraser/clear override). */
  readonly brush: FinishFaceOverride | null;
  /** Ρητό set του πινελιού (swatch → `{materialId}`· custom → `{colorOverride}`· clear → `null`). */
  setBrush(brush: FinishFaceOverride | null): void;
}

export const useFinishPaintBrushStore = create<FinishPaintBrushState>((set) => ({
  brush: DEFAULT_BRUSH,
  setBrush: (brush) => set({ brush }),
}));

/** Event-time snapshot του πινελιού (ADR-040 — canvas click reads via getter, ΟΧΙ subscription). */
export function getFinishPaintBrush(): FinishFaceOverride | null {
  return useFinishPaintBrushStore.getState().brush;
}
