/**
 * ADR-398 §3.17 — pure resolver «υιοθέτηση μεγέθους ορθογωνίου»: διαστάσεις/γωνία από RectFrame,
 * threshold «αισθητής διαφοράς», orthogonality guard, Φ1 (rectTargets) + Φ2 (4 γραμμές) detection.
 */

import {
  rectFrameToColumnDims,
  shouldProposeAdopt,
  findAdoptableRectUnderPoint,
  ADOPT_MIN_SIZE_MM,
  ADOPT_MAX_SIZE_MM,
} from '../column-adopt-rect';
import type { RectFrame } from '../../framing/rect-frame';
import type { Entity } from '../../../types/entities';

/** Axis-aligned frame: center + ημι-εκτάσεις (scene units). */
function axisFrame(cx: number, cy: number, halfW: number, halfV: number): RectFrame {
  return { center: { x: cx, y: cy }, u: { x: 1, y: 0 }, v: { x: 0, y: 1 }, halfW, halfV };
}

function line(id: string, ax: number, ay: number, bx: number, by: number): Entity {
  return { id, type: 'line', start: { x: ax, y: ay }, end: { x: bx, y: by } } as unknown as Entity;
}

describe('rectFrameToColumnDims', () => {
  it('axis-aligned (mm) → W×H = 2·half, γωνία 0', () => {
    const dims = rectFrameToColumnDims(axisFrame(1000, 1000, 125, 300), 'mm');
    expect(dims.widthMm).toBeCloseTo(250);
    expect(dims.depthMm).toBeCloseTo(600);
    expect(dims.rotationDeg).toBeCloseTo(0);
  });

  it('λοξό ορθογώνιο → γωνία = γωνία του άξονα u (45°)', () => {
    const s = Math.SQRT1_2;
    const rect: RectFrame = { center: { x: 0, y: 0 }, u: { x: s, y: s }, v: { x: -s, y: s }, halfW: 100, halfV: 200 };
    const dims = rectFrameToColumnDims(rect, 'mm');
    expect(dims.widthMm).toBeCloseTo(200);
    expect(dims.depthMm).toBeCloseTo(400);
    expect(dims.rotationDeg).toBeCloseTo(45);
  });

  it('units cm → scene 12.5 = 250mm (scene→mm conversion)', () => {
    const dims = rectFrameToColumnDims(axisFrame(0, 0, 12.5, 30), 'cm');
    expect(dims.widthMm).toBeCloseTo(250);
    expect(dims.depthMm).toBeCloseTo(600);
  });
});

describe('shouldProposeAdopt', () => {
  const eff = { width: 400, depth: 400 };
  it('αισθητή διαφορά → true', () => {
    expect(shouldProposeAdopt({ widthMm: 250, depthMm: 600, rotationDeg: 0 }, eff)).toBe(true);
  });
  it('≈ default → false (μηδέν ενόχληση)', () => {
    expect(shouldProposeAdopt({ widthMm: 400, depthMm: 400, rotationDeg: 0 }, eff)).toBe(false);
    expect(shouldProposeAdopt({ widthMm: 410, depthMm: 405, rotationDeg: 0 }, eff)).toBe(false);
  });
  it('διαφορά πάνω από το threshold σε μία διάσταση → true', () => {
    expect(shouldProposeAdopt({ widthMm: 425, depthMm: 400, rotationDeg: 0 }, eff)).toBe(true);
  });
  it('εκτός λογικού μεγέθους (πολύ μικρό / περίγραμμα κτιρίου) → false', () => {
    expect(shouldProposeAdopt({ widthMm: ADOPT_MIN_SIZE_MM - 1, depthMm: 600, rotationDeg: 0 }, eff)).toBe(false);
    expect(shouldProposeAdopt({ widthMm: ADOPT_MAX_SIZE_MM + 1, depthMm: 600, rotationDeg: 0 }, eff)).toBe(false);
  });
});

describe('findAdoptableRectUnderPoint — Φ1 (rectTargets)', () => {
  it('σημείο μέσα σε ορθογώνιο → επιστρέφει το frame', () => {
    const rect = axisFrame(1000, 1000, 125, 300);
    const got = findAdoptableRectUnderPoint({ x: 1000, y: 1000 }, [rect], [], 1);
    expect(got).toBe(rect);
  });
  it('σημείο εκτός + καμία γραμμή → null', () => {
    const rect = axisFrame(1000, 1000, 125, 300);
    expect(findAdoptableRectUnderPoint({ x: 5000, y: 5000 }, [rect], [], 1)).toBeNull();
  });
  it('παραλληλόγραμμο (μη ορθογώνιο) → null (orthogonality guard)', () => {
    // u, v όχι κάθετα → λοξό παραλληλόγραμμο, όχι ορθογώνιο.
    const skew: RectFrame = { center: { x: 0, y: 0 }, u: { x: 1, y: 0 }, v: { x: 0.5, y: 0.866 }, halfW: 200, halfV: 200 };
    expect(findAdoptableRectUnderPoint({ x: 0, y: 0 }, [skew], [], 1)).toBeNull();
  });
});

describe('findAdoptableRectUnderPoint — Φ2 (4 ξεχωριστές γραμμές)', () => {
  const square: Entity[] = [
    line('l1', 0, 0, 600, 0),
    line('l2', 600, 0, 600, 600),
    line('l3', 600, 600, 0, 600),
    line('l4', 0, 600, 0, 0),
  ];
  it('σημείο μέσα σε ορθογώνιο από 4 γραμμές → frame ~600×600', () => {
    const got = findAdoptableRectUnderPoint({ x: 300, y: 300 }, [], square, 1);
    expect(got).not.toBeNull();
    expect(got!.halfW * 2).toBeCloseTo(600);
    expect(got!.halfV * 2).toBeCloseTo(600);
  });
  it('σημείο εκτός → null', () => {
    expect(findAdoptableRectUnderPoint({ x: 2000, y: 2000 }, [], square, 1)).toBeNull();
  });
});
