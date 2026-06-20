/**
 * Tests — beam→column face snap resolver (ADR-398 §Smart beam ghost).
 *
 * Κολόνα αναφοράς: ορθογώνια 400×400 με κέντρο (0,0) → minX/minY = −200, maxX/maxY = 200.
 * beamWidthScene = 300 (half = 150), ghostLenScene = 1200, captureScene = 600.
 */

import {
  resolveBeamColumnFaceSnap,
  resolveBeamGhostSnapFromStore,
  type BeamFaceSnapOptions,
} from '../beam-column-face-snap';
import type { Point2D } from '../../../rendering/types/Types';

const COL_400: Point2D[] = [
  { x: -200, y: -200 },
  { x: 200, y: -200 },
  { x: 200, y: 200 },
  { x: -200, y: 200 },
];

const OPTS: BeamFaceSnapOptions = {
  beamWidthScene: 300,
  ghostLenScene: 1200,
  captureScene: 600,
};

function snap(cursor: Point2D, cols: Point2D[][] = [COL_400]) {
  return resolveBeamColumnFaceSnap(cursor, cols, OPTS);
}

describe('resolveBeamColumnFaceSnap — EAST face (horizontal beam, exits +X)', () => {
  it('lo third → south faces flush (centerline y = minY + half)', () => {
    const r = snap({ x: 250, y: -150 });
    expect(r).not.toBeNull();
    expect(r!.face).toBe('E');
    expect(r!.third).toBe('lo');
    expect(r!.start).toEqual({ x: 200, y: -50 }); // minY(-200) + half(150)
    expect(r!.end).toEqual({ x: 1400, y: -50 }); // maxX(200) + len(1200)
  });

  it('mid third → centerline ≡ column centre', () => {
    const r = snap({ x: 250, y: 0 });
    expect(r!.face).toBe('E');
    expect(r!.third).toBe('mid');
    expect(r!.start).toEqual({ x: 200, y: 0 });
    expect(r!.end).toEqual({ x: 1400, y: 0 });
  });

  it('hi third → north faces flush (centerline y = maxY − half)', () => {
    const r = snap({ x: 250, y: 150 });
    expect(r!.face).toBe('E');
    expect(r!.third).toBe('hi');
    expect(r!.start).toEqual({ x: 200, y: 50 }); // maxY(200) − half(150)
    expect(r!.end).toEqual({ x: 1400, y: 50 });
  });
});

describe('resolveBeamColumnFaceSnap — WEST face (horizontal beam, exits −X)', () => {
  it('lo third', () => {
    const r = snap({ x: -250, y: -150 });
    expect(r!.face).toBe('W');
    expect(r!.third).toBe('lo');
    expect(r!.start).toEqual({ x: -200, y: -50 });
    expect(r!.end).toEqual({ x: -1400, y: -50 }); // minX(-200) − len(1200)
  });

  it('mid third', () => {
    const r = snap({ x: -250, y: 0 });
    expect(r!.face).toBe('W');
    expect(r!.third).toBe('mid');
    expect(r!.start).toEqual({ x: -200, y: 0 });
  });

  it('hi third', () => {
    const r = snap({ x: -250, y: 150 });
    expect(r!.face).toBe('W');
    expect(r!.third).toBe('hi');
    expect(r!.start).toEqual({ x: -200, y: 50 });
  });
});

describe('resolveBeamColumnFaceSnap — SOUTH face (vertical beam, exits −Y)', () => {
  it('lo third → west faces flush (centerline x = minX + half)', () => {
    const r = snap({ x: -150, y: -250 });
    expect(r!.face).toBe('S');
    expect(r!.third).toBe('lo');
    expect(r!.start).toEqual({ x: -50, y: -200 });
    expect(r!.end).toEqual({ x: -50, y: -1400 }); // minY(-200) − len(1200)
  });

  it('mid third', () => {
    const r = snap({ x: 0, y: -250 });
    expect(r!.face).toBe('S');
    expect(r!.third).toBe('mid');
    expect(r!.start).toEqual({ x: 0, y: -200 });
  });

  it('hi third → east faces flush (centerline x = maxX − half)', () => {
    const r = snap({ x: 150, y: -250 });
    expect(r!.face).toBe('S');
    expect(r!.third).toBe('hi');
    expect(r!.start).toEqual({ x: 50, y: -200 });
  });
});

