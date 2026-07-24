/**
 * ADR-411 — mesh-to-object3d unit tests (units-safe + anchor base/top + cache).
 *
 * The glTF cache is mocked so the converter is tested in isolation (no Firebase
 * Storage, no GLTFLoader network) — we drive the hit / miss branches directly.
 */

import * as THREE from 'three';

const getInstance = jest.fn();
const preload = jest.fn();
// ADR-693 Φ2 — η ηλικία φόρτωσης οδηγεί το progressive reveal· `null` = δεν φορτώθηκε ποτέ σε
// αυτή τη συνεδρία → κανένα πέπλο (η προεπιλογή για όλα τα προϋπάρχοντα specs).
const getReadyAgeMs = jest.fn<number | null, unknown[]>(() => null);
jest.mock('../../library/bim-mesh-library/bim-mesh-cache', () => ({
  bimMeshCache: {
    getInstance: (...a: unknown[]) => getInstance(...a),
    preload: (...a: unknown[]) => preload(...a),
    getReadyAgeMs: (...a: unknown[]) => getReadyAgeMs(...a),
    getSilhouette: jest.fn(),
    getTopEdges: jest.fn(),
  },
}));

import { meshToObject3D, type MeshPlacement } from '../mesh-to-object3d';
import { disposeMeshReveal, isMeshRevealActive } from '../../reveal/mesh-reveal-fade';
import { isLoadingGhost } from '../../materials/loading-placeholder-material';

function placement(overrides: Partial<MeshPlacement> = {}): MeshPlacement {
  return {
    category: 'light-fixture',
    assetId: 'pendant_lamp_01',
    bimId: 'mepfix_1',
    bimType: 'mep-fixture',
    matId: 'elem-mep-fixture',
    position: { x: 1000, y: 2000 },
    rotationDeg: 0,
    scale: 1,
    widthMm: 300,
    depthMm: 300,
    heightMm: 400,
    sceneUnits: 'mm',
    floorElevationMm: 0,
    mountingElevationMm: 2700,
    verticalAnchor: 'top',
    buildingBaseElevationM: 0,
    ...overrides,
  };
}

beforeEach(() => {
  getInstance.mockReset();
  preload.mockReset();
  getReadyAgeMs.mockReset();
  getReadyAgeMs.mockReturnValue(null);
  disposeMeshReveal();
});

describe('meshToObject3D — cache miss (placeholder)', () => {
  it('returns a bbox placeholder, kicks off preload(category, assetId), tags entity', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement());
    expect(obj).toBeInstanceOf(THREE.Mesh);
    expect(preload).toHaveBeenCalledWith('light-fixture', 'pendant_lamp_01');
    expect(obj.userData['bimType']).toBe('mep-fixture');
    expect(obj.userData['bimId']).toBe('mepfix_1');
  });

  it("anchor 'top' hangs the box so its TOP sits at the mounting plane", () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement({ verticalAnchor: 'top' }));
    // plan (1000,2000) mm → world (1, *, -2) m; mounting 2.7m, height 0.4m centred
    // box → centre at mounting − h/2 = 2.7 − 0.2 = 2.5m.
    expect(obj.position.x).toBeCloseTo(1.0, 5);
    expect(obj.position.z).toBeCloseTo(-2.0, 5);
    expect(obj.position.y).toBeCloseTo(2.5, 5);
  });

  it("anchor 'base' rests the box so its BASE sits at the mounting plane", () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement({ verticalAnchor: 'base', mountingElevationMm: 0 }));
    // base on floor → box centre at h/2 = 0.2m.
    expect(obj.position.y).toBeCloseTo(0.2, 5);
  });

  it('is units-safe: a meter scene does NOT multiply position by 1000', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement({ sceneUnits: 'm', position: { x: 1, y: 2 } }));
    expect(obj.position.x).toBeCloseTo(1.0, 5);
    expect(obj.position.z).toBeCloseTo(-2.0, 5);
  });
});

