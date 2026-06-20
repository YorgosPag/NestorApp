/**
 * ADR-505 §A — `bim-to-dxf-primitives` SSoT (composite decomposition).
 *
 * Επαληθεύει: wall → ένα κλειστό lwpolyline (outer + reversed inner)·
 * column/slab/beam → footprint lwpolyline· native DXF = passthrough·
 * άγνωστος BIM τύπος → skip + warning· κληρονομιά layer/color· 3D→2D drop z.
 */

import {
  flattenSceneEntitiesForDxf,
  decomposeBimEntityToDxfPrimitives,
} from '../bim-to-dxf-primitives';
import type { Entity } from '../../../types/entities';

function native(type: string, id: string): Entity {
  return { id, type, layerId: 'lyr_n', color: '#111111' } as unknown as Entity;
}

function wall(id: string): Entity {
  return {
    id, type: 'wall', layerId: 'lyr_w', color: '#ff0000', visible: true,
    geometry: {
      outerEdge: { points: [{ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }] },
      innerEdge: { points: [{ x: 0, y: -1, z: 0 }, { x: 10, y: -1, z: 0 }] },
    },
  } as unknown as Entity;
}

function column(id: string): Entity {
  return {
    id, type: 'column', layerId: 'lyr_c', color: '#00ff00',
    geometry: { footprint: { vertices: [
      { x: 0, y: 0, z: 5 }, { x: 4, y: 0, z: 5 }, { x: 4, y: 4, z: 5 }, { x: 0, y: 4, z: 5 },
    ] } },
  } as unknown as Entity;
}

function slab(id: string): Entity {
  return {
    id, type: 'slab', layerId: 'lyr_s',
    geometry: { polygon: { vertices: [
      { x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 },
    ] } },
  } as unknown as Entity;
}

function beam(id: string): Entity {
  return {
    id, type: 'beam', layerId: 'lyr_b',
    geometry: { outline: { vertices: [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 0, y: 2 },
    ] } },
  } as unknown as Entity;
}

describe('decomposeBimEntityToDxfPrimitives', () => {
  it('wall → ένα κλειστό lwpolyline = outer + reversed inner', () => {
    const out = decomposeBimEntityToDxfPrimitives(wall('w1'));
    expect(out).toHaveLength(1);
    const p = out[0];
    expect(p.type).toBe('lwpolyline');
    if (p.type !== 'lwpolyline') throw new Error('type');
    expect(p.closed).toBe(true);
    // outer [(0,1),(10,1)] + reversed inner [(10,-1),(0,-1)]
    expect(p.vertices).toEqual([
      { x: 0, y: 1 }, { x: 10, y: 1 }, { x: 10, y: -1 }, { x: 0, y: -1 },
    ]);
    expect(p.layerId).toBe('lyr_w');
    expect(p.color).toBe('#ff0000');
  });

  it('column → footprint lwpolyline, z αφαιρείται (3D→2D)', () => {
    const out = decomposeBimEntityToDxfPrimitives(column('c1'));
    expect(out).toHaveLength(1);
    const p = out[0];
    if (p.type !== 'lwpolyline') throw new Error('type');
    expect(p.vertices).toEqual([
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
    ]);
  });

  it('slab → polygon lwpolyline', () => {
    const out = decomposeBimEntityToDxfPrimitives(slab('s1'));
    expect(out[0].type).toBe('lwpolyline');
  });

  it('beam → outline lwpolyline', () => {
    const out = decomposeBimEntityToDxfPrimitives(beam('b1'));
    expect(out[0].type).toBe('lwpolyline');
  });

  it('BIM χωρίς geometry → []', () => {
    const fixture = { id: 'm1', type: 'mep-fixture', layerId: 'lyr_m' } as unknown as Entity;
    expect(decomposeBimEntityToDxfPrimitives(fixture)).toEqual([]);
  });

  it('Η/Μ fixture με footprint → lwpolyline (generic extractor)', () => {
    const fixture = {
      id: 'm1', type: 'mep-fixture', layerId: 'lyr_m',
      geometry: { footprint: { vertices: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }] } },
    } as unknown as Entity;
    const out = decomposeBimEntityToDxfPrimitives(fixture);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('lwpolyline');
  });

  it('3Δ extrusion: geometry.height (mm) → dxfThicknessMm στο primitive', () => {
    const col = {
      id: 'c', type: 'column', layerId: 'lyr_c',
      geometry: { footprint: { vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }] }, height: 3000 },
    } as unknown as Entity;
    const out = decomposeBimEntityToDxfPrimitives(col) as Array<{ dxfThicknessMm?: number }>;
    expect(out[0].dxfThicknessMm).toBe(3000);
  });

  it('3Δ extrusion: params.thickness (πλάκα) → dxfThicknessMm', () => {
    const slab = {
      id: 's', type: 'slab', layerId: 'lyr_s', params: { thickness: 200 },
      geometry: { polygon: { vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] } },
    } as unknown as Entity;
    const out = decomposeBimEntityToDxfPrimitives(slab) as Array<{ dxfThicknessMm?: number }>;
    expect(out[0].dxfThicknessMm).toBe(200);
  });

  it('χωρίς height/params → χωρίς extrusion (flat 2Δ)', () => {
    const flat = {
      id: 'f', type: 'mep-fixture', layerId: 'lyr_m',
      geometry: { footprint: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] } },
    } as unknown as Entity;
    const out = decomposeBimEntityToDxfPrimitives(flat) as Array<{ dxfThicknessMm?: number }>;
    expect(out[0].dxfThicknessMm).toBeUndefined();
  });

  it('opening με outline → lwpolyline', () => {
    const opening = {
      id: 'o1', type: 'opening', layerId: 'lyr_o',
      geometry: { outline: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] } },
    } as unknown as Entity;
    expect(decomposeBimEntityToDxfPrimitives(opening)[0].type).toBe('lwpolyline');
  });

  it('mep-segment (duct/pipe) με outline → lwpolyline', () => {
    const seg = {
      id: 's1', type: 'mep-segment', layerId: 'lyr_s',
      geometry: { outline: { vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 1 }, { x: 0, y: 1 }] } },
    } as unknown as Entity;
    expect(decomposeBimEntityToDxfPrimitives(seg)[0].type).toBe('lwpolyline');
  });
});

describe('flattenSceneEntitiesForDxf', () => {
  it('native περνά αυτούσιο, BIM γίνεται primitive', () => {
    const r = flattenSceneEntitiesForDxf([native('line', 'l1'), wall('w1')]);
    expect(r.warnings).toEqual([]);
    expect(r.entities.map((e) => e.type).sort()).toEqual(['line', 'lwpolyline']);
  });

  it('μη-υποστηριζόμενος BIM → παραλείπεται + warning', () => {
    const fixture = { id: 'm1', type: 'mep-fixture', layerId: 'lyr_m' } as unknown as Entity;
    const r = flattenSceneEntitiesForDxf([native('line', 'l1'), fixture]);
    expect(r.entities.map((e) => e.type)).toEqual(['line']);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('mep-fixture');
  });

  it('κενή λίστα → κενό αποτέλεσμα', () => {
    const r = flattenSceneEntitiesForDxf([]);
    expect(r.entities).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
