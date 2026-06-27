/**
 * ADR-543 — coincident-endpoint co-move (articulated joint).
 *
 * Pure unit tests for the SSoT that, given a dragged single-line-endpoint grip and the
 * multi-select set, returns the extra StretchVertexMove[] for the OTHER selected lines whose
 * endpoint is coincident with the dragged one (so they co-move in one StretchEntityCommand).
 */

import {
  isSingleLineEndpointDrag,
  collectCoincidentLinePartnerMoves,
  buildCoincidentPartnerGhostEntities,
} from '../coincident-endpoint-comove';
import type { Entity } from '../../../types/entities';
import type { VertexRef } from '../stretch-vertex-classifier';

const line = (id: string, start: [number, number], end: [number, number]): Entity =>
  ({ id, type: 'line', start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] } }) as unknown as Entity;

const circle = (id: string, c: [number, number], r: number): Entity =>
  ({ id, type: 'circle', center: { x: c[0], y: c[1] }, radius: r }) as unknown as Entity;

const ref = (entityId: string, kind: VertexRef['kind']): VertexRef => ({ entityId, kind });

/** Build a getEntity accessor over a fixed entity list. */
const accessor = (...entities: Entity[]) => (id: string): Entity | undefined =>
  entities.find((e) => e.id === id);

describe('isSingleLineEndpointDrag', () => {
  it('true for a single line-start / line-end ref', () => {
    const l = line('a', [0, 0], [10, 0]);
    expect(isSingleLineEndpointDrag(l, [ref('a', 'line-start')])).toBe(true);
    expect(isSingleLineEndpointDrag(l, [ref('a', 'line-end')])).toBe(true);
  });
  it('false for the midpoint grip (both refs = whole move)', () => {
    const l = line('a', [0, 0], [10, 0]);
    expect(isSingleLineEndpointDrag(l, [ref('a', 'line-start'), ref('a', 'line-end')])).toBe(false);
  });
  it('false for a non-line entity', () => {
    expect(isSingleLineEndpointDrag(circle('c', [0, 0], 5), [ref('c', 'line-start')])).toBe(false);
  });
});

describe('collectCoincidentLinePartnerMoves', () => {
  it('A.end == B.start: dragging A.end returns one partner move for B.start', () => {
    const a = line('a', [0, 0], [10, 10]);
    const b = line('b', [10, 10], [20, 0]);
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a,
      draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b'],
      getEntity: accessor(a, b),
    });
    expect(moves).toEqual([{ entityId: 'b', refs: [ref('b', 'line-start')] }]);
  });

  it('non-coincident endpoints return []', () => {
    const a = line('a', [0, 0], [10, 10]);
    const b = line('b', [50, 50], [60, 40]);
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a,
      draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b'],
      getEntity: accessor(a, b),
    });
    expect(moves).toEqual([]);
  });

  it('tolerance boundary: 0.0009 matches, 0.0011 does not (POINT_MATCH 0.001)', () => {
    const a = line('a', [0, 0], [10, 0]);
    const near = line('b', [10 + 0.0009, 0], [20, 0]);
    const far = line('c', [10 + 0.0011, 0], [20, 0]);
    const matched = collectCoincidentLinePartnerMoves({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b'], getEntity: accessor(a, near),
    });
    const unmatched = collectCoincidentLinePartnerMoves({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'c'], getEntity: accessor(a, far),
    });
    expect(matched).toHaveLength(1);
    expect(unmatched).toHaveLength(0);
  });

  it('midpoint grip (both refs) → no co-move', () => {
    const a = line('a', [0, 0], [10, 10]);
    const b = line('b', [10, 10], [20, 0]);
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a,
      draggedRefs: [ref('a', 'line-start'), ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b'],
      getEntity: accessor(a, b),
    });
    expect(moves).toEqual([]);
  });

  it('single line selected → []', () => {
    const a = line('a', [0, 0], [10, 10]);
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a'], getEntity: accessor(a),
    });
    expect(moves).toEqual([]);
  });

  it('three lines meeting at a point → two partner moves', () => {
    const a = line('a', [0, 0], [10, 10]);
    const b = line('b', [10, 10], [20, 0]);
    const c = line('c', [10, 10], [0, 20]);
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b', 'c'], getEntity: accessor(a, b, c),
    });
    expect(moves).toHaveLength(2);
    expect(moves.map((m) => m.entityId).sort()).toEqual(['b', 'c']);
  });

  it('partner that is a circle is ignored', () => {
    const a = line('a', [0, 0], [10, 10]);
    const c = circle('c', [10, 10], 5);
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'c'], getEntity: accessor(a, c),
    });
    expect(moves).toEqual([]);
  });

  it('dragged line excluded from itself (zero-length dragged line)', () => {
    const a = line('a', [10, 10], [10, 10]); // degenerate: both ends at the anchor
    const b = line('b', [10, 10], [20, 0]);
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b'], getEntity: accessor(a, b),
    });
    // Only b is returned — a is never a partner of itself.
    expect(moves).toEqual([{ entityId: 'b', refs: [ref('b', 'line-start')] }]);
  });

  it('partner with BOTH endpoints coincident → two refs (follows rigidly)', () => {
    const a = line('a', [0, 0], [10, 10]);
    const b = line('b', [10, 10], [10, 10]); // both ends at the joint
    const moves = collectCoincidentLinePartnerMoves({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b'], getEntity: accessor(a, b),
    });
    expect(moves).toEqual([{ entityId: 'b', refs: [ref('b', 'line-start'), ref('b', 'line-end')] }]);
  });
});

describe('buildCoincidentPartnerGhostEntities', () => {
  it('clones the partner with only its coincident endpoint translated by delta', () => {
    const a = line('a', [0, 0], [10, 10]);
    const b = line('b', [10, 10], [20, 0]);
    const ghosts = buildCoincidentPartnerGhostEntities({
      draggedEntity: a, draggedRefs: [ref('a', 'line-end')],
      selectedEntityIds: ['a', 'b'], getEntity: accessor(a, b),
      delta: { x: 5, y: -3 },
    });
    expect(ghosts).toHaveLength(1);
    const g = ghosts[0] as Entity & { type: 'line' };
    // b.start (the coincident end) moved by delta; b.end untouched.
    expect(g.start).toEqual({ x: 15, y: 7 });
    expect(g.end).toEqual({ x: 20, y: 0 });
  });
});
