/**
 * @fileoverview **ΑΖΙΜΟΥΘΙΟ ΑΚΜΗΣ ΠΟΛΥΓΩΝΟΥ (SSoT)** — η εξωτερική κάθετος μιας ακμής ως γωνία πυξίδας.
 * @related ADR-937 Φάση Γ (χάρτης) · ADR-422 L7.2 (θερμικά — πρώτος καταναλωτής) ·
 *   subapps/dxf-viewer/bim/geometry/shared/polygon-azimuth-utils (επανεξάγει από εδώ)
 * @module lib/geometry/polygon-azimuth
 *
 * Ζούσε στο `polygon-azimuth-utils.ts` του dxf-viewer. Προωθήθηκε εδώ επειδή τη χρειάζεται και ο διάλογος χάρτη της
 * καρτέλας ακινήτου (CHECK 3.62: κανείς έξω από το subapp δεν εισάγει από αυτό) — ίδιο πρότυπο με το `lib/geometry/scalar`.
 * Συμπεριφορά **ταυτόσημη**: ίδιο κατώφλι εκφυλισμού, ίδια επίλυση «προς τα έξω» από τη φορά (όχι από κέντρο βάρους ⇒
 * σωστό και σε κοίλα πολύγωνα).
 *
 * 🔑 Σύμβαση: **0° = +Y («Βορράς»), δεξιόστροφα προς +X («Ανατολή»)**: +Y→0, +X→90, −Y→180, −X→270.
 */

import { normalizeAngleDeg } from '@/lib/geometry/angle';
import { shoelaceArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';

const RAD_TO_DEG = 180 / Math.PI;

/** Κάτω από αυτό το μήκος ένα διάνυσμα θεωρείται εκφυλισμένο (μηδενικό). */
const DEGENERATE_LENGTH_EPS = 0.001;

/** Αζιμούθιο (μοίρες ∈ [0,360)) του διανύσματος `(dx,dy)` — `null` για (σχεδόν) μηδενικό διάνυσμα. */
export function directionAzimuthDeg(dx: number, dy: number): number | null {
  if (Math.hypot(dx, dy) < DEGENERATE_LENGTH_EPS) return null;
  return normalizeAngleDeg(Math.atan2(dx, dy) * RAD_TO_DEG);
}

/**
 * Αζιμούθιο της **εξωτερικής** καθέτου της ακμής `edgeIndex` (κορυφή i → i+1). «Εξωτερική» = η πλευρά που κοιτά **μακριά
 * από το εσωτερικό**, από τη **φορά** του δακτυλίου. `null` για `<3` κορυφές ή εκφυλισμένη ακμή.
 */
export function edgeOutwardAzimuthDeg(polygon: readonly PlanarPoint[], edgeIndex: number): number | null {
  const n = polygon.length;
  if (n < 3) return null;
  const a = polygon[edgeIndex % n];
  const b = polygon[(edgeIndex + 1) % n];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS) return null;
  // Αριστερόστροφη κάθετος (−dy, dx) δείχνει ΜΕΣΑ σε αριστερόστροφο δακτύλιο ⇒ αντιστρέφεται.
  const outwardSign = shoelaceArea(polygon) > 0 ? -1 : 1;
  return directionAzimuthDeg((outwardSign * -dy) / len, (outwardSign * dx) / len);
}
