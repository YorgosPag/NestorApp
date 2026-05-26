/**
 * ADR-375 Phase C.7 — BIM 3D Edge Overlay Builder tests.
 *
 * Covers:
 *   - LineSegments2 type returned for valid input
 *   - visible=false / lineWidthPx<=0 → null (caller skips attach)
 *   - devicePixelRatio multiplication applied to LineMaterial.linewidth
 *   - resolution uniform initialized from store + updates on store.setSize
 *   - alphaToCoverage + depthWrite=false + depthTest=true (industry config)
 *   - attachEdgeOverlay no-ops on null, adds overlay as child otherwise
 *   - geometry.dispose unsubscribes from resolution store
 */
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import {
  buildEdgeOverlay,
  attachEdgeOverlay,
} from '../bim-3d-edge-overlay-builder';
import { bimEdgeResolutionStore } from '../bim-edge-resolution-store';

function makeBoxMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
}

describe('ADR-375 C.7 — buildEdgeOverlay', () => {
  beforeEach(() => {
    bimEdgeResolutionStore.setSize(800, 600);
  });

  describe('basic construction', () => {
    it('returns LineSegments2 for a box mesh with valid opts', () => {
      const mesh = makeBoxMesh();
      const overlay = buildEdgeOverlay(mesh, {
        lineWidthPx: 1.5,
        color: '#000000',
        thresholdAngle: 30,
        visible: true,
      });
      expect(overlay).not.toBeNull();
      expect(overlay).toBeInstanceOf(LineSegments2);
    });

    it('marks userData.bimEdgeOverlay=true', () => {
      const mesh = makeBoxMesh();
      const overlay = buildEdgeOverlay(mesh, {
        lineWidthPx: 1.0,
        color: '#1a1a1a',
        thresholdAngle: 30,
        visible: true,
      });
      expect(overlay?.userData['bimEdgeOverlay']).toBe(true);
    });

    it('material is LineMaterial instance', () => {
      const mesh = makeBoxMesh();
      const overlay = buildEdgeOverlay(mesh, {
        lineWidthPx: 1.0,
        color: '#000000',
        thresholdAngle: 30,
        visible: true,
      });
      expect(overlay?.material).toBeInstanceOf(LineMaterial);
    });
  });

  describe('skip / null returns', () => {
    it('visible=false → null', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.5,
        color: '#000',
        thresholdAngle: 30,
        visible: false,
      });
      expect(overlay).toBeNull();
    });

    it('lineWidthPx=0 → null (even when visible=true)', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 0,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
      });
      expect(overlay).toBeNull();
    });

    it('lineWidthPx<0 → null', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: -1,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
      });
      expect(overlay).toBeNull();
    });
  });

  describe('devicePixelRatio multiplication', () => {
    it('linewidth = lineWidthPx × devicePixelRatio (injected)', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.5,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
        devicePixelRatio: 2,
      });
      expect((overlay?.material as LineMaterial).linewidth).toBeCloseTo(3.0, 5);
    });

    it('default devicePixelRatio applied when not injected', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 2.0,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
      });
      const mat = overlay?.material as LineMaterial;
      expect(mat.linewidth).toBeGreaterThan(0);
    });
  });

  describe('industry config (depth + alphaToCoverage)', () => {
    let overlay: LineSegments2 | null;
    beforeEach(() => {
      overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
      });
    });

    it('depthTest=true', () => {
      expect((overlay?.material as LineMaterial).depthTest).toBe(true);
    });

    it('depthWrite=false (prevents z-fighting with surface)', () => {
      expect((overlay?.material as LineMaterial).depthWrite).toBe(false);
    });

    it('alphaToCoverage=true (MSAA edge smoothing)', () => {
      expect((overlay?.material as LineMaterial).alphaToCoverage).toBe(true);
    });
  });

  describe('resolution uniform sync', () => {
    it('initialized from store on construction', () => {
      bimEdgeResolutionStore.setSize(1024, 768);
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
      });
      const res = (overlay?.material as LineMaterial).resolution;
      expect(res.x).toBe(1024);
      expect(res.y).toBe(768);
    });

    it('updates when store.setSize is called', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
      });
      bimEdgeResolutionStore.setSize(1920, 1080);
      const res = (overlay?.material as LineMaterial).resolution;
      expect(res.x).toBe(1920);
      expect(res.y).toBe(1080);
    });

    it('geometry.dispose unsubscribes from store (no leak)', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0,
        color: '#000',
        thresholdAngle: 30,
        visible: true,
      });
      overlay!.geometry.dispose();
      const matBefore = (overlay?.material as LineMaterial).resolution.x;
      bimEdgeResolutionStore.setSize(matBefore + 500, 600);
      const matAfter = (overlay?.material as LineMaterial).resolution.x;
      expect(matAfter).toBe(matBefore);
    });
  });

  describe('color handling', () => {
    it('null color → DEFAULT_EDGE_COLOR (#1a1a1a)', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0,
        color: null,
        thresholdAngle: 30,
        visible: true,
      });
      const hex = (overlay?.material as LineMaterial).color.getHex();
      expect(hex).toBe(0x1a1a1a);
    });

    it('hex color string applied to material', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0,
        color: '#ff0000',
        thresholdAngle: 30,
        visible: true,
      });
      const hex = (overlay?.material as LineMaterial).color.getHex();
      expect(hex).toBe(0xff0000);
    });
  });
});

describe('ADR-375 C.7 — attachEdgeOverlay', () => {
  it('no-ops when overlay is null', () => {
    const mesh = makeBoxMesh();
    const result = attachEdgeOverlay(mesh, null);
    expect(result).toBeNull();
    expect(mesh.children.length).toBe(0);
  });

  it('adds overlay as child of mesh and returns it', () => {
    const mesh = makeBoxMesh();
    const overlay = buildEdgeOverlay(mesh, {
      lineWidthPx: 1.0,
      color: '#000',
      thresholdAngle: 30,
      visible: true,
    });
    const result = attachEdgeOverlay(mesh, overlay);
    expect(result).toBe(overlay);
    expect(mesh.children).toContain(overlay);
  });
});
