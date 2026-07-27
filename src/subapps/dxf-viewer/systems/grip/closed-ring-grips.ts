/**
 * closed-ring-grips — SSoT για **ΕΝΑ** ερώτημα: «πού κάθονται οι λαβές ενός συνόλου
 * κλειστών δαχτυλιδιών ορίου;»
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (ADR-662 §13 · N.18): το `entity-closed-rings` απαντά ήδη «ΠΟΙΑ
 * rings» για κάθε ring-bounded τύπο (γραμμοσκίαση → `boundaryPaths`, τοπογραφική →
 * `footprint`). Έλειπε το δεύτερο μισό: «ΠΟΥ πάνω σε αυτά τα rings κάθονται οι λαβές».
 * Η γραμμοσκίαση το είχε απαντήσει **ιδιωτικά** μέσα στο `bim/hatch/hatch-grips.ts`
 * (`getHatchBoundaryGrips` / `getHatchEdgeMidpointGrips`)· η τοπογραφική επιφάνεια θα
 * αντέγραφε τους ΙΔΙΟΥΣ δύο βρόχους με άλλο όνομα πεδίου — **structural sibling clone**
 * που το name-based `ssot:discover` (CHECK 3.18) **δεν** πιάνει, μόνο το token-based
 * jscpd (CHECK 3.28). Εδώ η γεωμετρία απαντιέται **μία φορά** και οι δύο τύποι
 * (και ο επόμενος) την καταναλώνουν.
 *
 * ΚΑΘΑΡΗ ΓΕΩΜΕΤΡΙΑ, ΜΗΔΕΝ ΠΟΛΙΤΙΚΗ: εδώ ζει **μόνο** το «πού» (συντεταγμένες +
 * δείκτες). Το «τι κάνει η λαβή όταν συρθεί» ανήκει στον κάθε τύπο και είναι
 * **σκόπιμα διαφορετικό** — η γραμμοσκίαση μεταφράζει κορυφή ορίου (ιδιόκτητο
 * δεδομένο), η τοπογραφική γράφει πίσω στο survey point (ADR-662 §13). Ενοποιώντας
 * και τη σημασιολογία θα σπάγαμε τον έναν από τους δύο.
 *
 * ΠΛΑΙΣΙΟ ΣΥΝΤΕΤΑΓΜΕΝΩΝ: ό,τι πλαίσιο έχουν τα rings που δίνεις — καμία μετατροπή.
 * Και οι δύο καταναλωτές δίνουν rings στο ίδιο frame που ζωγραφίζει ο renderer, ώστε
 * η λαβή να κάθεται πάνω στη γραμμή που βλέπει ο χρήστης.
 *
 * @see ../../snapping/shared/entity-closed-rings — «ΠΟΙΑ rings;» (το πρώτο μισό)
 * @see ../../bim/hatch/hatch-grips — ο καταναλωτής της γραμμοσκίασης
 * @see ../topography/topo-surface-grips — ο καταναλωτής της τοπογραφικής επιφάνειας
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Ελάχιστες κορυφές που πρέπει να κρατά ένα ring ορίου: κάτω από τρίγωνο το πολύγωνο
 * εκφυλίζεται. Ο πήχης των **ακμών** (μια ακμή μεταξύ 2 κορυφών δεν είναι όριο), ΟΧΙ
 * των κορυφών — μια κορυφή υπάρχει ό,τι κι αν είναι το μήκος του ring.
 */
export const MIN_RING_VERTICES = 3;

/** Λαβή σε **κορυφή** ring: δείκτες (ring, κορυφή) + η θέση της στο frame των rings. */
export interface ClosedRingVertexGrip {
  readonly ringIdx: number;
  readonly vertexIdx: number;
  readonly point: Point2D;
}

/** Λαβή στο **μέσο ακμής** ring: δείκτες (ring, ακμή `edgeIdx→edgeIdx+1`) + το μέσο της. */
export interface ClosedRingEdgeMidpointGrip {
  readonly ringIdx: number;
  readonly edgeIdx: number;
  readonly point: Point2D;
}

/**
 * Μία λαβή ανά κορυφή, σε σειρά **ring-major / vertex-minor**.
 *
 * ⚠️ Η σειρά **ΕΙΝΑΙ** το συμβόλαιο: ο δείκτης του array γίνεται ο τρέχων `gripIndex`
 * που αναθέτουν **και** ο ορατός renderer **και** το interaction registry. Όσο και οι
 * δύο διαβάζουν από εδώ, «ορατό» και «πιάσιμο» δεν μπορούν να αποκλίνουν ποτέ — αυτή
 * ακριβώς η απόκλιση ήταν το bug που γέννησε το SSoT της γραμμοσκίασης (ADR-507).
 */
export function closedRingVertexGrips(
  rings: ReadonlyArray<ReadonlyArray<Point2D>>,
): ClosedRingVertexGrip[] {
  const grips: ClosedRingVertexGrip[] = [];
  rings.forEach((ring, ringIdx) => {
    ring.forEach((v, vertexIdx) => {
      grips.push({ ringIdx, vertexIdx, point: { x: v.x, y: v.y } });
    });
  });
  return grips;
}

/**
 * Μία λαβή ανά **ακμή** ring, στο μέσο της, σε σειρά ring-major / edge-minor. Τα rings
 * είναι implicitly κλειστά, άρα η τελευταία ακμή είναι `last→first` (modulo). Εκφυλισμένα
 * rings (< {@link MIN_RING_VERTICES}) δεν συνεισφέρουν καμία.
 */
export function closedRingEdgeMidpointGrips(
  rings: ReadonlyArray<ReadonlyArray<Point2D>>,
): ClosedRingEdgeMidpointGrip[] {
  const grips: ClosedRingEdgeMidpointGrip[] = [];
  rings.forEach((ring, ringIdx) => {
    if (ring.length < MIN_RING_VERTICES) return;
    ring.forEach((a, edgeIdx) => {
      const b = ring[(edgeIdx + 1) % ring.length];
      grips.push({ ringIdx, edgeIdx, point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
    });
  });
  return grips;
}
