/**
 * ADR-656 M11 — topo-grid-entities builder tests.
 */

import { buildTopoGridEntities, formatGridCoordinate } from '../topo-grid-entities';
import { buildTopoGrid, type WorldRectMm } from '../topo-grid-model';
import { TOPO_GRID_LAYER_NAME } from '../topo-grid-config';

const rect: WorldRectMm = { minX: 130_000, minY: 40_000, maxX: 370_000, maxY: 170_000 };
const STEP = 50_000; // → 5 eastings × 3 northings = 15 crosses, 8 perimeter labels
const LAYER = 'layer-topo-grid';

describe('buildTopoGridEntities', () => {
  const grid = buildTopoGrid(rect, STEP);
  const entities = buildTopoGridEntities(grid, LAYER);

  it('emits two line segments per cross plus one text per perimeter label', () => {
    const lines = entities.filter((e) => e.type === 'line');
    const texts = entities.filter((e) => e.type === 'text');
    expect(lines).toHaveLength(grid.crosses.length * 2);
    expect(texts).toHaveLength(grid.perimeterLabels.length);
  });

  it('assigns every entity to the passed grid layer with a generated id', () => {
    for (const e of entities) {
      expect(e.layerId).toBe(LAYER);
      expect(typeof e.id).toBe('string');
      expect(e.id.length).toBeGreaterThan(0);
    }
  });

  it('labels round coordinates in whole metres (mm → m)', () => {
    expect(formatGridCoordinate(200_000)).toBe('200');
    const texts = entities.filter((e): e is Extract<typeof e, { type: 'text' }> => e.type === 'text');
    expect(texts.map((t) => t.text)).toContain('200');
  });

  it('returns no entities for an empty grid (no round lines in the rectangle)', () => {
    const empty = buildTopoGrid({ minX: 10, minY: 10, maxX: 5, maxY: 5 }, STEP);
    expect(buildTopoGridEntities(empty, LAYER)).toEqual([]);
  });

  it('uses the canonical grid layer name constant for minting (parity check)', () => {
    expect(TOPO_GRID_LAYER_NAME).toBe('TOPO-GRID');
  });
});
