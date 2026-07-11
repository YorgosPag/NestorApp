/**
 * Bathroom room constraints tests · ADR-638 (Στάδιο 3).
 *
 * Covers the two real-world constraints: (1) door swing quadrants derived from the
 * real `OpeningGeometry.hingeArc` (single + double-leaf + non-hinged fallback +
 * scene→mm), (2) interior plaster thickness resolution + room inset, and the solver
 * integration that keeps fixtures OUT of a swing zone. Pure — no scene mutation.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import {
  extractDoorConstraints,
  resolveInteriorFinishThicknessMm,
  insetRoomForPlasterMm,
  solveBathroomLayout,
} from '../index';
import { areaOf, rectOverlapMm2 } from '../layout-geometry';

/** Minimal opening-entity stub (only the fields the extractor reads). */
function doorStub(opts: {
  kind: string;
  width: number;
  position?: Point2D;
  hingeAnchor?: Point2D;
  hingeAnchor2?: Point2D;
  arc?: Point2D[];
}): Entity {
  const lift = (p: Point2D) => ({ x: p.x, y: p.y, z: 0 });
  return {
    type: 'opening',
    params: { kind: opts.kind, width: opts.width },
    geometry: {
      position: opts.position ? lift(opts.position) : undefined,
      hingeAnchor: opts.hingeAnchor ? lift(opts.hingeAnchor) : undefined,
      hingeAnchor2: opts.hingeAnchor2 ? lift(opts.hingeAnchor2) : undefined,
      hingeArc: opts.arc ? { points: opts.arc.map(lift), closed: false } : undefined,
    },
  } as unknown as Entity;
}

/** Minimal wall-entity stub (only `params.finish` is read). */
function wallStub(finish?: { enabled: boolean; thickness: number }): Entity {
  return {
    type: 'wall',
    params: finish
      ? { finish: { enabled: finish.enabled, thickness: finish.thickness, interiorMaterialId: 'x', exteriorMaterialId: 'y' } }
      : {},
  } as unknown as Entity;
}

/** A quarter-arc (radius r, apex at origin) from +X sweeping to +Y, sampled. */
function quarterArc(r: number, seg = 6): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * (Math.PI / 2);
    pts.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
  }
  return pts;
}

describe('extractDoorConstraints — swing quadrants from the real hinge arc', () => {
  it('single hinged door → one convex swing sector (apex + arc), scene→mm', () => {
    const arc = quarterArc(900);
    const door = doorStub({ kind: 'door', width: 900, hingeAnchor: { x: 0, y: 0 }, arc });
    const { swingZonesMm, fallbackDoors } = extractDoorConstraints([door], 'mm');
    expect(swingZonesMm).toHaveLength(1);
    expect(fallbackDoors).toHaveLength(0);
    // apex first, then every arc sample.
    expect(swingZonesMm[0]).toHaveLength(arc.length + 1);
    expect(swingZonesMm[0][0]).toEqual({ x: 0, y: 0 });
    // A real quarter-disc sector has meaningful area.
    expect(areaOf(swingZonesMm[0])).toBeGreaterThan(0);
  });

  it('scales scene→mm for non-mm scenes (metres × 1000)', () => {
    const door = doorStub({ kind: 'door', width: 900, hingeAnchor: { x: 1, y: 0 }, arc: quarterArc(0.9) });
    const { swingZonesMm } = extractDoorConstraints([door], 'm');
    expect(swingZonesMm[0][0]).toEqual({ x: 1000, y: 0 });
  });

  it('double-leaf door → two convex sectors (one per leaf)', () => {
    const arc = [...quarterArc(700), ...quarterArc(700)]; // arc1 ++ arc2 as geometry concatenates
    const door = doorStub({
      kind: 'double-door', width: 1400,
      hingeAnchor: { x: 0, y: 0 }, hingeAnchor2: { x: 1400, y: 0 }, arc,
    });
    const { swingZonesMm } = extractDoorConstraints([door], 'mm');
    expect(swingZonesMm).toHaveLength(2);
  });

  it('non-hinged door (sliding) → no swing zone, a fallback marker instead', () => {
    const door = doorStub({ kind: 'sliding-door', width: 1800, position: { x: 500, y: 0 } });
    const { swingZonesMm, fallbackDoors } = extractDoorConstraints([door], 'mm');
    expect(swingZonesMm).toHaveLength(0);
    expect(fallbackDoors).toEqual([{ positionMm: { x: 500, y: 0 }, widthMm: 1800 }]);
  });

  it('ignores windows entirely', () => {
    const win = doorStub({ kind: 'window', width: 1200, position: { x: 0, y: 0 } });
    const { swingZonesMm, fallbackDoors } = extractDoorConstraints([win], 'mm');
    expect(swingZonesMm).toHaveLength(0);
    expect(fallbackDoors).toHaveLength(0);
  });
});

describe('resolveInteriorFinishThicknessMm — plaster from BIM walls', () => {
  it('takes the max active interior finish thickness', () => {
    const entities = [wallStub({ enabled: true, thickness: 15 }), wallStub({ enabled: true, thickness: 20 })];
    expect(resolveInteriorFinishThicknessMm(entities)).toBe(20);
  });

  it('ignores disabled / absent finishes → 0 (nothing to inset)', () => {
    const entities = [wallStub({ enabled: false, thickness: 30 }), wallStub()];
    expect(resolveInteriorFinishThicknessMm(entities)).toBe(0);
  });
});

describe('insetRoomForPlasterMm — hug the finished face', () => {
  const room: Point2D[] = [{ x: 0, y: 0 }, { x: 2400, y: 0 }, { x: 2400, y: 2400 }, { x: 0, y: 2400 }];

  it('thickness 0 → polygon unchanged', () => {
    expect(insetRoomForPlasterMm(room, 0)).toEqual(room);
  });

  it('positive thickness → area shrinks by ~2×t per side', () => {
    const inset = insetRoomForPlasterMm(room, 15);
    // 2400² = 5.76e6 → 2370² ≈ 5.6169e6 (each side pulled in 15mm).
    expect(areaOf(inset)).toBeCloseTo(2370 * 2370, -2);
    expect(areaOf(inset)).toBeLessThan(areaOf(room));
  });
});

describe('solver honours door swing zones (ADR-638 Στάδιο 3)', () => {
  it('no fixture footprint intrudes into a swing quadrant', () => {
    const room: Point2D[] = [{ x: 0, y: 0 }, { x: 2600, y: 0 }, { x: 2600, y: 2600 }, { x: 0, y: 2600 }];
    // A swing sector hugging the bottom-left corner (apex on the bottom wall).
    const zone: Point2D[] = [{ x: 300, y: 0 }, ...quarterArc(900).map((p) => ({ x: 300 + p.x, y: p.y }))];
    const [best] = solveBathroomLayout({
      polygonMm: room,
      fixtures: ['wc', 'washbasin', 'shower', 'bidet'],
      doorKeepClearsMm: [zone],
    });
    expect(best).toBeDefined();
    const tol = 1; // mm² numerical noise
    for (const p of best.placements) {
      expect(rectOverlapMm2(p.footprint, zone)).toBeLessThanOrEqual(tol);
    }
  });
});
