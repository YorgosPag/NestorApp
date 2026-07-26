/**
 * faced-mesh-lookup — SSoT «βρες το faced mesh μιας οντότητας και διάβασε την αρίθμηση όψεών του».
 *
 * Το `faceKeyByMaterialIndex` (ADR-539) είναι η **ζωντανή αλήθεια** για το ποιες όψεις έχει ένα
 * solid: το γράφει ο converter τη στιγμή που χτίζει τα geometry groups, οπότε ό,τι διαβάζεται από
 * εδώ είναι εξ ορισμού ό,τι όντως ζωγραφίστηκε. Κάθε ανεξάρτητος υπολογισμός των ίδιων κλειδιών
 * (π.χ. «η κολώνα έχει 4 πλευρές, άρα buried:0..3») είναι δεύτερη πηγή που **μπορεί** να
 * αποκλίνει — και η απόκλιση θα εμφανιζόταν ως highlight σε λάθος όψη.
 *
 * Εξάχθηκε (N.0.2) από το `FaceSelectionHighlighter`, όπου το lookup ζούσε ως private method,
 * μόλις χρειάστηκε **δεύτερος** καταναλωτής: η επιλογή Τμήματος (ADR-715) πρέπει να μαζέψει
 * ΟΛΕΣ τις θαμμένες όψεις του mesh για να τις φωτίσει μαζί.
 *
 * @see ./FaceSelectionHighlighter.ts — ο αρχικός ιδιοκτήτης
 * @see ../../../bim/parts/buried-part.ts — `buriedFaceTargets` (ο pure φίλτρο-καταναλωτής)
 * @see ../../converters/bim-three-faced-prism.ts — ο παραγωγός του `faceKeyByMaterialIndex`
 */

import type * as THREE from 'three';

/**
 * Το πρώτο **faced** mesh της `bimId` μέσα στο `group`, ή `null`.
 *
 * «Faced» = κρατά `faceKeyByMaterialIndex`. Ο έλεγχος αυτός είναι ο λόγος που η αναζήτηση δεν
 * είναι σκέτο «βρες mesh με αυτό το bimId»: μια οντότητα μπορεί να έχει **πολλά** tagged meshes
 * (πυρήνας + οπλισμός + edge lines), και μόνο ο πυρήνας φέρει την αρίθμηση όψεων.
 */
export function findFacedMesh(group: THREE.Group, bimId: string): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  group.traverse((o) => {
    if (found) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && o.userData['bimId'] === bimId && o.userData['faceKeyByMaterialIndex']) found = m;
  });
  return found;
}

/** Η αρίθμηση όψεων ενός mesh (`userData.faceKeyByMaterialIndex`), ή `undefined` σε legacy mesh. */
export function readMeshFaceKeys(mesh: THREE.Mesh | null): readonly string[] | undefined {
  return mesh?.userData['faceKeyByMaterialIndex'] as readonly string[] | undefined;
}

/** Η αρίθμηση όψεων της `bimId` μέσα στο `group` (lookup + read σε ένα βήμα). */
export function readEntityFaceKeys(group: THREE.Group, bimId: string): readonly string[] | undefined {
  return readMeshFaceKeys(findFacedMesh(group, bimId));
}
