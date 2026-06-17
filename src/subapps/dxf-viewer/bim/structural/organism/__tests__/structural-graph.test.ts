/**
 * ADR-459 Phase 0 — structural graph builder (foundation ↔ column integration).
 *
 * Minimal entity fixtures (cast μέσω `as unknown as Entity`, ίδιο pattern με τον
 * production `useStructuralAutoAttach`) — εξετάζει node classification + footing-
 * bearing edge derivation + end-to-end «λείπει το πέδιλο».
 */

import { buildStructuralGraph, runOrganismChecks } from '../organism-checks';
import type { Entity } from '../../../../types/entities';

function squareFootprint(cx: number, cy: number, half: number): { vertices: { x: number; y: number; z: number }[] } {
  return {
    vertices: [
      { x: cx - half, y: cy - half, z: 0 },
      { x: cx + half, y: cy - half, z: 0 },
      { x: cx + half, y: cy + half, z: 0 },
      { x: cx - half, y: cy + half, z: 0 },
    ],
  };
}

const pad = {
  id: 'F1',
  type: 'foundation',
  params: { kind: 'pad', topElevationMm: -1000, thicknessMm: 500 },
  geometry: { footprint: squareFootprint(0, 0, 1) },
} as unknown as Entity;

const columnAt = (id: string, cx: number): Entity =>
  ({
    id,
    type: 'column',
    params: { baseBinding: 'storey-floor', baseOffset: 0, height: 3000, attachTopToIds: [] },
    geometry: { footprint: squareFootprint(cx, 0, 0.25) },
  } as unknown as Entity);

describe('buildStructuralGraph', () => {
  it('classifies footing + column nodes and derives a footing-bearing edge', () => {
    const graph = buildStructuralGraph([pad, columnAt('C1', 0), columnAt('C2', 5)]);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.find((n) => n.id === 'F1')?.memberKind).toBe('footing');
    expect(graph.nodes.find((n) => n.id === 'C1')?.memberKind).toBe('column');

    const bearing = graph.edges.filter((e) => e.kind === 'footing-bearing');
    expect(bearing).toHaveLength(1);
    expect(bearing[0]).toMatchObject({ supportId: 'F1', supportedId: 'C1' });
  });

  it('end-to-end: the column off the pad reports «λείπει το πέδιλο»', () => {
    const graph = buildStructuralGraph([pad, columnAt('C1', 0), columnAt('C2', 5)]);
    const missing = runOrganismChecks(graph).filter((d) => d.code === 'columnMissingFooting');
    expect(missing.map((d) => d.primaryEntityId)).toEqual(['C2']);
  });
});

const columnWithFooting = (id: string, cx: number, footingId: string): Entity =>
  ({
    id,
    type: 'column',
    params: { baseBinding: 'storey-floor', baseOffset: 0, height: 3000, attachTopToIds: [], footingId },
    geometry: { footprint: squareFootprint(cx, 0, 0.25) },
  } as unknown as Entity);

describe('buildStructuralGraph — explicit-FK-wins (ADR-459 Phase 2)', () => {
  it('uses the explicit footingId edge even when the column is off the footprint', () => {
    // C1 κάθεται στο cx=5 (ΕΚΤΟΣ pad), αλλά footingId='F1' → authoritative ακμή.
    const graph = buildStructuralGraph([pad, columnWithFooting('C1', 5, 'F1')]);
    const bearing = graph.edges.filter((e) => e.kind === 'footing-bearing');
    expect(bearing).toMatchObject([{ supportId: 'F1', supportedId: 'C1' }]);
    expect(runOrganismChecks(graph).filter((d) => d.code === 'columnMissingFooting')).toHaveLength(0);
  });

  it('a stale footingId (no matching node) yields no edge → «λείπει το πέδιλο»', () => {
    // C1 κάθεται ΠΑΝΩ στο pad (cx=0), αλλά footingId δείχνει σε ανύπαρκτο node →
    // explicit FK authoritative → καμία ακμή → error (spatial fallback ΔΕΝ τρέχει).
    const graph = buildStructuralGraph([pad, columnWithFooting('C1', 0, 'ghost')]);
    expect(graph.edges.filter((e) => e.kind === 'footing-bearing')).toHaveLength(0);
    const missing = runOrganismChecks(graph).filter((d) => d.code === 'columnMissingFooting');
    expect(missing.map((d) => d.primaryEntityId)).toEqual(['C1']);
  });
});
