/**
 * ADR-689 Φ3 — `attachMeshWireframe`: το Visual Style στα πλέγματα, χωρίς επιπλέον αντικείμενα.
 *
 * Η ΟΥΣΙΑ που φυλάει αυτό το τεστ: σε αντίθεση με τη Φ2 (που κρέμαγε ένα `LineSegments` παιδί σε
 * κάθε mesh), εδώ το mesh **αλλάζει ρούχα**. Ένα `expect(mesh.children).toHaveLength(0)` είναι
 * ολόκληρο το κέρδος απόδοσης σε μία γραμμή.
 */

import * as THREE from 'three';

const mockState = jest.fn<
  { faceMode: string; backgroundMode: string; meshWireMode: string; meshWireWidthPx: number },
  []
>();
jest.mock('../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: { getState: () => mockState() },
}));

import { attachMeshWireframe, isMeshWireframeActive } from '../attach-mesh-wireframe';
import { hasWireCodes } from '../mesh-wire-geometry';
import { MESH_WIRE_MATERIAL_FLAG, MESH_WIRE_RENDER_ORDER } from '../mesh-wire-material';

/** Group με ΕΝΑ mesh τριγώνου (το σχήμα που δίνει ο `meshToObject3D`). */
function meshObject(): { object: THREE.Object3D; mesh: THREE.Mesh } {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const object = new THREE.Group();
  object.add(mesh);
  return { object, mesh };
}

function state(faceMode: string, overrides: Partial<{ backgroundMode: string; meshWireMode: string; meshWireWidthPx: number }> = {}) {
  return {
    faceMode,
    backgroundMode: 'dark',
    meshWireMode: 'feature',
    meshWireWidthPx: 1,
    ...overrides,
  };
}

afterEach(() => mockState.mockReset());

describe('attachMeshWireframe — «Συρμάτινο» (faceMode none)', () => {
  it('ΔΕΝ προσθέτει κανένα αντικείμενο — το ίδιο το mesh γίνεται το wireframe', () => {
    mockState.mockReturnValue(state('none'));
    const { object, mesh } = meshObject();

    attachMeshWireframe(object);

    expect(mesh.children).toHaveLength(0);
    expect(hasWireCodes(mesh.geometry)).toBe(true);
    expect(mesh.material.userData[MESH_WIRE_MATERIAL_FLAG]).toBe('wireframe');
    expect(mesh.renderOrder).toBe(MESH_WIRE_RENDER_ORDER);
  });

  it('x-ray: οι πίσω ακμές φαίνονται μέσα από τις (ανύπαρκτες) όψεις — ADR-446 edgeMode «all»', () => {
    mockState.mockReturnValue(state('none'));
    const { object, mesh } = meshObject();

    attachMeshWireframe(object);

    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.depthTest).toBe(false);
    expect(material.transparent).toBe(true);
  });

  it('σβήνει τις σκιές — ένα κενό συρμάτινο αντικείμενο δεν ρίχνει συμπαγή σκιά', () => {
    mockState.mockReturnValue(state('none'));
    const { object, mesh } = meshObject();

    attachMeshWireframe(object);

    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(false);
  });

  it('idempotent — δεύτερη κλήση δεν χτίζει τίποτα ξανά', () => {
    mockState.mockReturnValue(state('none'));
    const { object, mesh } = meshObject();

    attachMeshWireframe(object);
    const geometry = mesh.geometry;
    const material = mesh.material;
    attachMeshWireframe(object);

    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBe(material);
  });
});

describe('attachMeshWireframe — «Κρυφή Γραμμή» (faceMode hidden-line)', () => {
  it('αδιαφανείς όψεις-occluder ΜΑΖΙ με τις ακμές, σε ένα pass', () => {
    mockState.mockReturnValue(state('hidden-line'));
    const { object, mesh } = meshObject();

    attachMeshWireframe(object);

    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(mesh.material.userData[MESH_WIRE_MATERIAL_FLAG]).toBe('hidden-line');
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.depthTest).toBe(true);
    expect(mesh.children).toHaveLength(0);
  });
});

describe('attachMeshWireframe — τα υπόλοιπα στυλ', () => {
  it.each(['shaded', 'realistic', 'consistent'])('«%s» → no-op (μηδέν regression)', (faceMode) => {
    mockState.mockReturnValue(state(faceMode));
    const { object, mesh } = meshObject();
    const geometry = mesh.geometry;

    attachMeshWireframe(object);

    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.castShadow).toBe(true);
  });
});

describe('isMeshWireframeActive', () => {
  it('true μόνο στα δύο στυλ γραμμής', () => {
    mockState.mockReturnValue(state('none'));
    expect(isMeshWireframeActive()).toBe(true);
    mockState.mockReturnValue(state('hidden-line'));
    expect(isMeshWireframeActive()).toBe(true);
    mockState.mockReturnValue(state('shaded'));
    expect(isMeshWireframeActive()).toBe(false);
  });
});
