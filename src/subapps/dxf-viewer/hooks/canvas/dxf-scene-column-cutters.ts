/**
 * ADR-458/788 — **ΕΝΑ** πέρασμα «μάζεψε τους κόπτες-κολώνες» για όλα τα cutback passes.
 *
 * Το ίδιο ερώτημα το ρωτούσαν δύο αρχεία με ταυτόσημο βρόχο (`dxf-scene-wall-cutback`,
 * `dxf-scene-beam-cutback`) — token-clone που κατήγγειλε το CHECK 3.28 (77 tokens). Η
 * μόνη διαφορά ήταν το `type` του μέλους που ψάχνει καθένα, άρα είναι **παράμετρος**,
 * όχι δεύτερο σώμα (N.0.2 / ADR-584).
 *
 * ⚠️ Επιστρέφει **2Δ** δακτυλίους: όλος ο αγωγός cutback (`computeMemberCutbackOutline`,
 * `computeBeamCutbackOutline`) δουλεύει σε `Pt2`, και το `displayFootprint`/`displayOutline`
 * είναι πλέον `Point2D[][]` (ADR-789). Κανένα ψεύτικο `z: 0` δεν γεννιέται εδώ.
 *
 * @module hooks/canvas/dxf-scene-column-cutters
 */

import type { DxfEntityUnion, DxfColumn } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';

/** Τι βρήκε το ένα πέρασμα: τα footprints των κολωνών + αν υπάρχει καν μέλος να κοπεί. */
export interface ColumnCutterScan {
  /** Footprints κολωνών (2Δ, ≥3 κορυφές) — οι κόπτες. */
  readonly columnFootprints: Point2D[][];
  /** `true` αν το scene περιέχει τουλάχιστον ένα μέλος του ζητούμενου τύπου. */
  readonly hasMember: boolean;
}

/**
 * Ένα πέρασμα πάνω στο scene: συλλέγει τα footprints των κολωνών και δηλώνει αν
 * υπάρχει μέλος τύπου `memberType`. Καλείται ΜΙΑ φορά ανά cutback pass.
 */
export function scanColumnCutters(
  entities: readonly DxfEntityUnion[],
  memberType: DxfEntityUnion['type'],
): ColumnCutterScan {
  let hasMember = false;
  const columnFootprints: Point2D[][] = [];
  for (const e of entities) {
    if (e.type === memberType) hasMember = true;
    else if (e.type === 'column') {
      const verts = (e as DxfColumn).geometry?.footprint?.vertices;
      if (verts && verts.length >= 3) columnFootprints.push(projectVerticesTo2D(verts));
    }
  }
  return { columnFootprints, hasMember };
}
