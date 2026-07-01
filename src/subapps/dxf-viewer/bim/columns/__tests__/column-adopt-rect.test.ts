/**
 * ADR-398 §3.17 — pure resolver «υιοθέτηση μεγέθους ορθογωνίου»: EC2 §9.6.1 ταξινόμηση (κολόνα/τοιχίο),
 * διαστάσεις/γωνία από `rectColumnPlacement`, threshold «αισθητής διαφοράς», Φ1 (rectTargets) + Φ2
 * (4 γραμμές, corner-graph, boundary-inclusive).
 */

import {
  resolveAdoptProposal,
  shouldProposeAdopt,
  findAdoptableRectUnderPoint,
  findAdoptableColumnPerimeter,
  resolvePerimeterAdoptInfo,
  ADOPT_MIN_SIZE_MM,
} from '../column-adopt-rect';
import type { RectFrame } from '../../framing/rect-frame';
import type { DetectedRectangle } from '../../walls/wall-in-region';
import type { Entity } from '../../../types/entities';

/** Axis-aligned DetectedRectangle w×h (mm, scene units = mm) με κάτω-αριστερά στο (0,0). */
function rect(w: number, h: number): DetectedRectangle {
  return {
    polygon: [
      { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h },
    ],
    longSide: Math.max(w, h),
    shortSide: Math.min(w, h),
    area: w * h,
  };
}

/** Axis-aligned RectFrame: center + ημι-εκτάσεις (scene units). */
function axisFrame(cx: number, cy: number, halfW: number, halfV: number): RectFrame {
  return { center: { x: cx, y: cy }, u: { x: 1, y: 0 }, v: { x: 0, y: 1 }, halfW, halfV };
}

function line(id: string, ax: number, ay: number, bx: number, by: number): Entity {
  return { id, type: 'line', start: { x: ax, y: ay }, end: { x: bx, y: by } } as unknown as Entity;
}

describe('resolveAdoptProposal — EC2 §9.6.1 ταξινόμηση', () => {
  it('250×500 (αναλογία 2 ≤ 4) → ΚΟΛΟΝΑ rectangular, width=longSide, depth=shortSide', () => {
    const p = resolveAdoptProposal(rect(500, 250), 'mm');
    expect(p.kind).toBe('rectangular');
    expect(p.isShearWall).toBe(false);
    expect(p.widthMm).toBeCloseTo(500);
    expect(p.depthMm).toBeCloseTo(250);
    expect(p.center).toEqual({ x: 250, y: 125 });
  });

  it('200×2500 (αναλογία 12.5 > 4) → ΤΟΙΧΙΟ shear-wall', () => {
    const p = resolveAdoptProposal(rect(200, 2500), 'mm');
    expect(p.kind).toBe('shear-wall');
    expect(p.isShearWall).toBe(true);
    expect(p.widthMm).toBeCloseTo(2500);
    expect(p.depthMm).toBeCloseTo(200);
  });

  it('ακριβώς 4:1 (1000×250) → ΚΟΛΟΝΑ (≤ 4 = κολόνα, EC2)', () => {
    const p = resolveAdoptProposal(rect(1000, 250), 'mm');
    expect(p.isShearWall).toBe(false);
  });

  it('units cm → scene 50 = 500mm (scene→mm)', () => {
    const p = resolveAdoptProposal(rect(50, 25), 'cm');
    expect(p.widthMm).toBeCloseTo(500);
    expect(p.depthMm).toBeCloseTo(250);
  });
});

describe('shouldProposeAdopt', () => {
  const eff = { width: 400, depth: 400 };
  it('αισθητή διαφορά → true', () => {
    expect(shouldProposeAdopt({ widthMm: 500, depthMm: 250 }, eff)).toBe(true);
  });
  it('≈ default → false (μηδέν ενόχληση)', () => {
    expect(shouldProposeAdopt({ widthMm: 400, depthMm: 400 }, eff)).toBe(false);
    expect(shouldProposeAdopt({ widthMm: 410, depthMm: 405 }, eff)).toBe(false);
  });
  it('τοιχίο (200×2500) εντός ορίων πάχους → true', () => {
    expect(shouldProposeAdopt({ widthMm: 2500, depthMm: 200 }, eff)).toBe(true);
  });
  it('περίγραμμα κτιρίου (μικρή πλευρά > 3000mm) → false', () => {
    expect(shouldProposeAdopt({ widthMm: 27000, depthMm: 25000 }, eff)).toBe(false);
  });
  it('πολύ μικρό (< MIN) → false', () => {
    expect(shouldProposeAdopt({ widthMm: ADOPT_MIN_SIZE_MM - 1, depthMm: 600 }, eff)).toBe(false);
  });
});

