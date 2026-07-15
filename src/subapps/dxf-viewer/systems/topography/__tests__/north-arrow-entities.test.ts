/**
 * ADR-656 M12 — north-arrow-entities builder tests.
 */

import { buildNorthArrowEntities } from '../north-arrow-entities';
import {
  TOPO_NORTH_LAYER_NAME, TOPO_NORTH_GLYPH,
  TOPO_NORTH_WORLD_HEIGHT_MM, TOPO_NORTH_GLYPH_HEIGHT_MM,
} from '../north-arrow-config';

const LAYER = 'layer-topo-north';
const anchor = { x: 1000, y: 2000 };

describe('buildNorthArrowEntities', () => {
  it('emits a closed arrowhead polyline + the «Β» glyph, on the passed layer with generated ids', () => {
    const ents = buildNorthArrowEntities(anchor, 90, LAYER);
    expect(ents).toHaveLength(2);

    const poly = ents.find((e) => e.type === 'lwpolyline');
    const text = ents.find((e) => e.type === 'text');
    expect(poly).toBeDefined();
    expect(text).toBeDefined();
    for (const e of ents) {
      expect(e.layerId).toBe(LAYER);
      expect(e.id.length).toBeGreaterThan(0);
    }
  });

  it('closes the arrowhead outline (4 unit vertices)', () => {
    const [poly] = buildNorthArrowEntities(anchor, 90, LAYER);
    if (poly.type !== 'lwpolyline') throw new Error('expected lwpolyline first');
    expect(poly.closed).toBe(true);
    expect(poly.vertices).toHaveLength(4);
  });

  it('points the tip straight up at angle 90° (tip = anchor + ½·height in +Y)', () => {
    const [poly] = buildNorthArrowEntities(anchor, 90, LAYER);
    if (poly.type !== 'lwpolyline') throw new Error('expected lwpolyline first');
    const tip = poly.vertices[0];
    expect(tip.x).toBeCloseTo(anchor.x, 6);
    expect(tip.y).toBeCloseTo(anchor.y + TOPO_NORTH_WORLD_HEIGHT_MM * 0.5, 6);
  });

  it('places the «Β» glyph beyond the tip, upright at angle 90°', () => {
    const ents = buildNorthArrowEntities(anchor, 90, LAYER);
    const text = ents.find((e) => e.type === 'text');
    if (!text || text.type !== 'text') throw new Error('expected text');
    expect(text.text).toBe(TOPO_NORTH_GLYPH);
    expect(text.rotation).toBeCloseTo(0, 6); // 90° − 90°
    expect(text.position.x).toBeCloseTo(anchor.x, 6);
    expect(text.position.y).toBeCloseTo(
      anchor.y + TOPO_NORTH_WORLD_HEIGHT_MM * 0.5 + TOPO_NORTH_GLYPH_HEIGHT_MM, 6,
    );
  });

  it('uses the canonical TOPO-NORTH layer name constant', () => {
    expect(TOPO_NORTH_LAYER_NAME).toBe('TOPO-NORTH');
  });
});
