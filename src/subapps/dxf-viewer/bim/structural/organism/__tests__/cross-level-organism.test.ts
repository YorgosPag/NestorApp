/**
 * ADR-459 Phase 0 — cross-level organism (scene reconciler + absolute-Z graph).
 *
 * Επιβεβαιώνει ότι ένα πέδιλο στον όροφο Θεμελίωσης (χαμηλό FFL) στηρίζει μια
 * κολόνα του ενεργού ορόφου (υψηλό FFL) ΜΟΝΟ όταν τα Z ευθυγραμμιστούν σε
 * απόλυτο frame (cross-level), ενώ single-level (μηδέν offset) δεν παράγεται ακμή.
 */

import { buildStructuralGraph } from '../structural-graph';
import { buildOrganismScene } from '../cross-level-organism-scene';
import type { Entity } from '../../../../types/entities';

function squareFootprint(cx: number, cy: number, half: number) {
  return {
    vertices: [
      { x: cx - half, y: cy - half, z: 0 },
      { x: cx + half, y: cy - half, z: 0 },
      { x: cx + half, y: cy + half, z: 0 },
      { x: cx - half, y: cy + half, z: 0 },
    ],
  };
}

// Πέδιλο: top 1000mm πάνω από το FFL της Θεμελίωσης (pedestal που φτάνει το ισόγειο).
const pad = {
  id: 'F1',
  type: 'foundation',
  params: { kind: 'pad', topElevationMm: 1000, thicknessMm: 500 },
  geometry: { footprint: squareFootprint(0, 0, 1) },
} as unknown as Entity;

const column = {
  id: 'C1',
  type: 'column',
  params: { baseBinding: 'storey-floor', baseOffset: 0, height: 3000, attachTopToIds: [] },
  geometry: { footprint: squareFootprint(0, 0, 0.25) },
} as unknown as Entity;

describe('buildOrganismScene', () => {
  it('merges active + foundation entities and maps per-floor elevations', () => {
    const merged = buildOrganismScene({
      activeEntities: [column],
      activeFloorElevationMm: 0,
      foundationEntities: [pad],
      foundationFloorElevationMm: -1000,
    });
    expect(merged.entities.map((e) => e.id)).toEqual(['C1', 'F1']);
    expect(merged.floorElevationByEntityId.get('C1')).toBe(0);
    expect(merged.floorElevationByEntityId.get('F1')).toBe(-1000);
  });

  it('dedups by id — the active entity wins over a same-id foundation entity', () => {
    const merged = buildOrganismScene({
      activeEntities: [column],
      activeFloorElevationMm: 5,
      foundationEntities: [{ ...(column as object), id: 'C1' } as unknown as Entity],
      foundationFloorElevationMm: -1000,
    });
    expect(merged.entities).toHaveLength(1);
    expect(merged.floorElevationByEntityId.get('C1')).toBe(5);
  });
});

describe('buildStructuralGraph — absolute-Z offset (cross-level)', () => {
  it('offsets node Z by the per-entity floor elevation', () => {
    const map = new Map<string, number>([['F1', -1000], ['C1', 0]]);
    const graph = buildStructuralGraph([pad, column], { floorElevationByEntityId: map });
    const footing = graph.nodes.find((n) => n.id === 'F1');
    const col = graph.nodes.find((n) => n.id === 'C1');
    // footing top = 1000 + (−1000) = 0 ; column base = 0 + 0 = 0.
    expect(footing?.topZmm).toBe(0);
    expect(col?.baseZmm).toBe(0);
  });

  it('derives a footing-bearing edge ONLY with the cross-level offset', () => {
    // Without offset: footing top 1000 > column base 0 → gate fails → no edge.
    const flat = buildStructuralGraph([pad, column]);
    expect(flat.edges.filter((e) => e.kind === 'footing-bearing')).toHaveLength(0);

    // With offset: footing top 0 ≤ column base 0 → edge.
    const merged = buildOrganismScene({
      activeEntities: [column],
      activeFloorElevationMm: 0,
      foundationEntities: [pad],
      foundationFloorElevationMm: -1000,
    });
    const graph = buildStructuralGraph(merged.entities, {
      floorElevationByEntityId: merged.floorElevationByEntityId,
    });
    const bearing = graph.edges.filter((e) => e.kind === 'footing-bearing');
    expect(bearing).toMatchObject([{ supportId: 'F1', supportedId: 'C1' }]);
  });
});
