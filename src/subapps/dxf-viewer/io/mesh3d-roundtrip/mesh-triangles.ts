/**
 * mesh-triangles — **ΕΝΑ SSoT** για την ερώτηση «δώσε μου τα τρίγωνα αυτού του mesh σε world space».
 *
 * Γεννήθηκε από τη Φ3.1 (ADR-683 §10.2): ο υπολογισμός όγκου/στεγανότητας
 * (`./mesh-solid-measure`) ρωτά **ακριβώς το ίδιο** που ρωτούσε ήδη το fingerprint
 * (`./geometry-hash`) — κορυφές σε world space + διέλευση τριγώνων που καλύπτει indexed και
 * non-indexed γεωμετρία. Δύο αντίγραφα αυτού του βρόχου θα ήταν structural clone (N.18): ίδια
 * ερώτηση, διαφορετικό όνομα, και **σιωπηλή απόκλιση** την πρώτη φορά που κάποιος διορθώσει το ένα.
 *
 * Δεν προστίθεται συμπεριφορά εδώ — είναι καθαρή εξαγωγή του υπάρχοντος κώδικα του `geometry-hash`,
 * ώστε και οι δύο καταναλωτές να διαβάζουν τη γεωμετρία με τον **ίδιο** τρόπο.
 *
 * @see ./geometry-hash — ο αρχικός ιδιοκτήτης (fingerprint A/C του §5)
 * @see ./mesh-solid-measure — ο δεύτερος καταναλωτής (όγκος/στεγανότητα, Φ3.1)
 */

import type * as THREE from 'three';

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
 * Διέλευση όλων των τριγώνων. Καλύπτει indexed **και** non-indexed γεωμετρία — η διάκριση ζει
 * **μόνο** εδώ, ώστε κανένας καταναλωτής να μην την ξαναγράψει (και να μην την ξεχάσει).
 *
 * Επιστρέφει το πλήθος τριγώνων που επισκέφθηκε.
 */
export function forEachTriangle(
  mesh: THREE.Mesh,
  vertexCount: number,
  visit: (ia: number, ib: number, ic: number) => void,
): number {
  const index = mesh.geometry.getIndex();
  const count = index !== null ? index.count : vertexCount;
  const triangleCount = Math.floor(count / 3);

  for (let t = 0; t < triangleCount; t += 1) {
    const base = t * 3;
    if (index !== null) {
      visit(index.getX(base), index.getX(base + 1), index.getX(base + 2));
    } else {
      visit(base, base + 1, base + 2);
    }
  }
  return triangleCount;
}

/** Εμβαδόν ενός τριγώνου από 3 δείκτες κορυφών (μισό μέτρο του εξωτερικού γινομένου). */
export function triangleArea(p: Float64Array, ia: number, ib: number, ic: number): number {
  const ax = p[ib * 3] - p[ia * 3];
  const ay = p[ib * 3 + 1] - p[ia * 3 + 1];
  const az = p[ib * 3 + 2] - p[ia * 3 + 2];
  const bx = p[ic * 3] - p[ia * 3];
  const by = p[ic * 3 + 1] - p[ia * 3 + 1];
  const bz = p[ic * 3 + 2] - p[ia * 3 + 2];
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
}
