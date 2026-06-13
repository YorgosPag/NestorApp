/**
 * Unit tests for select-similar-by-color (AutoCAD "Select Similar" — color).
 *
 * Verifies matching on the RESOLVED color across entity kinds, ByLayer
 * inheritance, explicit-color precedence, hidden-entity exclusion, and the
 * empty / missing-reference guards.
 */

import {
  resolveEntityColorHex,
  findEntitiesWithSimilarColor,
} from '../select-similar-by-color';
import type { Entity, SceneLayer } from '../../../types/entities';

// Minimal SceneLayer factory — only the fields the color cascade reads matter.
const layer = (id: string, color?: string): SceneLayer =>
  ({ id, name: id, color, visible: true } as unknown as SceneLayer);

// Entity factory — `color` present → Concrete; absent → ByLayer.
const ent = (
  id: string,
  type: string,
  layerId: string,
  opts: { color?: string; visible?: boolean } = {},
): Entity =>
  ({ id, type, layerId, color: opts.color, visible: opts.visible } as unknown as Entity);

const ORANGE = '#FF8000';
const BLUE = '#0000FF';

describe('resolveEntityColorHex', () => {
  it('returns the explicit (Concrete) color, lowercased', () => {
    const layersById = { L1: layer('L1', BLUE) };
    expect(resolveEntityColorHex(ent('a', 'line', 'L1', { color: ORANGE }), layersById))
      .toBe(ORANGE.toLowerCase());
  });

  it('falls back to the layer color for ByLayer entities', () => {
    const layersById = { L1: layer('L1', ORANGE) };
    expect(resolveEntityColorHex(ent('a', 'circle', 'L1'), layersById))
      .toBe(ORANGE.toLowerCase());
  });
});

describe('findEntitiesWithSimilarColor', () => {
  it('selects all entities sharing the reference color, across kinds', () => {
    const layersById = { L1: layer('L1', BLUE) };
    const entities = [
      ent('line1', 'line', 'L1', { color: ORANGE }),
      ent('circle1', 'circle', 'L1', { color: ORANGE }),
      ent('rect1', 'rectangle', 'L1', { color: ORANGE }),
      ent('blue1', 'line', 'L1', { color: BLUE }),
    ];
    expect(findEntitiesWithSimilarColor('line1', entities, layersById).sort())
      .toEqual(['circle1', 'line1', 'rect1']);
  });

  it('groups ByLayer entities by their inherited layer color', () => {
    const layersById = { ORG: layer('ORG', ORANGE), BLU: layer('BLU', BLUE) };
    const entities = [
      ent('a', 'line', 'ORG'),
      ent('b', 'circle', 'ORG'),
      ent('c', 'line', 'BLU'),
    ];
    expect(findEntitiesWithSimilarColor('a', entities, layersById).sort())
      .toEqual(['a', 'b']);
  });

  it('excludes hidden entities even when their color matches', () => {
    const layersById = { L1: layer('L1', BLUE) };
    const entities = [
      ent('a', 'line', 'L1', { color: ORANGE }),
      ent('hidden', 'line', 'L1', { color: ORANGE, visible: false }),
    ];
    expect(findEntitiesWithSimilarColor('a', entities, layersById)).toEqual(['a']);
  });

  it('returns [] when the reference id is not in the scene', () => {
    const layersById = { L1: layer('L1', ORANGE) };
    expect(findEntitiesWithSimilarColor('ghost', [ent('a', 'line', 'L1')], layersById))
      .toEqual([]);
  });

  // ADR-445 — BIM entities group by structural colour identity, not the DXF
  // layer cascade (columns blue, beams amber, …).
  it('groups BIM entities by category colour identity, separate from DXF', () => {
    const layersById = { L1: layer('L1', ORANGE) };
    const bim = (id: string, type: string, extra: Record<string, unknown> = {}) =>
      ({ id, type, ...extra } as unknown as Entity);
    const entities = [
      bim('col1', 'column', { kind: 'rectangular' }),
      bim('col2', 'column', { kind: 'rectangular' }),
      bim('beam1', 'beam'),
      ent('orangeLine', 'line', 'L1'), // ByLayer orange — must NOT join columns
    ];
    expect(findEntitiesWithSimilarColor('col1', entities, layersById).sort())
      .toEqual(['col1', 'col2']);
  });
});
