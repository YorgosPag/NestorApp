/**
 * ADR-459 Phase 1 — organism cross-entity checks (pure, graph-literal driven).
 */

import { runOrganismChecks } from '../organism-checks';
import type {
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
} from '../structural-organism-types';

function column(id: string): StructuralNode {
  return {
    id,
    memberKind: 'column',
    entityType: 'column',
    footprint: [
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: 0.5 },
    ],
    baseZmm: 0,
    topZmm: 3000,
  };
}

/** Column με footprint κεντραρισμένο στο (cx, 0) — για beam endpoint coverage. */
function columnAt(id: string, cx: number): StructuralNode {
  return {
    ...column(id),
    footprint: [
      { x: cx - 0.5, y: -0.5 },
      { x: cx + 0.5, y: -0.5 },
      { x: cx + 0.5, y: 0.5 },
      { x: cx - 0.5, y: 0.5 },
    ],
  };
}

function footing(id: string): StructuralNode {
  return {
    id,
    memberKind: 'footing',
    entityType: 'foundation',
    footprint: [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ],
    baseZmm: -1500,
    topZmm: -1000,
  };
}

function beam(id: string, supportType: StructuralNode['supportType'] = 'simple'): StructuralNode {
  return {
    id,
    memberKind: 'beam',
    entityType: 'beam',
    axis: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, halfWidth: 0.5 },
    supportType,
    baseZmm: 2700,
    topZmm: 3000,
  };
}

const edge = (supportId: string, supportedId: string, kind: StructuralEdge['kind']): StructuralEdge => ({
  id: `${supportId}->${supportedId}:${kind}`,
  supportId,
  supportedId,
  kind,
});

const graph = (nodes: StructuralNode[], edges: StructuralEdge[] = []): StructuralGraph => ({ nodes, edges });

describe('columnMissingFooting', () => {
  it('flags a column with no footing-bearing edge', () => {
    const diags = runOrganismChecks(graph([column('C1')]));
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: 'columnMissingFooting', severity: 'error', primaryEntityId: 'C1' });
  });

  it('does not flag a column supported by a footing', () => {
    const g = graph([column('C1'), footing('F1')], [edge('F1', 'C1', 'footing-bearing')]);
    expect(runOrganismChecks(g).some((d) => d.code === 'columnMissingFooting')).toBe(false);
  });

  it('top-attachment alone does NOT satisfy footing requirement', () => {
    const g = graph([column('C1'), beam('B1')], [edge('B1', 'C1', 'top-attachment')]);
    expect(runOrganismChecks(g).some((d) => d.code === 'columnMissingFooting')).toBe(true);
  });
});

describe('beamUnsupportedEnd', () => {
  const framed = (beamNode: StructuralNode, cols: StructuralNode[]): StructuralGraph =>
    graph([beamNode, ...cols], cols.map((c) => edge(c.id, beamNode.id, 'column-bearing')));

  it('no warning when both ends sit on columns', () => {
    const g = framed(beam('B1'), [columnAt('C1', 0), columnAt('C2', 10)]);
    expect(runOrganismChecks(g).some((d) => d.code === 'beamUnsupportedEnd')).toBe(false);
  });

  // ADR-486 §C — 1 στήριξη = έγκυρος πρόβολος (auto-διαστασιολογείται σιωπηλά) →
  // ΚΑΜΙΑ ειδοποίηση. Ο αρχιτέκτονας δεν παρεμβαίνει· ο «στατικός» (εφαρμογή) διορθώνει.
  it('one supported end = valid cantilever → no warning (ADR-486 §C)', () => {
    const g = framed(beam('B1'), [columnAt('C1', 0)]);
    expect(runOrganismChecks(g).some((d) => d.code === 'beamUnsupportedEnd')).toBe(false);
  });

  it('cantilever type with one supported end is OK', () => {
    const g = framed(beam('B1', 'cantilever'), [columnAt('C1', 0)]);
    expect(runOrganismChecks(g).some((d) => d.code === 'beamUnsupportedEnd')).toBe(false);
  });

  it('warns ONLY when no end is supported (floating beam)', () => {
    const g = framed(beam('B1'), []);
    const d = runOrganismChecks(g).find((x) => x.code === 'beamUnsupportedEnd');
    expect(d).toMatchObject({ severity: 'warning', primaryEntityId: 'B1' });
  });
});

describe('memberIsolated', () => {
  it('flags a footing with no edges', () => {
    const d = runOrganismChecks(graph([footing('F1')])).find((x) => x.code === 'memberIsolated');
    expect(d).toMatchObject({ severity: 'warning', primaryEntityId: 'F1' });
  });

  it('does not flag a footing that supports a column', () => {
    const g = graph([footing('F1'), column('C1')], [edge('F1', 'C1', 'footing-bearing')]);
    expect(runOrganismChecks(g).some((d) => d.code === 'memberIsolated')).toBe(false);
  });
});
