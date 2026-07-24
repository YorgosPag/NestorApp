/**
 * ADR-689 Φ2 — `attachImportedMeshWireframe`: Wireframe view style στα εισαγόμενα πλέγματα.
 *
 * Επαληθεύει: `faceMode:'none'` → κρύβει τις επιφάνειες + προσθέτει `LineSegments(WireframeGeometry)`
 * ανά mesh (κάθε τριγωνάκι, όπως AutoCAD)· κάθε άλλο style → no-op.
 */

import * as THREE from 'three';

const mockState = jest.fn<{ faceMode: string; backgroundMode: string }, []>();
jest.mock('../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: { getState: () => mockState() },
}));

import { attachImportedMeshWireframe } from '../imported-mesh-wireframe';

/** Group με ΕΝΑ mesh τριγώνου. */
function meshObject(): { object: THREE.Object3D; mesh: THREE.Mesh } {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
  const object = new THREE.Group();
  object.add(mesh);
  return { object, mesh };
}

afterEach(() => mockState.mockReset());

describe('attachImportedMeshWireframe', () => {
  it("faceMode 'none' → κρύβει faces + προσθέτει WireframeGeometry LineSegments", () => {
    mockState.mockReturnValue({ faceMode: 'none', backgroundMode: 'dark' });
    const { object, mesh } = meshObject();

    attachImportedMeshWireframe(object);

    // (1) επιφάνειες κρυμμένες
    expect((mesh.material as THREE.Material).visible).toBe(false);
    // (2) ΕΝΑ wireframe overlay child, full triangulation
    const wires = mesh.children.filter((c) => c.userData['importedMeshWireframe']);
    expect(wires).toHaveLength(1);
    const wire = wires[0] as THREE.LineSegments;
    expect(wire).toBeInstanceOf(THREE.LineSegments);
    expect(wire.geometry).toBeInstanceOf(THREE.WireframeGeometry);
    expect((wire.material as THREE.LineBasicMaterial).depthTest).toBe(false);
  });

  it("faceMode 'shaded' → no-op (καμία αλλαγή)", () => {
    mockState.mockReturnValue({ faceMode: 'shaded', backgroundMode: 'dark' });
    const { object, mesh } = meshObject();

    attachImportedMeshWireframe(object);

    expect((mesh.material as THREE.Material).visible).toBe(true);
    expect(mesh.children).toHaveLength(0);
  });

  it('δεν επαναλαμβάνει σε ήδη προστεθειμένα LineSegments (traverse-safe)', () => {
    mockState.mockReturnValue({ faceMode: 'none', backgroundMode: 'light' });
    const { object, mesh } = meshObject();

    attachImportedMeshWireframe(object);

    // ΕΝΑ overlay — όχι overlay πάνω σε overlay.
    expect(mesh.children).toHaveLength(1);
    expect(mesh.children[0].children).toHaveLength(0);
  });
});