/**
 * ADR-693 Άξονας Β — το placeholder είναι «φορτώνει» ghost, ΟΧΙ υλικό καταλόγου.
 *
 * Η παλινδρόμηση που φυλάνε αυτά: το `elem-imported-mesh` δεν ταίριαζε με κανένα prefix του
 * `MATERIAL_DEFS`, οπότε το παλιό `getMaterial3D(matId)` κατέληγε στο `DEFAULT_MATERIAL_KEY`
 * (= σκυρόδεμα) και ΝΤΥΝΕ τα κουτιά φόρτωσης με τη φωτογραφία σκυροδέματος, με σκιές. Ο χρήστης
 * δεν μπορούσε να ξεχωρίσει «φορτώνει» από «αυτό ΕΙΝΑΙ σκυρόδεμα» (Giorgio, browser 2026-07-24).
 */
describe('meshToObject3D — «φορτώνει» ghost (ADR-693)', () => {
  const IMPORTED = { matId: 'elem-imported-mesh', bimType: 'imported-mesh', category: 'imported' };

  it('το placeholder είναι ημιδιάφανο ghost χωρίς υφή — ποτέ φωτογραφία υλικού', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement(IMPORTED)) as THREE.Mesh;
    const mat = obj.material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.map).toBeNull();
  });

  it('ΔΕΝ ρίχνει σκιά — ούτε αφού περάσει από το tagObject traverse', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement(IMPORTED)) as THREE.Mesh;
    expect(obj.castShadow).toBe(false);
    expect(obj.receiveShadow).toBe(false);
  });

  it('κρατά την ταυτότητα οντότητας + το matId για τις τομές', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(placement(IMPORTED));
    expect(obj.userData['bimType']).toBe('imported-mesh');
    expect(obj.userData['matId']).toBe('elem-imported-mesh');
  });

  it('έχει τις ΜΕΤΡΗΜΕΝΕΣ διαστάσεις από το πρώτο καρέ (πλεονέκτημα έναντι Revit, §3.1)', () => {
    getInstance.mockReturnValue(null);
    const obj = meshToObject3D(
      placement({ ...IMPORTED, widthMm: 800, heightMm: 1200, depthMm: 400 }),
    ) as THREE.Mesh;
    const params = (obj.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBeCloseTo(0.8, 6);
    expect(params.height).toBeCloseTo(1.2, 6);
    expect(params.depth).toBeCloseTo(0.4, 6);
  });

  it('ένα ΠΡΑΓΜΑΤΙΚΟ mesh (cache hit) κρατά τις σκιές του — καμία παλινδρόμηση', () => {
    const tmpl = new THREE.Group();
    tmpl.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    getInstance.mockReturnValue(tmpl);
    const obj = meshToObject3D(placement(IMPORTED));
    const child = obj.children[0] as THREE.Mesh;
    expect(child.castShadow).toBe(true);
    expect(child.receiveShadow).toBe(true);
  });
});

/**
 * ADR-693 Φ2 — progressive reveal. Το πέπλο μπαίνει ΜΟΝΟ όταν το asset μόλις φορτώθηκε, και
 * ποτέ πάνω στα υλικά του πραγματικού πλέγματος (`getInstance` δίνει `clone(true)` = ΜΟΙΡΑΖΕΤΑΙ
 * υλικά με το cached template· μετάλλαξη εκεί θα άφηνε το template μόνιμα ημιδιάφανο).
 */