describe('findAdoptableRectUnderPoint — Φ1 (rectTargets)', () => {
  it('σημείο μέσα σε ορθογώνιο → DetectedRectangle', () => {
    const got = findAdoptableRectUnderPoint({ x: 1000, y: 1000 }, [axisFrame(1000, 1000, 125, 300)], [], 1);
    expect(got).not.toBeNull();
    expect(got!.longSide).toBeCloseTo(600);
    expect(got!.shortSide).toBeCloseTo(250);
  });
  it('σημείο εκτός + καμία γραμμή → null', () => {
    expect(findAdoptableRectUnderPoint({ x: 5000, y: 5000 }, [axisFrame(1000, 1000, 125, 300)], [], 1)).toBeNull();
  });
  it('παραλληλόγραμμο (μη ορθογώνιο) → null (orthogonality guard)', () => {
    const skew: RectFrame = { center: { x: 0, y: 0 }, u: { x: 1, y: 0 }, v: { x: 0.5, y: 0.866 }, halfW: 200, halfV: 200 };
    expect(findAdoptableRectUnderPoint({ x: 0, y: 0 }, [skew], [], 1)).toBeNull();
  });
});

describe('findAdoptableRectUnderPoint — Φ2 (4 ξεχωριστές γραμμές, corner-graph)', () => {
  const square: Entity[] = [
    line('l1', 0, 0, 600, 0),
    line('l2', 600, 0, 600, 600),
    line('l3', 600, 600, 0, 600),
    line('l4', 0, 600, 0, 0),
  ];
  it('σημείο μέσα → DetectedRectangle ~600×600', () => {
    const got = findAdoptableRectUnderPoint({ x: 300, y: 300 }, [], square, 1);
    expect(got).not.toBeNull();
    expect(got!.longSide).toBeCloseTo(600);
  });
  it('σημείο ΠΑΝΩ στην ακμή (snapped κλικ) → βρίσκεται (boundary-inclusive)', () => {
    const got = findAdoptableRectUnderPoint({ x: 600, y: 300 }, [], square, 1);
    expect(got).not.toBeNull();
  });
  it('σημείο εκτός → null', () => {
    expect(findAdoptableRectUnderPoint({ x: 2000, y: 2000 }, [], square, 1)).toBeNull();
  });
});

// Giorgio 2026-07-01 — «πλήρες/επαγγελματικό»: ο σκέτος «Κολόνα» πιάνει ΚΑΘΕ κλειστό
// σχήμα (ορθογώνιο + Γ/Τ/Π). ΕΝΑ resolver για hover preview + adopt click.
describe('findAdoptableColumnPerimeter — rect + Γ/Τ/Π', () => {
  // 4 γραμμές → ορθογώνιο 500×250.
  const rectLines: Entity[] = [
    line('r1', 0, 0, 500, 0),
    line('r2', 500, 0, 500, 250),
    line('r3', 500, 250, 0, 250),
    line('r4', 0, 250, 0, 0),
  ];
  // 6 γραμμές → σχήμα Γ (L): κάτω μπάρα 0..300 ×0..100, αριστερή κολόνα 0..100 ×0..300.
  const lLines: Entity[] = [
    line('a', 0, 0, 300, 0),
    line('b', 300, 0, 300, 100),
    line('c', 300, 100, 100, 100),
    line('d', 100, 100, 100, 300),
    line('e', 100, 300, 0, 300),
    line('f', 0, 300, 0, 0),
  ];

  it('ορθογώνιο (4 γραμμές) → shape rectangle, isRectangle=true', () => {
    const p = findAdoptableColumnPerimeter({ x: 250, y: 125 }, [], rectLines, 1, 'mm');
    expect(p).not.toBeNull();
    expect(p!.shape).toBe('rectangle');
    const info = resolvePerimeterAdoptInfo(p!, 'mm');
    expect(info.isRectangle).toBe(true);
    expect(info.widthMm).toBeCloseTo(500);
    expect(info.depthMm).toBeCloseTo(250);
  });

  it('σχήμα Γ (6 γραμμές) → μη-ορθογώνιο τοιχίο (polygon-backed)', () => {
    const p = findAdoptableColumnPerimeter({ x: 50, y: 50 }, [], lLines, 1, 'mm');
    expect(p).not.toBeNull();
    expect(p!.shape).not.toBe('rectangle');
    expect(p!.polygon.length).toBeGreaterThanOrEqual(6);
    const info = resolvePerimeterAdoptInfo(p!, 'mm');
    expect(info.isRectangle).toBe(false);
    expect(info.isShearWall).toBe(true);
    expect(info.widthMm).toBeCloseTo(300);
    expect(info.depthMm).toBeCloseTo(300);
  });

  it('κενός χώρος (καμία γραμμή κοντά) → null', () => {
    expect(findAdoptableColumnPerimeter({ x: 9999, y: 9999 }, [], rectLines, 1, 'mm')).toBeNull();
  });
});
