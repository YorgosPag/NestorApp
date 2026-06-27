/**
 * Placement3DOverlayStore — state για το 3D placement overlay της κολώνας (ADR-544).
 *
 * Όταν ο χρήστης σχεδιάζει κολώνα στον 3D καμβά, το `use-bim3d-column-placement` καλεί στο
 * `onMove` το ΙΔΙΟ 2D `generateColumnPreview` (μία πηγή αλήθειας) και δημοσιεύει εδώ το
 * προκύπτον meta (πολικό/καρτεσιανό πλέγμα, δυναμικές διαστάσεις, γραμμές-οδηγοί) μαζί με την
 * υψομετρική στάθμη του ενεργού δαπέδου. Το `BimPlacementOverlay2D` κάνει subscribe για να
 * ξεκινήσει/σταματήσει το RAF του και να προβάλει το meta μέσω της live κάμερας κάθε frame.
 *
 * Low-frequency (ενημερώνεται ανά pointermove, ΟΧΙ ανά frame), άρα μικρό zustand store — mirror
 * `Snap3DOverlayStore`/`Grip3DOverlayStore` (ADR-040: low-freq subscribe, high-freq imperative draw).
 */

import { create } from 'zustand';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { PolarDiskGrid } from '../../bim/columns/polar-disk-snap';
import type { RectGrid } from '../../bim/columns/rect-cartesian-snap';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import type { PlacementAlignmentGuide } from '../../bim/columns/column-tangent-snap';

/**
 * Το ενεργό 3D placement overlay meta. ΟΛΑ τα σημεία είναι σε **scene units** (όπως ακριβώς τα
 * παράγει το 2D `generateColumnPreview`)· ο 3D projector τα μετατρέπει scene→plan-mm→px. Το
 * `anchorScene` είναι το σημείο κουμπώματος (κέντρο πλέγματος / cursor) για το whole-overlay
 * occlusion cull («μόνο μπροστινά», όπως ADR-542).
 */
export interface Placement3DMeta {
  readonly polarDiskGrid: PolarDiskGrid | null;
  readonly rectGrid: RectGrid | null;
  readonly faceDimensions: GhostFaceDimensionsMeta | null;
  readonly alignmentGuide: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[] | null;
  /** Υψόμετρο ενεργού δαπέδου (mm) — η στάθμη που «ανεβάζει» τα plan σημεία στο 3D. */
  readonly elevMm: number;
  readonly sceneUnits: SceneUnits;
  /** Σημείο κουμπώματος (scene units) για το occlusion cull ολόκληρου του overlay. */
  readonly anchorScene: Point2D;
}

interface Placement3DOverlayState {
  /** Το ενεργό overlay meta, ή `null` όταν δεν σχεδιάζεται κολώνα / ο κέρσορας έφυγε. */
  readonly meta: Placement3DMeta | null;
  /** Δημοσίευσε το ενεργό meta (move hit), ή `null` για καθάρισμα (miss / leave / teardown). */
  setMeta(meta: Placement3DMeta | null): void;
}

export const usePlacement3DOverlayStore = create<Placement3DOverlayState>((set) => ({
  meta: null,
  setMeta: (meta) => set({ meta }),
}));