describe('meshToObject3D — progressive reveal (ADR-693 Φ2)', () => {
  function loadedTemplate(): THREE.Group {
    const tmpl = new THREE.Group();
    tmpl.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshStandardMaterial()));
    return tmpl;
  }

  function veilOf(obj: THREE.Object3D): THREE.Mesh | undefined {
    return obj.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && isLoadingGhost(c));
  }

  it('μόλις φορτώθηκε → κρεμά πέπλο πάνω στο πλέγμα και το καταχωρεί', () => {
    getInstance.mockReturnValue(loadedTemplate());
    getReadyAgeMs.mockReturnValue(0);
    const obj = meshToObject3D(placement());
    expect(veilOf(obj)).toBeDefined();
    expect(isMeshRevealActive()).toBe(true);
  });

  it('φορτωμένο εδώ και ώρα → ΚΑΝΕΝΑ πέπλο (δεν ξανα-αποκαλύπτεται σε κάθε resync)', () => {
    getInstance.mockReturnValue(loadedTemplate());
    getReadyAgeMs.mockReturnValue(5000);
    const obj = meshToObject3D(placement());
    expect(veilOf(obj)).toBeUndefined();
    expect(isMeshRevealActive()).toBe(false);
  });

  it('asset που δεν φορτώθηκε ποτέ σε αυτή τη συνεδρία → κανένα πέπλο', () => {
    getInstance.mockReturnValue(loadedTemplate());
    getReadyAgeMs.mockReturnValue(null);
    expect(veilOf(meshToObject3D(placement()))).toBeUndefined();
  });

  it('το πέπλο ΔΕΝ είναι επιλέξιμο — στόχος μένει το πραγματικό πλέγμα', () => {
    getInstance.mockReturnValue(loadedTemplate());
    getReadyAgeMs.mockReturnValue(0);
    const veil = veilOf(meshToObject3D(placement()));
    const hits: THREE.Intersection[] = [];
    veil?.raycast(new THREE.Raycaster(), hits);
    expect(hits).toEqual([]);
  });

  it('το πέπλο ΔΕΝ αγγίζει τα (μοιραζόμενα) υλικά του πραγματικού πλέγματος', () => {
    const tmpl = loadedTemplate();
    const realMat = (tmpl.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    getInstance.mockReturnValue(tmpl);
    getReadyAgeMs.mockReturnValue(0);
    meshToObject3D(placement());
    expect(realMat.transparent).toBe(false);
    expect(realMat.opacity).toBe(1);
  });

  it('το πέπλο έχει το μέγεθος του ΠΡΑΓΜΑΤΙΚΟΥ πλέγματος, όχι των μετρημένων διαστάσεων', () => {
    getInstance.mockReturnValue(loadedTemplate());
    getReadyAgeMs.mockReturnValue(0);
    const veil = veilOf(meshToObject3D(placement({ widthMm: 9999, heightMm: 9999, depthMm: 9999 })));
    const params = (veil?.geometry as THREE.BoxGeometry).parameters;
    expect([params.width, params.height, params.depth]).toEqual([1, 2, 3]);
  });
});

describe('meshToObject3D — cache hit (real mesh)', () => {
  it('clones-in-place, applies rotation + scale, never calls preload', () => {
    const tmpl = new THREE.Group();
    getInstance.mockReturnValue(tmpl);
    const obj = meshToObject3D(placement({ rotationDeg: 90, scale: 2 }));
    expect(obj).toBe(tmpl);
    expect(preload).not.toHaveBeenCalled();
    expect(obj.scale.x).toBeCloseTo(2, 5);
    expect(obj.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("anchor 'top' lands a real mesh's top edge on the mounting plane (bbox-based)", () => {
    // A 1m-tall box whose local centre is at y=0 → spans [-0.5, +0.5].
    const tmpl = new THREE.Group();
    tmpl.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2)));
    getInstance.mockReturnValue(tmpl);
    const obj = meshToObject3D(placement({ verticalAnchor: 'top', mountingElevationMm: 3000, scale: 1 }));
    // top of the box must sit at 3.0m → centre at 3.0 − 0.5 = 2.5m.
    expect(obj.position.y).toBeCloseTo(2.5, 4);
  });

  it('empty group falls back to anchor at origin (position.y === mounting)', () => {
    getInstance.mockReturnValue(new THREE.Group());
    const obj = meshToObject3D(placement({ verticalAnchor: 'base', mountingElevationMm: 0 }));
    expect(obj.position.y).toBeCloseTo(0, 5);
  });
});
