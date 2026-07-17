/**
 * ADR-668 — BIM identity resolution for exported meshes.
 *
 * **Γιατί υπάρχει αυτό το αρχείο** (η ρίζα του «στο C4D το βλέπω σαν μία ενιαία οντότητα»):
 * ο `OBJExporter` γράφει `o ${mesh.name}` ανά mesh, αλλά **κανένας** BIM converter δεν θέτει
 * `mesh.name` — το ζωντανό 3D δεν χρειάστηκε ποτέ ονόματα (δουλεύει με `userData` + raycasting).
 * Άρα κάθε αντικείμενο γραφόταν ως ανώνυμο `o ` και το C4D δεν είχε τι να διαχωρίσει.
 *
 * Τα meshes ΟΜΩΣ κουβαλούν ήδη ταυτότητα σε `userData` — απλώς **άλλοτε στο ίδιο το mesh και
 * άλλοτε στο parent group** (π.χ. ο τοίχος με ανοίγματα γίνεται group). Γι' αυτό η ανάγνωση
 * ανεβαίνει στους προγόνους αντί να κοιτά μόνο το mesh: αλλιώς οι μισές κατηγορίες θα έβγαιναν
 * `unknown`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md
 */

import type * as THREE from 'three';

export interface BimMeshIdentity {
  /** Entity category — 'wall' | 'column' | 'slab' | … (14 τιμές σήμερα). */
  readonly bimType: string | null;
  /** Entity id (SSoT id της οντότητας). */
  readonly bimId: string | null;
  /** DNA material id (π.χ. 'mat-concrete-c25' / 'elem-railing'). */
  readonly matId: string | null;
  /** Level id — υπάρχει στο multi-floor path. */
  readonly levelId: string | null;
}

function readUp(object: THREE.Object3D, key: string): string | null {
  let node: THREE.Object3D | null = object;
  while (node) {
    const value = node.userData[key];
    if (typeof value === 'string' && value.length > 0) return value;
    node = node.parent;
  }
  return null;
}

/**
 * Διαβάζει την ταυτότητα ενός mesh ανεβαίνοντας self → ancestors.
 * Πρώτο match κερδίζει (το κοντινότερο στο mesh είναι το πιο ειδικό).
 */
export function resolveBimMeshIdentity(mesh: THREE.Object3D): BimMeshIdentity {
  return {
    bimType: readUp(mesh, 'bimType'),
    bimId: readUp(mesh, 'bimId'),
    matId: readUp(mesh, 'matId'),
    levelId: readUp(mesh, 'levelId'),
  };
}
