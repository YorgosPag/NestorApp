/**
 * geometry-hash — **ΤΟ ΠΕΡΙΤΥΛΙΓΜΑ ΤΟΥ THREE** πάνω στον κοινό υπολογισμό fingerprint.
 *
 * ⚠️ **Ο ΥΠΟΛΟΓΙΣΜΟΣ ΕΦΥΓΕ ΣΤΟ `@/lib/geometry/mesh3d/geometry-fingerprint`** *(ADR-845 Φ4.2)*.
 * Εκεί ζουν: τα **δύο επίπεδα** *(ακριβές `hash` + περιγραφέας με ανοχή)* και ο μετρημένος λόγος
 * τους *(σκέτο quantised hash → ~12% ψευδώς θετικά **ανά συντεταγμένη** στα 100 m)*, ο **χώρος
 * αναφοράς** *(τι πιάνει και τι όχι — 100% ειλικρίνεια)*, και οι **τρεις ανοχές**.
 *
 * 🏆 **ΚΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΕΦΥΓΕ ΕΙΝΑΙ ΟΤΙ ΑΠΕΚΤΗΣΕ ΔΕΥΤΕΡΟ ΞΕΝΙΣΤΗ**: η **Α-6** του ADR-845 §8 ρωτά
 * *«διαφωνούν τα μετρημένα μεγέθη με τη δήλωση του πελάτη;»* πάνω σε **bytes GLB στον διακομιστή**,
 * όπου δεν υπάρχει `THREE.Mesh`. Είναι η ίδια ερώτηση με το *«άλλαξε το σχήμα ανάμεσα σε εξαγωγή
 * και επιστροφή;»* — άρα **ο ίδιος κριτής**, με τις **ίδιες** ανοχές. Δεύτερη υλοποίηση θα απέκλινε
 * σιωπηλά την πρώτη φορά που κάποιος πείραζε ένα κατώφλι στη μία πλευρά *(ADR-749)*.
 *
 * 🔑 **Το αρχείο ΔΕΝ διαγράφηκε**, για τον ίδιο λόγο με το `./mesh-solid-measure`: πέντε
 * καταναλωτές του subapp το εισάγουν ονομαστικά, και η διαδρομή του πυρήνα δεν χρειάζεται να
 * μαθευτεί σε πέντε σημεία.
 *
 * @see @/lib/geometry/mesh3d/geometry-fingerprint — η μηχανή, οι ανοχές, το σκεπτικό
 * @see ./export-manifest — γράφει/διαβάζει τα fingerprints (sidecar `.nestor.json`)
 * @see ./gltf-scene-parse — τα ξαναϋπολογίζει από το επιστρεφόμενο glTF/GLB
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5
 */

import type * as THREE from 'three';

import {
  computeFingerprint,
  type GeometryFingerprint,
} from '@/lib/geometry/mesh3d/geometry-fingerprint';

import { toTriangleSoup } from './mesh-triangles';

export {
  GEOMETRY_QUANTUM_M,
  GEOMETRY_LENGTH_TOLERANCE_M,
  GEOMETRY_AREA_TOLERANCE_RATIO,
  compareGeometry,
  type Vec3M,
  type GeometrySignature,
  type GeometryFingerprint,
  type GeometryComparison,
} from '@/lib/geometry/mesh3d/geometry-fingerprint';

/**
 * Το fingerprint ενός mesh. `null` όταν το mesh δεν έχει αξιοποιήσιμες κορυφές (κενή γεωμετρία)
 * — ο caller το αντιμετωπίζει ως «άγνωστο σχήμα», ποτέ ως «ίδιο».
 */
export function computeGeometryFingerprint(mesh: THREE.Mesh): GeometryFingerprint | null {
  return computeFingerprint(toTriangleSoup(mesh));
}
