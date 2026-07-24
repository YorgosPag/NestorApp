/**
 * ADR-692 Φ2 — collectDxfMarqueeHits: window/crossing πάνω στο raw DXF wireframe μέσα στο 3D.
 *
 * Το ορθογώνιο χτίζεται από τις ΠΡΑΓΜΑΤΙΚΕΣ προβολές των άκρων (μέσω του ΙΔΙΟΥ projector που
 * χρησιμοποιεί ο κώδικας) — άρα το test δεν κουμπώνει σε συγκεκριμένο στήσιμο κάμερας, ελέγχει
 * τη ΣΗΜΑΣΙΟΛΟΓΙΑ: L→R = μόνο ό,τι είναι ΟΛΟ μέσα, R→L = ό,τι αγγίζει.
 */

import * as THREE from 'three';
import type { DxfScene, DxfEntityUnion } from '../../../../canvas-v2/dxf-canvas/dxf-types';
import { dxfPlanToWorld, createWorldToScreenProjector } from '../../../viewport/coordinate-transforms';
import { collectDxfMarqueeHits } from '../dxf-marquee-3d-hit-test';

const CANVAS_W = 800;
const CANVAS_H = 600;

function createCanvas(): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: CANVAS_W, bottom: CANVAS_H, width: CANVAS_W, height: CANVAS_H, x: 0, y: 0,
    }),
    clientWidth: CANVAS_W,
    clientHeight: CANVAS_H,
  } as unknown as HTMLElement;
}

/** Top-down ορθογραφική κάμερα (κάτοψη) — η κανονική «2Δ-σαν» θέα του DXF υποστρώματος. */
function createCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 1000);
  camera.up.set(0, 0, -1); // κοιτάζοντας κατακόρυφα, το «πάνω» της οθόνης πρέπει να είναι οριζόντιο
  camera.position.set(0, 50, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function line(id: string, ax: number, ay: number, bx: number, by: number): DxfEntityUnion {
  return {
    id, type: 'line', visible: true,
    start: { x: ax, y: ay }, end: { x: bx, y: by },
  } as DxfEntityUnion;
}

function scene(entities: DxfEntityUnion[]): DxfScene {
  return { entities, layers: [], bounds: null, units: 'mm' };
}

describe('collectDxfMarqueeHits', () => {
  const camera = createCamera();
  const canvas = createCanvas();
  const project = createWorldToScreenProjector(camera, canvas);

  /** Η προβολή ενός plan-mm σημείου σε client px (ίδια διαδρομή με τον κώδικα). */
  const screenOf = (x: number, y: number): { x: number; y: number } => {
    const p = project(dxfPlanToWorld(x, y, 0));
    if (!p) throw new Error('point behind camera');
    return p;
  };

  it('WINDOW (L→R): πιάνει τη γραμμή που είναι ΟΛΗ μέσα', () => {
    const a = screenOf(0, 0);
    const b = screenOf(1000, 1000);
    const pad = 20;
    const start = { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad };
    const end = { x: Math.max(a.x, b.x) + pad, y: Math.max(a.y, b.y) + pad };

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([line('l1', 0, 0, 1000, 1000)]), floorElevationMm: 0 }],
      camera, canvas, startPt: start, endPt: end,
    });

    expect(res.selectionType).toBe('window');
    expect(res.ids).toEqual(['l1']);
    expect([...res.scopeIds]).toEqual(['l1']);
  });

  it('WINDOW: ΔΕΝ πιάνει γραμμή που βγαίνει έξω από το κουτί', () => {
    const a = screenOf(0, 0);
    const mid = screenOf(500, 500);
    const start = { x: Math.min(a.x, mid.x), y: Math.min(a.y, mid.y) };
    const end = { x: Math.max(a.x, mid.x), y: Math.max(a.y, mid.y) };

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([line('l1', 0, 0, 1000, 1000)]), floorElevationMm: 0 }],
      camera, canvas, startPt: start, endPt: end,
    });

    expect(res.ids).toEqual([]);
  });

  it('CROSSING (R→L): πιάνει γραμμή που απλώς περνά από το κουτί', () => {
    const a = screenOf(0, 0);
    const mid = screenOf(500, 500);
    // R→L ⇒ startX > endX
    const left = { x: Math.min(a.x, mid.x), y: Math.min(a.y, mid.y) };
    const right = { x: Math.max(a.x, mid.x), y: Math.max(a.y, mid.y) };

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([line('l1', 0, 0, 1000, 1000)]), floorElevationMm: 0 }],
      camera, canvas, startPt: right, endPt: left,
    });

    expect(res.selectionType).toBe('crossing');
    expect(res.ids).toEqual(['l1']);
  });

  it('αγνοεί αόρατες οντότητες αλλά τις κρατά στο scope (για add/subtract)', () => {
    const hidden = { ...line('l1', 0, 0, 1000, 1000), visible: false } as DxfEntityUnion;
    const a = screenOf(-100, -100);
    const b = screenOf(1100, 1100);

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([hidden]), floorElevationMm: 0 }],
      camera, canvas,
      startPt: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      endPt: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    });

    expect(res.ids).toEqual([]);
    expect(res.scopeIds.has('l1')).toBe(true);
  });

  it('πολλαπλοί όροφοι: κάθε πάτωμα ελέγχεται στο δικό του υψόμετρο', () => {
    const a = screenOf(0, 0);
    const b = screenOf(1000, 1000);
    const pad = 20;

    const res = collectDxfMarqueeHits({
      floors: [
        { scene: scene([line('ground', 0, 0, 1000, 1000)]), floorElevationMm: 0 },
        { scene: scene([line('upper', 0, 0, 1000, 1000)]), floorElevationMm: 3000 },
      ],
      camera, canvas,
      startPt: { x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad },
      endPt: { x: Math.max(a.x, b.x) + pad, y: Math.max(a.y, b.y) + pad },
    });

    // Κάτοψη ⇒ η κατακόρυφη μετατόπιση δεν αλλάζει την προβολή: πιάνονται και οι δύο όροφοι.
    expect(res.ids.sort()).toEqual(['ground', 'upper']);
  });

  it('τύποι χωρίς γραμμική αναπαράσταση (π.χ. dimension) αγνοούνται', () => {
    const unsupported = { id: 'd1', type: 'dimension', visible: true } as unknown as DxfEntityUnion;
    const a = screenOf(-1000, -1000);
    const b = screenOf(1000, 1000);

    const res = collectDxfMarqueeHits({
      floors: [{ scene: scene([unsupported]), floorElevationMm: 0 }],
      camera, canvas,
      startPt: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      endPt: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
    });

    expect(res.ids).toEqual([]);
  });
});
