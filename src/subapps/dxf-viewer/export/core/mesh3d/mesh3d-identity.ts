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
 * Σαν `readUp`, αλλά **δεν διασχίζει σύνορο element**: μόλις η αναρρίχηση φτάσει σε κόμβο με
 * ΔΙΑΦΟΡΕΤΙΚΟ `bimId` από τον κάτοχο-element (`ownerBimId`), σταματά και επιστρέφει `null`.
 *
 * **Γιατί υπάρχει** (ADR-668 bug, ADR-669 §5.6): το `matId` είναι ιδιότητα ΕΝΟΣ element και
 * δεν κληρονομείται από ΑΛΛΟ (μοντέλο Revit/ArchiCAD). Ένα φύλλο πόρτας (`bimId=opening.id`,
 * χωρίς δικό του `matId`) είναι φιλοξενούμενο ΜΕΣΑ στο wall group (`bimId=wall.id`, με
 * `matId=<σκυρόδεμα>`). Ένα ελεύθερο `readUp('matId')` θα ανέβαινε πάνω από το άνοιγμα και θα
 * επέστρεφε το σκυρόδεμα του τοίχου → η πόρτα εξαγόταν με το υλικό του τοίχου (και, λόγω dedup
 * με το όνομα στο `assignExportMaterials`, με το ΙΔΙΟ material clone).
 *
 * Το σύνορο ορίζεται από **αλλαγή** `bimId`, ΟΧΙ από την παρουσία του: τα wall body meshes
 * φέρουν κι αυτά `bimId=wall.id` (ίδιο element) ενώ το `matId` κάθεται στο wall group από πάνω
 * τους — αυτή η νόμιμη αναρρίχηση **εντός** του ίδιου element πρέπει να συνεχίσει να δουλεύει.
 * Όταν ο κάτοχος δεν έχει ταυτότητα (`ownerBimId === null`, π.χ. envelope) δεν υπάρχει σύνορο
 * να επιβληθεί → συμπεριφέρεται όπως το `readUp` (μηδέν regression).
 */
function readWithinElement(
  object: THREE.Object3D,
  key: string,
  ownerBimId: string | null,
): string | null {
  let node: THREE.Object3D | null = object;
  while (node) {
    const nodeBimId = node.userData['bimId'];
    if (
      ownerBimId !== null &&
      typeof nodeBimId === 'string' &&
      nodeBimId.length > 0 &&
      nodeBimId !== ownerBimId
    ) {
      return null;
    }
    const value = node.userData[key];
    if (typeof value === 'string' && value.length > 0) return value;
    node = node.parent;
  }
  return null;
}

/**
 * Διαβάζει την ταυτότητα ενός mesh ανεβαίνοντας self → ancestors.
 * Πρώτο match κερδίζει (το κοντινότερο στο mesh είναι το πιο ειδικό).
 *
 * `bimType`/`bimId`/`levelId` λύνονται με ελεύθερη αναρρίχηση (η εμφωλευμένη ιεραρχία elements
 * είναι σωστή γι' αυτά — ένα άνοιγμα ΜΕΣΑ σε τοίχο είναι όντως στον ίδιο όροφο, και τα
 * `bimId`/`bimType` είναι πάντα co-located ανά κόμβο). Το `matId` όμως είναι **ιδιότητα του
 * element** και λύνεται φραγμένο στο σύνορο του element (βλ. `readWithinElement`), αλλιώς
 * διαρρέει σε γειτονικά elements.
 */
export function resolveBimMeshIdentity(mesh: THREE.Object3D): BimMeshIdentity {
  const bimId = readUp(mesh, 'bimId');
  return {
    bimType: readUp(mesh, 'bimType'),
    bimId,
    matId: readWithinElement(mesh, 'matId', bimId),
    levelId: readUp(mesh, 'levelId'),
  };
}
