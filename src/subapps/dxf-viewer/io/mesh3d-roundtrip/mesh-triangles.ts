/**
 * mesh-triangles — **Ο ΠΡΟΣΑΡΜΟΓΕΑΣ ΤΟΥ THREE** πάνω στον κοινό πυρήνα γεωμετρίας.
 *
 * Γεννήθηκε από τη Φ3.1 (ADR-683 §10.2) ως **ΕΝΑ SSoT** για την ερώτηση «δώσε μου τα τρίγωνα αυτού
 * του mesh σε world space»: ο υπολογισμός όγκου/στεγανότητας (`./mesh-solid-measure`) ρωτούσε
 * **ακριβώς το ίδιο** που ρωτούσε ήδη το fingerprint (`./geometry-hash`), και δύο αντίγραφα του
 * βρόχου θα ήταν structural clone (N.18) — ίδια ερώτηση, διαφορετικό όνομα, **σιωπηλή απόκλιση**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΛΛΑΞΕ ΣΤΗ Φ4.2 ΤΟΥ ADR-845 — ΚΑΙ ΤΙ **ΔΕΝ** ΑΛΛΑΞΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **υπολογισμός** έφυγε στο `@/lib/geometry/mesh3d/*`· εδώ έμεινε **μόνο η ανάγνωση του THREE**.
 * Ο λόγος είναι η κλειστή λογιστική του ADR-845 §6.2.1: την ίδια ερώτηση πρέπει να την απαντά και
 * ο **διακομιστής**, που ζει έξω από αυτό το subapp *(το root `tsconfig.json` το ΕΞΑΙΡΕΙ)* και δεν
 * έχει καν `THREE.Mesh` στα χέρια του — έχει bytes GLB.
 *
 * 🔑 **Η μετακίνηση ήταν δυνατή επειδή αυτό το αρχείο υπήρχε.** Ολόκληρη η επαφή των μετρητών με το
 * three ήταν οι **δύο** συναρτήσεις που ζουν εδώ. Ό,τι ήταν από κάτω ήταν ήδη καθαροί αριθμοί.
 *
 * ⚠️ **Καμία υπογραφή δεν άλλαξε** — {@link readWorldPositions}, {@link forEachTriangle} και
 * {@link triangleArea} καλούνται ακριβώς όπως πριν από τους καταναλωτές τους
 * *(`../../export/core/imported-mesh-faces`, `./geometry-hash`, `./mesh-solid-measure`)*.
 *
 * @see @/lib/geometry/mesh3d/triangle-soup — ο πυρήνας χωρίς ξενιστή, και το γιατί
 * @see ./geometry-hash — fingerprint (περιτύλιγμα του πυρήνα)
 * @see ./mesh-solid-measure — όγκος/στεγανότητα (περιτύλιγμα του πυρήνα)
 */

import type * as THREE from 'three';

import {
  forEachTriangle as forEachSoupTriangleIndex,
  type TriangleSoup,
} from '@/lib/geometry/mesh3d/triangle-soup';

export { triangleArea } from '@/lib/geometry/mesh3d/triangle-soup';
export type { TriangleSoup } from '@/lib/geometry/mesh3d/triangle-soup';

/**
 * Κορυφές σε world space. Η matrix θεωρείται affine (TRS δέντρο — πάντα αληθές για BIM σκηνές
 * και για ό,τι γράφει/διαβάζει ο GLTFExporter/Loader), οπότε η 4η γραμμή παραλείπεται.
 *
 * `null` όταν το mesh δεν έχει αξιοποιήσιμες κορυφές — ο caller το αντιμετωπίζει ως «άγνωστο»,
 * ποτέ ως «κενό/μηδέν».
 */
export function readWorldPositions(mesh: THREE.Mesh): Float64Array | null {
  const position = mesh.geometry.getAttribute('position');
  if (!position || position.itemSize < 3 || position.count === 0) return null;

  mesh.updateWorldMatrix(true, false);
  const e = mesh.matrixWorld.elements;
  const out = new Float64Array(position.count * 3);

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const o = i * 3;
    out[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
    out[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    out[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  return out;
}

/**
 * Οι δείκτες τριγώνων ως απλός πίνακας, ή `null` για **non-indexed** γεωμετρία.
 *
 * ⚠️ **Διαβάζεται με `getX`, όχι με `.array`**: το `BufferAttribute` είναι η αυθεντία για το πώς
 * ερμηνεύεται ο υποκείμενος buffer, και μια απευθείας ανάγνωση θα ήταν δεύτερη ερμηνεία —
 * ελεύθερη να διαφωνήσει με την πρώτη τη μέρα που κάποιος αλλάξει τον τύπο του buffer.
 */
function readIndex(mesh: THREE.Mesh): Uint32Array | null {
  const index = mesh.geometry.getIndex();
  if (index === null) return null;

  const out = new Uint32Array(index.count);
  for (let i = 0; i < index.count; i += 1) out[i] = index.getX(i);
  return out;
}

/**
 * Διέλευση όλων των τριγώνων. Καλύπτει indexed **και** non-indexed γεωμετρία — η διάκριση ζει
 * **μόνο** στον πυρήνα, ώστε κανένας καταναλωτής να μην την ξαναγράψει (και να μην την ξεχάσει).
 *
 * Επιστρέφει το πλήθος τριγώνων που επισκέφθηκε.
 */
export function forEachTriangle(
  mesh: THREE.Mesh,
  vertexCount: number,
  visit: (ia: number, ib: number, ic: number) => void,
): number {
  return forEachSoupTriangleIndex(readIndex(mesh), vertexCount, visit);
}

/**
 * 🏆 **Η ΜΙΑ ΜΕΤΑΦΡΑΣΗ THREE → ΠΥΡΗΝΑΣ** — ό,τι χρειάζεται κάθε μετρητής, σε μία πράξη.
 *
 * `null` όταν το mesh δεν έχει αξιοποιήσιμες κορυφές, με το **ίδιο** κριτήριο της
 * {@link readWorldPositions}: το «άγνωστο» παραμένει μία απόφαση, όχι δύο.
 */
export function toTriangleSoup(mesh: THREE.Mesh): TriangleSoup | null {
  const positions = readWorldPositions(mesh);
  if (positions === null) return null;

  return { positions, index: readIndex(mesh) };
}
