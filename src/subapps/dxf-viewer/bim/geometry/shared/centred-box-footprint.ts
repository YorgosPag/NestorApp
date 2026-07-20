/**
 * centred-box-footprint — SSoT για το ίχνος **κεντραρισμένου ορθογωνίου** (ADR-683 Φ3).
 *
 * Κάθε mesh-based BIM οντότητα (έπιπλο, εισαγόμενο πλέγμα, …) έχει το ίδιο 2Δ ίχνος: ορθογώνιο
 * `πλάτος × βάθος` κεντραρισμένο στο σημείο εισαγωγής, περιστραμμένο κατά `rotationDeg` περί τον
 * κατακόρυφο άξονα, χτισμένο σε **canvas units** ώστε να μοιράζεται τον χώρο συντεταγμένων του
 * `position` (που έρχεται από το κλικ του χρήστη).
 *
 * **Γιατί υπάρχει (N.18):** το `computeFurnitureGeometry` (ADR-410) το είχε ιδιωτικό. Όταν ήρθε το
 * `imported-mesh` (ADR-683 Φ3) η αντιγραφή του θα ήταν sibling clone — δύο αντίγραφα του ίδιου
 * μετασχηματισμού που **αποκλίνουν σιωπηλά** την πρώτη φορά που κάποιος διορθώσει bug μόνο στο ένα.
 * Ένας πυρήνας, δύο καλούντες.
 *
 * Καθαρή συνάρτηση: idempotent, χωρίς παρενέργειες, δεν πετά ποτέ. Ο καλών εγγυάται θετικές
 * διαστάσεις (ο validator του φρουρεί ανάντη).
 *
 * @see ../../furniture/furniture-geometry — καλών #1 (ADR-410, catalog-driven διαστάσεις)
 * @see ../../entities/imported-mesh/imported-mesh-geometry — καλών #2 (ADR-683, measured διαστάσεις)
 */

import type { BoundingBox3D, Point3D, Polygon3D } from '../../types/bim-base';
import { polygonArea, polygonBbox } from './polygon-utils';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/** Είσοδος — ό,τι χρειάζεται ένα κεντραρισμένο ορθογώνιο ίχνος, ανεξάρτητα τύπου οντότητας. */
export interface CentredBoxFootprintInput {
  /** mm. Πλάτος (X πριν την περιστροφή). */
  readonly widthMm: number;
  /** mm. Βάθος (Y πριν την περιστροφή). */
  readonly depthMm: number;
  /** mm. Συνολικό ύψος (bbox Z) — περνά ατόφιο στο αποτέλεσμα. */
  readonly heightMm: number;
  /** Σημείο εισαγωγής σε canvas units — το κέντρο του ορθογωνίου. */
  readonly position: Point3D;
  /** Μοίρες CCW περί τον κατακόρυφο άξονα. */
  readonly rotationDeg: number;
  /** Μονάδα καμβά· απούσα → `'mm'`. */
  readonly sceneUnits?: SceneUnits;
}

/** Έξοδος — το κοινό σχήμα γεωμετρίας των mesh-based οντοτήτων. */
export interface CentredBoxFootprintResult {
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδόν ίχνους (ανεξάρτητο μονάδας καμβά). */
  readonly area: number;
  /** mm. Ύψος, clamped σε μη-αρνητικό. */
  readonly height: number;
}

/** Υπολογίζει ίχνος + bbox + εμβαδόν για κεντραρισμένο, περιστραμμένο ορθογώνιο. */
export function computeCentredBoxFootprint(
  input: CentredBoxFootprintInput,
): CentredBoxFootprintResult {
  const s = mmToSceneUnits(input.sceneUnits ?? 'mm');
  const transformed = transformFootprint(buildRectangularLocal(input.widthMm, input.depthMm, s), input);

  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = polygonArea(transformed) * canvasToM * canvasToM;

  return {
    footprint: { vertices: transformed },
    bbox: polygonBbox(transformed),
    area: areaM2,
    height: Math.max(0, input.heightMm),
  };
}

/** Κορυφές στο τοπικό σύστημα (κέντρο στην αρχή), σε canvas units. */
function buildRectangularLocal(widthMm: number, depthMm: number, s: number): Point3D[] {
  const hw = (widthMm * s) / 2;
  const hd = (depthMm * s) / 2;
  return [
    { x: -hw, y: -hd, z: 0 },
    { x:  hw, y: -hd, z: 0 },
    { x:  hw, y:  hd, z: 0 },
    { x: -hw, y:  hd, z: 0 },
  ];
}

/** Περιστροφή περί την αρχή, μετά μεταφορά στο `position` (κέντρο = σημείο εισαγωγής). */
function transformFootprint(
  local: readonly Point3D[],
  input: Pick<CentredBoxFootprintInput, 'position' | 'rotationDeg'>,
): Point3D[] {
  const { position } = input;
  const cos = Math.cos(input.rotationDeg * DEG_TO_RAD);
  const sin = Math.sin(input.rotationDeg * DEG_TO_RAD);
  return local.map((v) => ({
    x: position.x + (v.x * cos - v.y * sin),
    y: position.y + (v.x * sin + v.y * cos),
    z: 0,
  }));
}
