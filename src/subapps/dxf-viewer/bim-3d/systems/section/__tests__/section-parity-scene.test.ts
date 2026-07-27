/**
 * ADR-621 — SSoT scene-masking + renderer-state helpers shared by the section cut
 * cap passes. These pin the contract the renderer + secondary passes rely on:
 *   • overlays (M/V/N diagrams, edge fat-lines) are ALWAYS hidden from the parity;
 *   • `keepMesh` masks BIM meshes; meshes without a `bimId` are never hidden;
 *   • the render-state guard sets cap-pass flags during the body and ALWAYS restores.
 */

import * as THREE from 'three';
import {
  hideNonParityMeshes,
  restoreHidden,
  withSectionCapRenderState,
} from '../section-parity-scene';
import { excludeFromSectionParity, isSectionParityOverlay } from '../section-parity-overlay';

/** Mark a mesh as a section-parity overlay (edge fat-line kind — see `isSectionParityOverlay`). */
function markOverlay(obj: THREE.Object3D): void {
  obj.userData.bimEdgeOverlay = true;
}

function bimMesh(id: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.userData.bimId = id;
  return mesh;
}

describe('hideNonParityMeshes', () => {
  it('always hides overlays and restores them, regardless of keepMesh', () => {
    const scene = new THREE.Scene();
    const overlay = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    markOverlay(overlay);
    const solid = bimMesh('col-1');
    scene.add(overlay, solid);

    const hidden = hideNonParityMeshes(scene);
    expect(overlay.visible).toBe(false);
    // No keepMesh ⇒ non-overlay BIM meshes stay visible.
    expect(solid.visible).toBe(true);
    expect(hidden).toContain(overlay);

    restoreHidden(hidden);
    expect(overlay.visible).toBe(true);
  });

  it('hides only the BIM meshes keepMesh rejects, leaving bimId-less meshes visible', () => {
    const scene = new THREE.Scene();
    const keep = bimMesh('keep-me');
    const drop = bimMesh('drop-me');
    const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    scene.add(keep, drop, plain);

    const hidden = hideNonParityMeshes(scene, (_obj, bimId) => bimId === 'keep-me');
    expect(keep.visible).toBe(true);
    expect(drop.visible).toBe(false);
    // No bimId ⇒ never hidden (e.g. lights, helper meshes).
    expect(plain.visible).toBe(true);
    expect(hidden).toEqual([drop]);
  });

  it('does not collect already-hidden objects (no phantom re-show on restore)', () => {
    const scene = new THREE.Scene();
    const overlay = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    markOverlay(overlay);
    overlay.visible = false;
    scene.add(overlay);

    const hidden = hideNonParityMeshes(scene);
    expect(hidden).toHaveLength(0);
  });
});

describe('withSectionCapRenderState', () => {
  interface FakeRenderer {
    autoClear: boolean;
    autoClearColor: boolean;
    autoClearDepth: boolean;
    autoClearStencil: boolean;
  }
  const makeRenderer = (): FakeRenderer => ({
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,
  });

  it('sets cap-pass flags + nulls background during the body, restores after', () => {
    const renderer = makeRenderer();
    const scene = new THREE.Scene();
    const bg = new THREE.Color(0x123456);
    scene.background = bg;

    let insideAutoClear: boolean | null = null;
    let insideBackground: THREE.Color | THREE.Texture | null = null;
    withSectionCapRenderState(renderer as unknown as THREE.WebGLRenderer, scene, () => {
      insideAutoClear = renderer.autoClear;
      insideBackground = scene.background as THREE.Color | null;
    });

    expect(insideAutoClear).toBe(false);
    expect(insideBackground).toBeNull();
    expect(renderer.autoClear).toBe(true);
    expect(renderer.autoClearStencil).toBe(true);
    expect(scene.background).toBe(bg);
  });

  it('restores state even when the body throws', () => {
    const renderer = makeRenderer();
    const scene = new THREE.Scene();
    const bg = new THREE.Color(0x654321);
    scene.background = bg;

    expect(() =>
      withSectionCapRenderState(renderer as unknown as THREE.WebGLRenderer, scene, () => {
        throw new Error('render failed');
      }),
    ).toThrow('render failed');

    expect(renderer.autoClear).toBe(true);
    expect(scene.background).toBe(bg);
  });
});

/**
 * ADR-665 M2.7 — η ρητή εξαίρεση από τα parity passes, που κλείνει το Open Question #2.
 *
 * Το κενό που καλύπτει: ένα mesh ΧΩΡΙΣ `bimId` δεν κρυβόταν ΠΟΤΕ (ο έλεγχος `keepMesh` τρέχει μόνο
 * σε `bimId` meshes). Το ανάγλυφο και ο cap χώματος είναι ακριβώς τέτοια — ανοιχτές, μη-manifold
 * επιφάνειες που όμως μετρούσαν σε stencil parity σχεδιασμένο για κλειστά στερεά.
 */
describe('ADR-665 M2.7 — sectionParityExclude', () => {
  function plainMesh(): THREE.Mesh {
    // depthTest ΠΑΡΑΜΕΝΕΙ true: αν κρυβόταν λόγω `depthTest:false` το τεστ θα περνούσε για
    // λάθος λόγο, και ο cap θα ζωγράφιζε πάνω από το κτίριο.
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  }

  it('mesh χωρίς bimId ΚΑΙ χωρίς δείκτη → μένει ορατό (η προϋπάρχουσα συμπεριφορά)', () => {
    const scene = new THREE.Scene();
    const terrain = plainMesh();
    scene.add(terrain);
    const hidden = hideNonParityMeshes(scene);
    expect(terrain.visible).toBe(true);
    restoreHidden(hidden);
  });

  it('ο δείκτης κρύβει το mesh στο parity pass και το `restoreHidden` το επαναφέρει', () => {
    const scene = new THREE.Scene();
    const cap = plainMesh();
    excludeFromSectionParity(cap);
    scene.add(cap);

    const hidden = hideNonParityMeshes(scene);
    expect(cap.visible).toBe(false);
    expect(hidden).toContain(cap);

    restoreHidden(hidden);
    expect(cap.visible).toBe(true);
  });

  it('ο δείκτης λειτουργεί με depthTest = true — δεν βασίζεται στο overlay κριτήριο', () => {
    const cap = plainMesh();
    excludeFromSectionParity(cap);
    expect((cap.material as THREE.MeshBasicMaterial).depthTest).toBe(true);
    expect(isSectionParityOverlay(cap)).toBe(true);
  });
});
