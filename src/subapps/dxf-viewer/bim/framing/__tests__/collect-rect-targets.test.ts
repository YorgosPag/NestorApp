/**
 * ADR-398 §3.15/§3.17 — collectRectTargets: ορθογώνια ως RectFrame από `rectangle` entity ΚΑΙ από
 * κλειστή 4-κορυφη `polyline`/`lwpolyline` (νέο, κρατά λοξή στροφή). Μη-κλειστά / ≠4 κορυφές → skip.
 */

import { collectRectTargets } from '../member-snap-targets';
import type { Entity } from '../../../types/entities';

function closedQuad(id: string, verts: { x: number; y: number }[], type: 'polyline' | 'lwpolyline' = 'polyline'): Entity {
  return { id, type, closed: true, vertices: verts } as unknown as Entity;
}

describe('collectRectTargets — κλειστή 4-κορυφη πολυγραμμή', () => {
  it('κλειστή polyline 4 κορυφών → ΕΝΑ RectFrame (σωστές ημι-εκτάσεις)', () => {
    const pl = closedQuad('p1', [
      { x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 600 }, { x: 0, y: 600 },
    ]);
    const frames = collectRectTargets([pl]);
    expect(frames).toHaveLength(1);
    expect(frames[0].halfW * 2).toBeCloseTo(250);
    expect(frames[0].halfV * 2).toBeCloseTo(600);
    expect(frames[0].center).toEqual({ x: 125, y: 300 });
  });

  it('λοξή κλειστή polyline → frame με στραμμένο άξονα u (κρατά τη γωνία)', () => {
    // Τετράγωνο στραμμένο 45°: (0,0)→(1,1)→(0,2)→(-1,1).
    const pl = closedQuad('p2', [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: -1, y: 1 },
    ]);
    const frames = collectRectTargets([pl]);
    expect(frames).toHaveLength(1);
    // u = (1,1)/√2 → όχι axis-aligned.
    expect(Math.abs(frames[0].u.x)).toBeCloseTo(Math.SQRT1_2);
    expect(Math.abs(frames[0].u.y)).toBeCloseTo(Math.SQRT1_2);
  });

  it('μη-κλειστή polyline → skip', () => {
    const pl = { id: 'p3', type: 'polyline', closed: false, vertices: [
      { x: 0, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 600 }, { x: 0, y: 600 },
    ] } as unknown as Entity;
    expect(collectRectTargets([pl])).toHaveLength(0);
  });

  it('κλειστή polyline ≠ 4 κορυφές (L-shape) → skip', () => {
    const pl = closedQuad('p4', [
      { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 300 }, { x: 0, y: 300 },
    ]);
    expect(collectRectTargets([pl])).toHaveLength(0);
  });

  it('lwpolyline κλειστή 4 κορυφών → υποστηρίζεται κι αυτή', () => {
    const pl = closedQuad('p5', [
      { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
    ], 'lwpolyline');
    expect(collectRectTargets([pl])).toHaveLength(1);
  });
});
