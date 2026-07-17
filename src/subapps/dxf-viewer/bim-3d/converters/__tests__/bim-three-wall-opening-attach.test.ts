/**
 * ADR-668 §10 / ADR-669 §5.6 — τα σώματα του κουφώματος σφραγίζονται με το catalog `matId` τους.
 *
 * Το `attachOpeningMeshes` δίνει σε κάθε sub-mesh (κάσα/φύλλο = `mat-wood`, υαλοστάσιο = `mat-glass`)
 * `userData.matId` = το ΙΔΙΟ catalog id που χτίζει το υλικό του. Έτσι η 3Δ εξαγωγή το ονομάζει
 * σημασιολογικά (Revit/ArchiCAD: named part-surfaces) αντί για fallback στο χρώμα, και το
 * `resolveBimMeshIdentity` (export) το βρίσκει ΠΑΝΩ στο ίδιο το mesh — δεν χρειάζεται (ούτε
 * επιτρέπεται πλέον) να ανέβει στο σκυρόδεμα του τοίχου.
 */

import * as THREE from 'three';
import { attachOpeningMeshes } from '../bim-three-wall-opening-attach';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { OpeningEntity, OpeningParams } from '../../../bim/types/opening-types';

function makeWall(): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
    baseOffset: 0, topOffset: 0, sceneUnits: 'm',
  };
  return {
    id: 'wall_test', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function makeOpening(overrides?: Partial<OpeningParams>): OpeningEntity {
  const params: OpeningParams = {
    kind: 'door', wallId: 'wall_test', offsetFromStart: 1000,
    width: 900, height: 2100, sillHeight: 0, frameWidth: 50, ...overrides,
  };
  return {
    id: 'op_test', type: 'opening', kind: params.kind, layerId: '0', params,
    geometry: {
      position: { x: 1.45, y: 0, z: 0 }, rotation: 0, outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, perimeter: 0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as OpeningEntity;
}

/** Όλα τα matId των mesh κάτω από το group (χωρίς τα ασφράγιστα). */
function collectMatIds(root: THREE.Object3D): string[] {
  const ids: string[] = [];
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh === true) {
      const id = m.userData['matId'];
      if (typeof id === 'string') ids.push(id);
    }
  });
  return ids;
}

describe('attachOpeningMeshes — matId stamping (ADR-668 §10)', () => {
  it('stamps every door sub-mesh with the wood catalog id', () => {
    const group = new THREE.Group();
    attachOpeningMeshes(group, makeWall(), [makeOpening()], 0, 0);

    const ids = collectMatIds(group);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id === 'mat-wood')).toBe(true);
  });

  it('stamps the glazing panel with the glass id and the frame with the wood id', () => {
    const group = new THREE.Group();
    attachOpeningMeshes(
      group,
      makeWall(),
      [makeOpening({ kind: 'window', width: 1200, height: 1400, sillHeight: 900 })],
      0,
      0,
    );

    const ids = collectMatIds(group);
    expect(ids).toContain('mat-glass'); // υαλοστάσιο
    expect(ids).toContain('mat-wood');  // κάσα
    // κανένα σώμα κουφώματος δεν παίρνει το υλικό του τοίχου
    expect(ids).not.toContain('mat-concrete-c25');
  });

  it('every stamped mesh keeps the opening bimId (matId does not cross the element)', () => {
    const group = new THREE.Group();
    group.userData = { bimId: 'wall_test', bimType: 'wall', matId: 'mat-concrete-c25' };
    attachOpeningMeshes(group, makeWall(), [makeOpening()], 0, 0);

    group.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh === true && typeof m.userData['matId'] === 'string') {
        expect(m.userData['bimType']).toBe('opening');
      }
    });
  });

  it('zero regression — an opening with no materials override stamps the wood default', () => {
    const group = new THREE.Group();
    attachOpeningMeshes(group, makeWall(), [makeOpening()], 0, 0);

    const ids = collectMatIds(group);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id === 'mat-wood')).toBe(true);
  });

  it('stamps the RESOLVED per-part material id when params.materials overrides frame + leaf', () => {
    const group = new THREE.Group();
    // door: κάσα (jambs/head) = materials.frame, φύλλο = materials.leaf — override και τα δύο
    // solid parts ώστε το 'mat-wood' default να ΜΗΝ εμφανίζεται καθόλου (proves resolved, not default).
    attachOpeningMeshes(
      group,
      makeWall(),
      [makeOpening({ materials: { frame: 'mat-metal', leaf: 'mat-metal' } })],
      0,
      0,
    );

    const ids = collectMatIds(group);
    expect(ids.length).toBeGreaterThan(0);
    // κάθε σώμα (κάσα + φύλλο) φέρει το ΑΝΑ-ΑΝΟΙΓΜΑ resolved id, όχι το module-scope default.
    expect(ids.every((id) => id === 'mat-metal')).toBe(true);
    expect(ids).not.toContain('mat-wood');
  });
});
