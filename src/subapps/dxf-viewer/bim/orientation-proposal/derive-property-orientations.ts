/**
 * **Πρόταση προσανατολισμού ακινήτου από την κάτοψη** (ADR-937 Φάση Β) — καθαρή συνάρτηση.
 *
 * Ερώτημα: *«προς τα πού βλέπουν τα ανοίγματα αυτού του ακινήτου;»*. Ένα άνοιγμα μετρά όταν:
 *   1. φιλοξενείται σε τοίχο (`isWallHostedOpening`) που είναι **εξωτερικός** (`resolveExteriorWallIds` — η ίδια απάντηση
 *      με τα θερμικά φορτία, ADR-422)·
 *   2. κάθεται πάνω στο **όριο** του πολυγώνου του ακινήτου (overlay `kind:'property'`), μέσα στην ανοχή `tol`.
 * Η κατεύθυνση είναι η **εξωτερική κάθετος** της πλησιέστερης ακμής του πολυγώνου (`nearestEdgeOutwardAzimuthDeg` —
 * ίδια μέθοδος με τα κουφώματα στα θερμικά), διορθωμένη κατά τον **αληθινό Βορρά** του έργου.
 *
 * 🧭 **Σύμβαση Βορρά** = η σύμβαση του μετασχηματισμού που **πράγματι** τοποθετεί το σχέδιο στον κόσμο
 *    (`systems/geo-referencing/geo-transform.ts` `forwardRigidMap`: `world = R(rotationDeg)·local`, αριστερόστροφα,
 *    Y-πάνω, κόσμος = ΕΓΣΑ με +Y = Βορράς). Μια αριστερόστροφη περιστροφή κατά `r` **μειώνει** το δεξιόστροφο αζιμούθιο
 *    κατά `r`, άρα **αληθινό αζιμούθιο = αζιμούθιο σκηνής − rotationDeg**.
 *    Παράδειγμα: `rotationDeg = 90` ⇒ το +X της σκηνής πάει στο +Y του κόσμου· όψη προς +X (σκηνή 90°) ⇒ 0° = Βόρεια.
 *    Την ίδια σύμβαση ακολουθεί πλέον και το IFC `TrueNorth` (`services/ifc/ifc-units.ts`, ADR-937 §3.1).
 *
 * 🔑 Κανένα άνοιγμα ⇒ κενή λίστα: δεν προτείνεται τίποτα (καμία μαντεψιά από τη μορφή του πολυγώνου).
 */

import type { OrientationType } from '@/constants/property-features-enterprise';
import { orientationOfAzimuth } from '@/lib/geometry/azimuth-orientation';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { canonicalOrientations } from '@/lib/property/orientation-proposal';

import { nearestEdgeOutwardAzimuthDeg } from '../geometry/shared/polygon-azimuth-utils';
import { pointToPolygonEdgeDistance } from '../thermal/heat-load/wall-footprint-match';
import { isWallHostedOpening, type OpeningEntity } from '../types/opening-types';

export interface PropertyOrientationInputs {
  /** Το πολύγωνο του ακινήτου στην κάτοψη (world coords, μονάδες σκηνής). */
  readonly polygon: readonly PlanarPoint[];
  readonly openings: readonly OpeningEntity[];
  readonly exteriorWallIds: ReadonlySet<string>;
  /** Ανοχή «το άνοιγμα κάθεται στο όριο» — σε μονάδες σκηνής. */
  readonly tol: number;
  /** `GeoReference.rotationDeg` (= `Project.northRotation`) σε μοίρες· 0 = ο Βορράς είναι +Y της σκηνής. */
  readonly northRotationDeg: number;
}

/** Ο προσανατολισμός ενός ανοίγματος, ή `null` όταν δεν μετρά (εσωτερικός τοίχος, εκτός ορίου, εκφυλισμένη ακμή). */
function openingOrientation(op: OpeningEntity, input: PropertyOrientationInputs): OrientationType | null {
  if (!isWallHostedOpening(op) || !input.exteriorWallIds.has(op.params.wallId)) return null;
  const pos = op.geometry?.position;
  if (!pos) return null;
  const p = { x: pos.x, y: pos.y };
  if (pointToPolygonEdgeDistance(p, input.polygon) > input.tol) return null;
  const sceneAzimuth = nearestEdgeOutwardAzimuthDeg(input.polygon, p);
  if (sceneAzimuth === null) return null;
  return orientationOfAzimuth(sceneAzimuth - input.northRotationDeg);
}

/** Οι όψεις του ακινήτου με ανοίγματα, στη σειρά του λεξιλογίου, χωρίς διπλότυπα. */
export function derivePropertyOrientations(input: PropertyOrientationInputs): OrientationType[] {
  if (input.polygon.length < 3) return [];
  const found: OrientationType[] = [];
  for (const op of input.openings) {
    const orientation = openingOrientation(op, input);
    if (orientation !== null) found.push(orientation);
  }
  return canonicalOrientations(found);
}
