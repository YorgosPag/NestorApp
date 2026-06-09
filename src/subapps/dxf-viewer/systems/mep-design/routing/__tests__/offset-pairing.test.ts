/**
 * ADR-429 — discipline-agnostic offset pairing core tests.
 *
 * Pure geometry: arms reconstruction, lateral offset, root stub, branch re-tap, and the
 * index tagging (sourceTrunkIndex / armFirstTrunkIndex / targetIndex) that lets a caller copy
 * its own per-run metadata back. No heating/water types here — that is the whole point.
 */

import { buildOffsetPairing, type OffsetRun } from '../offset-pairing';
import { segmentHitsObstacles } from '../wall-obstacles';
import type { Rect2D } from '../routing-constants';

function run(sx: number, sy: number, ex: number, ey: number): OffsetRun {
  return { start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}

// Single right arm: source(0,0) → (1500,0) → (3000,0).
const SINGLE_ARM: OffsetRun[] = [run(0, 0, 1500, 0), run(1500, 0, 3000, 0)];
const TARGETS = [{ x: 1500, y: 800 }, { x: 3000, y: 800 }];

describe('ADR-429 — buildOffsetPairing (single arm)', () => {
  const pairing = buildOffsetPairing(SINGLE_ARM, { x: 0, y: 0 }, { x: 0, y: 0 }, TARGETS, 52);

  it('offsets the spine laterally to +y=52 (left of +x travel), tagged by source index', () => {
    expect(pairing.trunks).toHaveLength(2);
    expect(pairing.trunks.every((t) => Math.abs(t.start.y - 52) < 1e-6 && Math.abs(t.end.y - 52) < 1e-6)).toBe(true);
    // …and never overlaps the reference spine (y=0).
    expect(pairing.trunks.every((t) => Math.abs(t.start.y) > 1e-6)).toBe(true);
    // each offset trunk is tagged with the reference trunk index it parallels.
    expect(pairing.trunks.map((t) => t.sourceTrunkIndex).sort()).toEqual([0, 1]);
  });

  it('bridges the root to the offset spine with a stub tagged by the arm first index', () => {
    expect(pairing.stubs).toHaveLength(1);
    expect(pairing.stubs[0].start).toEqual({ x: 0, y: 0 });
    expect(pairing.stubs[0].end).toEqual({ x: 0, y: 52 });
    expect(pairing.stubs[0].armFirstTrunkIndex).toBe(0);
  });

  it('re-taps every target onto the spine, tagged by target index', () => {
    expect(pairing.branches).toHaveLength(2);
    for (let i = 0; i < TARGETS.length; i++) {
      const branch = pairing.branches.find((b) => b.targetIndex === i)!;
      expect(branch.end).toEqual(TARGETS[i]);
      expect(Math.abs(branch.start.y - 52) < 1e-6).toBe(true); // starts on the offset spine
    }
  });
});

describe('ADR-429 — buildOffsetPairing (two arms)', () => {
  // Right arm travel +x ⇒ +y ; left arm travel −x ⇒ −y.
  const twoArm: OffsetRun[] = [run(0, 0, 1500, 0), run(0, 0, -1500, 0)];
  const targets = [{ x: 1500, y: 800 }, { x: -1500, y: 800 }];
  const pairing = buildOffsetPairing(twoArm, { x: 0, y: 0 }, { x: 0, y: 0 }, targets, 52);

  it('offsets each arm onto the opposite side of the spine', () => {
    const ys = pairing.trunks.map((t) => t.start.y);
    expect(ys.some((y) => Math.abs(y - 52) < 1e-6)).toBe(true);
    expect(ys.some((y) => Math.abs(y + 52) < 1e-6)).toBe(true);
  });

  it('emits one stub per arm and re-taps both targets', () => {
    expect(pairing.stubs).toHaveLength(2);
    expect(pairing.branches.map((b) => b.targetIndex).sort()).toEqual([0, 1]);
  });
});

describe('ADR-429 — buildOffsetPairing (root already on the spine)', () => {
  it('omits the stub when the root coincides with the offset arm start', () => {
    // root = (0,52) is exactly the offset arm start ⇒ no stub needed.
    const pairing = buildOffsetPairing(SINGLE_ARM, { x: 0, y: 0 }, { x: 0, y: 52 }, TARGETS, 52);
    expect(pairing.stubs).toHaveLength(0);
    expect(pairing.trunks).toHaveLength(2);
  });
});

describe('ADR-429 Slice 3C — buildOffsetPairing wall-aware repair', () => {
  // A straight reference spine (already wall-aware at y=0); its lateral offset at y=52 would land
  // ON this wall (y∈[40,400]) while the reference (y=0) clears it.
  const straight: OffsetRun[] = [run(0, 0, 3000, 0)];
  const farTarget = [{ x: 2800, y: 800 }]; // off to the side, its branch clears the wall
  const wall: Rect2D = { minX: 1400, minY: 40, maxX: 1600, maxY: 400 };

  it('locally detours an offset trunk that lands on a wall, keeping its source tag', () => {
    const pairing = buildOffsetPairing(straight, { x: 0, y: 0 }, { x: 0, y: 0 }, farTarget, 52, {
      obstacles: [wall],
    });
    // the single offset run is split into an A* detour (more than one sub-run)…
    expect(pairing.trunks.length).toBeGreaterThan(1);
    // …all still tagged to the one reference trunk (so meta copy by index is unchanged)…
    expect(pairing.trunks.every((t) => t.sourceTrunkIndex === 0)).toBe(true);
    // …and no resulting trunk passes through the wall interior.
    for (const t of pairing.trunks) expect(segmentHitsObstacles(t.start, t.end, [wall])).toBe(false);
  });

  it('is a byte-identical no-op without obstacles', () => {
    const plain = buildOffsetPairing(straight, { x: 0, y: 0 }, { x: 0, y: 0 }, farTarget, 52);
    const empty = buildOffsetPairing(straight, { x: 0, y: 0 }, { x: 0, y: 0 }, farTarget, 52, {
      obstacles: [],
    });
    expect(empty.trunks).toEqual(plain.trunks);
    expect(empty.branches).toEqual(plain.branches);
    expect(empty.stubs).toEqual(plain.stubs);
  });
});
