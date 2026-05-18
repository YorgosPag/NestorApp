/**
 * ADR-362 Phase O2 — DimAssociationGraph unit tests.
 *
 * Covers: rebuild (empty, no-assoc, single, multi), getDimIds (found/missing),
 * has(), size, stale-state clear on second rebuild.
 */

import type { DimensionAssociation, DimensionEntity } from '../../../types/dimension';
import { DimAssociationGraph } from '../dim-association-graph';
import { ISO_129_TEMPLATE } from '../dim-style-templates';

function makeAssoc(
  geometryId: string,
  defPointIndex = 0,
): DimensionAssociation {
  return { geometryId, defPointIndex, associationType: 'endpoint' };
}

function makeDim(id: string, assocs: DimensionAssociation[] = []): DimensionEntity {
  return {
    id,
    type: 'dimension',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    layerId: '0',
    defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }],
    associations: assocs,
  } as DimensionEntity;
}

describe('DimAssociationGraph', () => {
  let graph: DimAssociationGraph;

  beforeEach(() => {
    graph = new DimAssociationGraph();
  });

  it('starts empty — size=0, has() false, getDimIds returns []', () => {
    expect(graph.size).toBe(0);
    expect(graph.has('any')).toBe(false);
    expect(graph.getDimIds('any')).toEqual([]);
  });

  it('rebuild with empty array → size=0', () => {
    graph.rebuild([]);
    expect(graph.size).toBe(0);
  });

  it('rebuild with dims that have no associations → size=0', () => {
    graph.rebuild([makeDim('d1'), makeDim('d2')]);
    expect(graph.size).toBe(0);
  });

  it('rebuild single dim + single assoc → size=1, getDimIds returns [dimId]', () => {
    graph.rebuild([makeDim('d1', [makeAssoc('geo1')])]);
    expect(graph.size).toBe(1);
    expect(graph.getDimIds('geo1')).toEqual(['d1']);
  });

  it('getDimIds for missing geometry → empty array (never throws)', () => {
    graph.rebuild([makeDim('d1', [makeAssoc('geo1')])]);
    expect(graph.getDimIds('nonexistent')).toEqual([]);
  });

  it('two dims referencing the same geometry → getDimIds contains both', () => {
    const d1 = makeDim('d1', [makeAssoc('geo1')]);
    const d2 = makeDim('d2', [makeAssoc('geo1')]);
    graph.rebuild([d1, d2]);
    const ids = graph.getDimIds('geo1');
    expect(ids).toHaveLength(2);
    expect(ids).toContain('d1');
    expect(ids).toContain('d2');
  });

  it('has() returns true for known geometry, false for unknown', () => {
    graph.rebuild([makeDim('d1', [makeAssoc('geoA')])]);
    expect(graph.has('geoA')).toBe(true);
    expect(graph.has('geoB')).toBe(false);
  });

  it('size counts distinct geometry IDs — not dim count', () => {
    // d1 references geo1+geo2, d2 references geo2 → 2 distinct geos
    const d1 = makeDim('d1', [makeAssoc('geo1'), makeAssoc('geo2', 1)]);
    const d2 = makeDim('d2', [makeAssoc('geo2')]);
    graph.rebuild([d1, d2]);
    expect(graph.size).toBe(2);
  });

  it('rebuild clears previous state — stale entries removed', () => {
    graph.rebuild([makeDim('d1', [makeAssoc('geo1')])]);
    expect(graph.has('geo1')).toBe(true);

    graph.rebuild([makeDim('d2', [makeAssoc('geo2')])]);
    expect(graph.has('geo1')).toBe(false);
    expect(graph.has('geo2')).toBe(true);
  });

  it('dim with undefined associations treated as no associations', () => {
    const dim: DimensionEntity = {
      ...makeDim('d1'),
      associations: undefined,
    };
    graph.rebuild([dim]);
    expect(graph.size).toBe(0);
  });
});
