/**
 * ADR-533 — Unit tests για τον καθαρό αναγνωριστή συμβόλου κουφώματος.
 * Synthetic fixtures (zero React/EventBus): οριζόντιος τοίχος (0,0)→(1000,0),
 * πάχος 200 scene units. Τα door fixtures χτίζονται με την ίδια γεωμετρία που
 * παράγει το `buildDoorSymbolSegments` (oracle): τόξο 90° + φύλλο κάθετο.
 */

import { detectSymbolsOnWall } from '../dxf-symbol-detector';
import type { ArcEntity, LineEntity } from '../../../types/entities';

const START = { x: 0, y: 0 };
const END = { x: 1000, y: 0 };
const THICK = 200;

function arc(id: string, cx: number, cy: number, r: number, startDeg: number, endDeg: number, ccw = false): ArcEntity {
  return { id, layerId: 'lyr_test', type: 'arc', center: { x: cx, y: cy }, radius: r, startAngle: startDeg, endAngle: endDeg, counterclockwise: ccw };
}

function line(id: string, x1: number, y1: number, x2: number, y2: number): LineEntity {
  return { id, layerId: 'lyr_test', type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
}

/** Κανονική πόρτα: μεντεσές (cx,0), κλειστό κατά +x, ανοιχτό κατά +y. */
function doorFixture(cx: number, r: number): (ArcEntity | LineEntity)[] {
  return [arc('arc1', cx, 0, r, 0, 90), line('leaf1', cx, 0, cx, r)];
}

describe('detectSymbolsOnWall — door', () => {
  it('detects a canonical 90° arc + leaf (hinge left, inward)', () => {
    const out = detectSymbolsOnWall(START, END, THICK, doorFixture(300, 90));
    expect(out).toHaveLength(1);
    const d = out[0];
    expect(d.kind).toBe('door');
    expect(d.widthScene).toBeCloseTo(90, 1);
    expect(d.tCenter).toBeCloseTo(0.345, 2);
    expect(d.handing).toBe('left');
    expect(d.openDirection).toBe('inward');
    expect(d.sourceEntityId).toBe('arc1');
  });

  it('maps openDirection outward when the leaf swings to −y', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [arc('a', 300, 0, 90, 0, -90), line('l', 300, 0, 300, -90)]);
    expect(out).toHaveLength(1);
    expect(out[0].openDirection).toBe('outward');
  });

  it('maps handing right when the hinge is on the +x (end) side of the closed run', () => {
    // closed run toward −x → hinge param > closed param → handing right.
    const out = detectSymbolsOnWall(START, END, THICK, [arc('a', 400, 0, 90, 180, 90), line('l', 400, 0, 400, 90)]);
    expect(out).toHaveLength(1);
    expect(out[0].handing).toBe('right');
  });

  it('detects a door with the counterclockwise flag set (endpoints identical)', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [arc('a', 300, 0, 90, 0, 90, true), line('l', 300, 0, 300, 90)]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('door');
  });

  it('rejects an arc whose span is far from 90°', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [arc('a', 300, 0, 90, 0, 180), line('l', 300, 0, 300, 90)]);
    expect(out).toHaveLength(0);
  });

  it('rejects an arc whose center is too far from the wall', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [arc('a', 300, 600, 90, 0, 90), line('l', 300, 600, 300, 690)]);
    expect(out).toHaveLength(0);
  });

  it('rejects a valid arc with no matching leaf line', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [arc('a', 300, 0, 90, 0, 90)]);
    expect(out).toHaveLength(0);
  });

  it('rejects when the leaf length does not match the radius', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [arc('a', 300, 0, 90, 0, 90), line('l', 300, 0, 300, 400)]);
    expect(out).toHaveLength(0);
  });
});

describe('detectSymbolsOnWall — window', () => {
  it('detects 2 parallel glass lines bridging the gap', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [line('g1', 400, 30, 550, 30), line('g2', 400, -30, 550, -30)]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('window');
    expect(out[0].widthScene).toBeCloseTo(150, 1);
    expect(out[0].tCenter).toBeCloseTo(0.475, 2);
  });

  it('rejects lines perpendicular to the wall (jambs, not glass)', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [line('a', 400, -50, 400, 50), line('b', 550, -50, 550, 50)]);
    expect(out).toHaveLength(0);
  });

  it('rejects two lines at the same perp offset (a single edge)', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [line('a', 400, 30, 550, 30), line('b', 420, 30, 560, 30)]);
    expect(out).toHaveLength(0);
  });

  it('rejects full-length parallel lines (the wall faces, not a window)', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [line('a', 0, 80, 1000, 80), line('b', 0, -80, 1000, -80)]);
    expect(out).toHaveLength(0);
  });
});

describe('detectSymbolsOnWall — multi & empty', () => {
  it('detects two doors on the same wall', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [...doorFixture(250, 90), ...doorFixture(700, 90).map(reId)]);
    expect(out.filter((d) => d.kind === 'door')).toHaveLength(2);
  });

  it('detects one door + one window together', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [
      ...doorFixture(250, 90),
      line('g1', 600, 30, 750, 30),
      line('g2', 600, -30, 750, -30),
    ]);
    expect(out.filter((d) => d.kind === 'door')).toHaveLength(1);
    expect(out.filter((d) => d.kind === 'window')).toHaveLength(1);
  });

  it('returns empty when no symbols are near the wall', () => {
    const out = detectSymbolsOnWall(START, END, THICK, [line('x', 0, 5000, 100, 5000)]);
    expect(out).toHaveLength(0);
  });

  it('returns empty for a degenerate wall', () => {
    expect(detectSymbolsOnWall(START, START, THICK, doorFixture(300, 90))).toHaveLength(0);
  });
});

/** Re-id helper ώστε δύο door fixtures να μην μοιράζονται ids. */
function reId(e: ArcEntity | LineEntity): ArcEntity | LineEntity {
  return { ...e, id: `${e.id}_b` };
}