describe('resolveBeamColumnFaceSnap — NORTH face (vertical beam, exits +Y)', () => {
  it('lo third', () => {
    const r = snap({ x: -150, y: 250 });
    expect(r!.face).toBe('N');
    expect(r!.third).toBe('lo');
    expect(r!.start).toEqual({ x: -50, y: 200 });
    expect(r!.end).toEqual({ x: -50, y: 1400 }); // maxY(200) + len(1200)
  });

  it('mid third', () => {
    const r = snap({ x: 0, y: 250 });
    expect(r!.face).toBe('N');
    expect(r!.third).toBe('mid');
    expect(r!.start).toEqual({ x: 0, y: 200 });
  });

  it('hi third', () => {
    const r = snap({ x: 150, y: 250 });
    expect(r!.face).toBe('N');
    expect(r!.third).toBe('hi');
    expect(r!.start).toEqual({ x: 50, y: 200 });
  });
});

describe('resolveBeamColumnFaceSnap — capture gate + edge cases', () => {
  it('returns null far from any column (free placement)', () => {
    expect(snap({ x: 2000, y: 2000 })).toBeNull();
  });

  it('snaps exactly at capture distance, releases just beyond', () => {
    expect(snap({ x: 800, y: 0 })).not.toBeNull(); // dx = 600 = capture
    expect(snap({ x: 801, y: 0 })).toBeNull(); // dx = 601 > capture
  });

  it('ignores degenerate footprints (<3 vertices)', () => {
    expect(snap({ x: 250, y: 0 }, [[{ x: 0, y: 0 }, { x: 1, y: 1 }]])).toBeNull();
  });

  it('picks the nearest column when several are in range', () => {
    const far: Point2D[] = COL_400.map((p) => ({ x: p.x + 800, y: p.y }));
    const r = snap({ x: 250, y: 0 }, [far, COL_400]);
    expect(r!.start.x).toBe(200); // east face of the near (origin) column, dist 50 ≪ 350
  });

  it('cursor inside the footprint still resolves a face (no crash)', () => {
    const r = snap({ x: 100, y: 10 });
    expect(r).not.toBeNull();
    expect(r!.face).toBe('E'); // |ex|=0.5 ≥ |ey|=0.05 → east
  });
});

describe('resolveBeamGhostSnapFromStore — mm→scene wrapper (preview === commit SSoT)', () => {
  it("mm scene: identity factor, matches the pure resolver (column path → status neutral)", () => {
    const r = resolveBeamGhostSnapFromStore({ x: 250, y: 0 }, [COL_400], [], 300, 'mm');
    expect(r!.start).toEqual({ x: 200, y: 0 });
    expect(r!.end).toEqual({ x: 1400, y: 0 });
    expect(r!.status).toBe('neutral');
  });

  it('empty footprints + empty beams → null (free placement, no work)', () => {
    expect(resolveBeamGhostSnapFromStore({ x: 0, y: 0 }, [], [], 300, 'mm')).toBeNull();
  });

  it('metre scene: scales footprints/width/len consistently', () => {
    const colM: Point2D[] = [
      { x: -0.2, y: -0.2 },
      { x: 0.2, y: -0.2 },
      { x: 0.2, y: 0.2 },
      { x: -0.2, y: 0.2 },
    ];
    const r = resolveBeamGhostSnapFromStore({ x: 0.25, y: 0 }, [colM], [], 300, 'm');
    expect(r).not.toBeNull();
    expect(r!.status).toBe('neutral'); // column path
    expect(r!.start.x).toBeCloseTo(0.2, 6); // maxX of the metre column
    expect(r!.end.x).toBeCloseTo(1.4, 6); // 0.2 + 1200mm→1.2m
  });

  it('column-priority: κολόνα εντός capture νικά τα δοκάρια (status neutral)', () => {
    const beamTarget = {
      id: 'b1',
      axis: [{ x: 0, y: 0 }, { x: 5000, y: 0 }],
      outline: [{ x: 0, y: -100 }, { x: 5000, y: -100 }, { x: 5000, y: 100 }, { x: 0, y: 100 }],
    };
    const r = resolveBeamGhostSnapFromStore({ x: 250, y: 0 }, [COL_400], [beamTarget], 300, 'mm');
    expect(r!.status).toBe('neutral'); // η κολόνα υπερισχύει
  });
});
