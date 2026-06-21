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
// ADR-510 Φ2C — expected world-unit dash values from SSoT (bimDashMm × DASH_WORLD_SCALE_M=0.006).
import { bimDashMm } from '../../../config/bim-dash-resolver';

const DASH_WORLD_SCALE_M = 0.006;

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

    it('returns null for DEGENERATE geometry (a collapsed axis — ADR-452)', () => {
      // Zero-thickness "solid" (a flat quad) — a mis-placed / default entity.
      // EdgesGeometry still emits an outline, but there is nothing to outline in 3D.
      const flat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
      const overlay = buildEdgeOverlay(flat, {
        lineWidthPx: 1.5,
        color: '#000000',
        thresholdAngle: 30,
        visible: true,
      });
      expect(overlay).toBeNull();
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

    it('renderOrder > 0 (v2.21 — draws after the depthWrite faces, no overdraw)', () => {
      // The faces keep the default renderOrder 0; the depthWrite:false overlay must
      // render later or the faces overwrite the painted edge pixels (Shaded with Edges).
      expect(overlay?.renderOrder).toBeGreaterThan(0);
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

  // ── ADR-446 — EDGES axis: occlude → depthTest ───────────────────────────────
  describe('occlude option (Visual Style EDGES axis)', () => {
    it('default (occlude omitted) → depthTest=true (only-visible edges)', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true,
      });
      expect((overlay?.material as LineMaterial).depthTest).toBe(true);
    });

    it('occlude=true → depthTest=true', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true, occlude: true,
      });
      expect((overlay?.material as LineMaterial).depthTest).toBe(true);
    });

    it('occlude=false → depthTest=false (x-ray, all edges through faces)', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true, occlude: false,
      });
      expect((overlay?.material as LineMaterial).depthTest).toBe(false);
    });
  });

  // ── ADR-377 Phase E — line pattern → dashed LineMaterial ─────────────────────
  describe('linePattern → dashed material (ADR-377 Phase E)', () => {
    it('solid (default) → material.dashed=false', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true,
      });
      expect((overlay?.material as LineMaterial).dashed).toBe(false);
    });

    it("linePattern='solid' explicit → material.dashed=false", () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true,
        linePattern: 'solid',
      });
      expect((overlay?.material as LineMaterial).dashed).toBe(false);
    });

    it("linePattern='dashed' → dashed=true, dashSize/gapSize from SSoT bimDashMm('dashed') × DASH_WORLD_SCALE_M", () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true,
        linePattern: 'dashed',
      });
      const mat = overlay?.material as LineMaterial;
      const dashedMm = bimDashMm('dashed');
      const expectedDashSize = (dashedMm[0] ?? 0) * DASH_WORLD_SCALE_M;
      const expectedGapSize = Math.abs(dashedMm[1] ?? 0) * DASH_WORLD_SCALE_M;
      expect(mat.dashed).toBe(true);
      expect(mat.dashSize).toBeCloseTo(expectedDashSize, 6);
      expect(mat.gapSize).toBeCloseTo(expectedGapSize, 6);
    });

    it("linePattern='hidden' → dashed=true, dashSize/gapSize from SSoT bimDashMm('hidden') × DASH_WORLD_SCALE_M", () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true,
        linePattern: 'hidden',
      });
      const mat = overlay?.material as LineMaterial;
      const hiddenMm = bimDashMm('hidden');
      const expectedDashSize = (hiddenMm[0] ?? 0) * DASH_WORLD_SCALE_M;
      const expectedGapSize = Math.abs(hiddenMm[1] ?? 0) * DASH_WORLD_SCALE_M;
      expect(mat.dashed).toBe(true);
      expect(mat.dashSize).toBeCloseTo(expectedDashSize, 6);
      expect(mat.gapSize).toBeCloseTo(expectedGapSize, 6);
    });

    it("linePattern='dot' (zero-length dash) → falls back to solid", () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true,
        linePattern: 'dot',
      });
      expect((overlay?.material as LineMaterial).dashed).toBe(false);
    });

    it('dashed overlay still computes line distances (no crash)', () => {
      const overlay = buildEdgeOverlay(makeBoxMesh(), {
        lineWidthPx: 1.0, color: '#000', thresholdAngle: 30, visible: true,
        linePattern: 'dashed',
      });
      expect(overlay).toBeInstanceOf(LineSegments2);
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
