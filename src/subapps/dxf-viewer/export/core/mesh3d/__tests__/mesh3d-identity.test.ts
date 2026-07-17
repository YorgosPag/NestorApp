/**
 * ADR-668 bug / ADR-669 §5.6 — το `matId` ΔΕΝ διαρρέει πάνω από σύνορο element.
 *
 * Regression lock: ένα φύλλο πόρτας (element `opening`) φιλοξενείται ΜΕΣΑ σε wall group
 * (element `wall`, με `matId=σκυρόδεμα`). Πριν το fix, το `resolveBimMeshIdentity` έτρεχε
 * `readUp('matId')` ανά κλειδί ανεξάρτητα → ανέβαινε πάνω από το άνοιγμα και επέστρεφε το
 * σκυρόδεμα του τοίχου· και επειδή το `assignExportMaterials` κάνει dedup ΜΕ ΤΟ ΟΝΟΜΑ, η
 * πόρτα έπαιρνε κυριολεκτικά το material clone του τοίχου (έχανε και το χρώμα της).
 *
 * Το test χτίζει την ΠΡΑΓΜΑΤΙΚΗ εμφωλευμένη ιεραρχία (τα adapter tests χτίζουν επίπεδη σκηνή,
 * άρα δεν το πιάνουν) και κλειδώνει και τις δύο πλευρές: (α) το άνοιγμα δεν κληρονομεί, (β) η
 * νόμιμη αναρρίχηση `matId` ΕΝΤΟΣ του ίδιου element (wall body → wall group) συνεχίζει.
 */

import * as THREE from 'three';
import { resolveBimMeshIdentity } from '../mesh3d-identity';
import { assignExportMaterials } from '../mesh3d-materials';

const CONCRETE = 0x9e9e9e;
const WOOD = 0x8b5a2b;

/**
 * wall group (bimId=w-1, matId=σκυρόδεμα)
 *   ├─ wall body mesh (bimId=w-1, ΧΩΡΙΣ δικό του matId — κληρονομεί από το group: νόμιμο)
 *   └─ opening group (bimId=o-9, ΧΩΡΙΣ matId)
 *        └─ φύλλο πόρτας (bimId=o-9, δικό του υλικό ξύλου, ΧΩΡΙΣ matId)
 */
function buildWallWithDoor(): {
  wallGroup: THREE.Group;
  wallBody: THREE.Mesh;
  doorLeaf: THREE.Mesh;
} {
  const wallGroup = new THREE.Group();
  wallGroup.userData = { bimId: 'w-1', bimType: 'wall', matId: 'mat-concrete-c25' };

  const wallBody = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: CONCRETE }),
  );
  wallBody.userData = { bimId: 'w-1', bimType: 'wall' };
  wallGroup.add(wallBody);

  const openingGroup = new THREE.Group();
  openingGroup.userData = { bimId: 'o-9', bimType: 'opening' };
  wallGroup.add(openingGroup);

  const doorLeaf = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: WOOD }),
  );
  doorLeaf.userData = { bimId: 'o-9', bimType: 'opening' };
  openingGroup.add(doorLeaf);

  return { wallGroup, wallBody, doorLeaf };
}

describe('resolveBimMeshIdentity — matId element boundary', () => {
  it('does NOT inherit the wall matId across the opening boundary', () => {
    const { doorLeaf } = buildWallWithDoor();
    const identity = resolveBimMeshIdentity(doorLeaf);

    expect(identity.matId).toBeNull();
    // η ταυτότητα του ίδιου του ανοίγματος μένει σωστή (co-located bimId/bimType)
    expect(identity.bimId).toBe('o-9');
    expect(identity.bimType).toBe('opening');
  });

  it('KEEPS the legitimate matId climb within the same element (wall body → wall group)', () => {
    const { wallBody } = buildWallWithDoor();
    const identity = resolveBimMeshIdentity(wallBody);

    expect(identity.matId).toBe('mat-concrete-c25');
    expect(identity.bimId).toBe('w-1');
  });

  it('resolves matId on a node with no element identity via free readUp (envelope path)', () => {
    // envelope: matId ΧΩΡΙΣ bimId (ADR-669 §6.1) → κανένα σύνορο να επιβληθεί
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    mesh.userData = { bimType: 'envelope', matId: 'elem-envelope' };
    expect(resolveBimMeshIdentity(mesh).matId).toBe('elem-envelope');
  });
});

describe('assignExportMaterials — door keeps its own material, not the wall clone', () => {
  it('gives the door leaf its OWN colour material, distinct from the wall', () => {
    const { wallGroup, wallBody, doorLeaf } = buildWallWithDoor();

    assignExportMaterials(wallGroup);

    const wallMat = wallBody.material as THREE.MeshStandardMaterial;
    const doorMat = doorLeaf.material as THREE.MeshStandardMaterial;

    // ΔΙΑΦΟΡΕΤΙΚΟ material object (όχι το ίδιο clone λόγω name-dedup)
    expect(doorMat).not.toBe(wallMat);
    // ο τοίχος κρατά το semantic matId name· η πόρτα παίρνει color-based fallback
    expect(wallMat.name).toBe('mat-concrete-c25');
    expect(doorMat.name).not.toBe('mat-concrete-c25');
    // η πόρτα κρατά το πραγματικό της χρώμα (ξύλο), όχι το σκυρόδεμα
    expect(doorMat.color.getHex()).toBe(WOOD);
    expect(wallMat.color.getHex()).toBe(CONCRETE);
  });
});
