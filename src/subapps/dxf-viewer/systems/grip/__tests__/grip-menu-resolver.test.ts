/**
 * GRIP MENU RESOLVER — unit tests (ADR-349 / ADR-397)
 *
 * Locks the Revit-grade rule (Giorgio 2026-06-17): the hover menu lists ONLY
 * genuine multifunctional actions. «Stretch» is implicit in the drag and must
 * NEVER appear — so column/BIM anchors, circle/text, line midpoints, arc
 * centers and whole-entity MOVE glyphs resolve to an empty list (no menu pops).
 */

import { resolveMenuActions } from '../grip-menu-resolver';
import type { GripMenuActionId } from '../grip-menu-resolver';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type {
  Entity,
  LineEntity,
  ArcEntity,
  PolylineEntity,
  CircleEntity,
} from '../../../types/entities';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function grip(over: Partial<UnifiedGripInfo> & Pick<UnifiedGripInfo, 'type' | 'gripIndex'>): UnifiedGripInfo {
  return {
    id: `dxf_e1_${over.gripIndex}`,
    source: 'dxf',
    entityId: 'e1',
    position: { x: 0, y: 0 },
    movesEntity: false,
    ...over,
  };
}

const line: LineEntity = {
  id: 'e1', type: 'line', layerId: 'lyr_x',
  start: { x: 0, y: 0 }, end: { x: 10, y: 0 },
};

const arc: ArcEntity = {
  id: 'e1', type: 'arc', layerId: 'lyr_x',
  center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: 90,
};

const polyOpen: PolylineEntity = {
  id: 'e1', type: 'polyline', layerId: 'lyr_x',
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
};

const polyClosed: PolylineEntity = {
  id: 'e1', type: 'polyline', layerId: 'lyr_x',
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
};

const circle: CircleEntity = {
  id: 'e1', type: 'circle', layerId: 'lyr_x',
  center: { x: 0, y: 0 }, radius: 5,
};

// A BIM column only needs its `type` for the resolver's switch — minimal cast.
const bimColumn = { id: 'e1', type: 'column', layerId: 'lyr_x' } as unknown as Entity;

const ids = (entity: Entity, g: UnifiedGripInfo): GripMenuActionId[] =>
  resolveMenuActions(entity, g).map((m) => m.id);

// ── «Stretch» must never surface (the cardinal rule) ─────────────────────────

describe('resolveMenuActions — no implicit Stretch entry', () => {
  const cases: ReadonlyArray<readonly [string, Entity, UnifiedGripInfo]> = [
    ['line endpoint', line, grip({ type: 'vertex', gripIndex: 0 })],
    ['line midpoint', line, grip({ type: 'edge', gripIndex: 2 })],
    ['arc endpoint', arc, grip({ type: 'vertex', gripIndex: 1 })],
    ['arc midpoint', arc, grip({ type: 'edge', gripIndex: 3 })],
    ['polyline vertex', polyClosed, grip({ type: 'vertex', gripIndex: 0 })],
    ['circle anchor', circle, grip({ type: 'center', gripIndex: 0 })],
    ['column anchor', bimColumn, grip({ type: 'vertex', gripIndex: 2 })],
  ];

  it.each(cases)('%s never includes "stretch"', (_label, entity, g) => {
    // Widen to string[] — 'stretch' is no longer part of GripMenuActionId by design.
    expect(ids(entity, g) as string[]).not.toContain('stretch');
  });
});

// ── Column / BIM anchors → no menu at all ────────────────────────────────────

describe('resolveMenuActions — column / BIM / anchors yield no menu', () => {
  it('column resize grip → []', () => {
    expect(resolveMenuActions(bimColumn, grip({ type: 'vertex', gripIndex: 3 }))).toEqual([]);
  });

  it('whole-entity MOVE glyph (movesEntity) → []', () => {
    expect(
      resolveMenuActions(bimColumn, grip({ type: 'center', gripIndex: 0, movesEntity: true })),
    ).toEqual([]);
  });

  it('move glyph on a line still suppresses the menu', () => {
    expect(
      resolveMenuActions(line, grip({ type: 'vertex', gripIndex: 0, movesEntity: true })),
    ).toEqual([]);
  });

  it('circle / text anchor → []', () => {
    expect(resolveMenuActions(circle, grip({ type: 'center', gripIndex: 0 }))).toEqual([]);
  });
});

// ── Genuine multifunctional actions survive ──────────────────────────────────

describe('resolveMenuActions — multifunctional entries', () => {
  it('line endpoint → [lengthen]', () => {
    expect(ids(line, grip({ type: 'vertex', gripIndex: 1 }))).toEqual(['lengthen']);
  });

  it('line midpoint → []', () => {
    expect(ids(line, grip({ type: 'edge', gripIndex: 2 }))).toEqual([]);
  });

  it('arc endpoint → [lengthen]', () => {
    expect(ids(arc, grip({ type: 'vertex', gripIndex: 2 }))).toEqual(['lengthen']);
  });

  it('arc midpoint → [radius]', () => {
    expect(ids(arc, grip({ type: 'edge', gripIndex: 3 }))).toEqual(['radius']);
  });

  it('polyline vertex (2 verts) → [addVertex, convertToArc] (cannot remove below 2)', () => {
    expect(ids(polyOpen, grip({ type: 'vertex', gripIndex: 0 }))).toEqual([
      'addVertex',
      'convertToArc',
    ]);
  });

  it('polyline vertex (3 verts) → [addVertex, removeVertex, convertToArc]', () => {
    expect(ids(polyClosed, grip({ type: 'vertex', gripIndex: 1 }))).toEqual([
      'addVertex',
      'removeVertex',
      'convertToArc',
    ]);
  });

  // ADR-510 Φ3c — segment/arc midpoint grips (tagged via polylineGripKind).
  it('polyline straight segment-midpoint → [addVertex, convertToArc]', () => {
    expect(
      ids(polyClosed, grip({ type: 'edge', gripIndex: 3, polylineGripKind: 'polyline-segment-midpoint-0' })),
    ).toEqual(['addVertex', 'convertToArc']);
  });

  it('polyline arc-midpoint → [convertToLine]', () => {
    expect(
      ids(polyClosed, grip({ type: 'edge', gripIndex: 3, polylineGripKind: 'polyline-arc-midpoint-0' })),
    ).toEqual(['convertToLine']);
  });

  it('polyline vertex tagged kind (3 verts) → [addVertex, removeVertex, convertToArc]', () => {
    expect(
      ids(polyClosed, grip({ type: 'vertex', gripIndex: 1, polylineGripKind: 'polyline-vertex-1' })),
    ).toEqual(['addVertex', 'removeVertex', 'convertToArc']);
  });
});
