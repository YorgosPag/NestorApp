/**
 * ADR-635 / ADR-650 M2 / ADR-462 (2026-10-25) — DXF elevation survives the import, end to end
 * (`DxfSceneBuilder.buildScene`: parse → convert → block placement → canonical-mm).
 *
 * Measured live before the fix: an LWPOLYLINE with 38 = 1.0 arrived as a 2D `polyline` → the breakline tool fell
 * back to «proximity». And had only the 38 been read, a metre file would have given 1 mm instead of 1000 mm — the
 * unit pass scaled X/Y but never Z. Both are pinned here with numbers.
 */

import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { AnySceneEntity } from '../../types/scene';
import { entityVertexElevations, withPlacedElevation } from '../entity-elevation';
import type { PolylineEntity } from '../../types/entities';

type Pair = [string | number, string | number];
const flat = (pairs: Pair[]): string[] => pairs.flatMap(([c, v]) => [String(c), String(v)]);

/** A DXF with an optional $INSUNITS header, the given ENTITIES records and optional BLOCKS. */
function dxf(entities: Pair[], opts: { insunits?: number; blocks?: Pair[] } = {}): string {
  return [
    ...(opts.insunits !== undefined
      ? flat([['0', 'SECTION'], ['2', 'HEADER'], ['9', '$INSUNITS'], ['70', opts.insunits], ['0', 'ENDSEC']])
      : []),
    ...(opts.blocks ? flat([['0', 'SECTION'], ['2', 'BLOCKS'], ...opts.blocks, ['0', 'ENDSEC']]) : []),
    ...flat([['0', 'SECTION'], ['2', 'ENTITIES'], ...entities, ['0', 'ENDSEC'], ['0', 'EOF']]),
  ].join('\n');
}

function scene(content: string, units?: 'mm'): AnySceneEntity[] {
  return DxfSceneBuilder.buildScene(content, units).entities;
}

const only = (es: AnySceneEntity[], type: string) => {
  const found = es.filter((e) => e.type === type);
  expect(found).toHaveLength(1);
  return found[0]!;
};

const LW_SQUARE: Pair[] = [['10', 0], ['20', 0], ['10', 10], ['20', 0], ['10', 10], ['20', 10]];

describe('LWPOLYLINE — 38 elevation', () => {
  it('38 = 1.0 in a METRE file ⇒ elevation 1000 mm (Z scales with the unit pass)', () => {
    const e = only(scene(dxf([['0', 'LWPOLYLINE'], ['8', 'BRK'], ['90', 3], ['70', 0], ['38', '1.0'], ...LW_SQUARE], { insunits: 6 })), 'polyline');
    expect((e as PolylineEntity).elevation).toBe(1000);
    expect((e as PolylineEntity).vertices[1]).toEqual({ x: 10000, y: 0 });
    expect(entityVertexElevations(e)).toEqual([1000, 1000, 1000]);
  });

  it('no 38 (or 38 = 0) ⇒ a 2D polyline: no elevation field at all', () => {
    const none = only(scene(dxf([['0', 'LWPOLYLINE'], ['90', 3], ...LW_SQUARE]), 'mm'), 'polyline');
    const zero = only(scene(dxf([['0', 'LWPOLYLINE'], ['90', 3], ['38', '0'], ...LW_SQUARE]), 'mm'), 'polyline');
    for (const e of [none, zero]) {
      expect(e).not.toHaveProperty('elevation');
      expect(e).not.toHaveProperty('vertexElevations');
    }
  });

  it('extrusion (0,0,−1) — mirrored: X flips AND the elevation sign flips', () => {
    const e = only(scene(dxf([
      ['0', 'LWPOLYLINE'], ['90', 3], ['38', '2.5'], ...LW_SQUARE, ['210', 0], ['220', 0], ['230', -1],
    ]), 'mm'), 'polyline') as PolylineEntity;
    expect(e.vertices.map((v) => v.x + 0)).toEqual([0, -10, -10]); // `+ 0` folds −0 (signed zero) into 0
    expect(e.vertices.map((v) => v.y)).toEqual([0, 0, 10]);
    expect(e.elevation).toBe(-2.5);
  });

  it('a tilted plane yields a genuinely 3D polyline (per-vertex Z)', () => {
    const e = only(scene(dxf([
      ['0', 'LWPOLYLINE'], ['90', 3], ['38', '0'], ...LW_SQUARE, ['210', 1], ['220', 0], ['230', 1],
    ]), 'mm'), 'polyline') as PolylineEntity;
    expect(e.elevation).toBeUndefined();
    expect(e.vertexElevations).toHaveLength(3);
    expect(new Set(e.vertexElevations!.map((z) => z.toFixed(6))).size).toBeGreaterThan(1);
  });
});

describe('old-style POLYLINE', () => {
  const vertex = (x: number, y: number, z: number): Pair[] => [['0', 'VERTEX'], ['10', x], ['20', y], ['30', z]];

  it('3D POLYLINE (70 bit 8) ⇒ per-vertex Z from VERTEX 30', () => {
    const e = only(scene(dxf([
      ['0', 'POLYLINE'], ['66', 1], ['70', 8], ['10', 0], ['20', 0], ['30', 0],
      ...vertex(0, 0, 5), ...vertex(10, 0, 6), ...vertex(20, 0, 7.5), ['0', 'SEQEND'],
    ]), 'mm'), 'polyline') as PolylineEntity;
    expect(e.vertexElevations).toEqual([5, 6, 7.5]);
    expect(e.vertices).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]);
  });

  it('2D POLYLINE ⇒ ONE elevation from the HEADER point 30 (per-vertex 30 is not its elevation)', () => {
    const e = only(scene(dxf([
      ['0', 'POLYLINE'], ['66', 1], ['70', 0], ['10', 0], ['20', 0], ['30', 12],
      ...vertex(0, 0, 0), ...vertex(10, 0, 0), ['0', 'SEQEND'],
    ]), 'mm'), 'polyline') as PolylineEntity;
    expect(e.elevation).toBe(12);
    expect(e.vertexElevations).toBeUndefined();
  });
});

describe('LINE / SPLINE', () => {
  it('LINE 30/31 ⇒ start/end elevation, scaled to mm', () => {
    const e = only(scene(dxf([['0', 'LINE'], ['10', 0], ['20', 0], ['30', 1], ['11', 5], ['21', 0], ['31', 2]], { insunits: 6 })), 'line');
    expect(e).toMatchObject({ startElevation: 1000, endElevation: 2000 });
  });

  it('a flat LINE carries no elevation fields', () => {
    const e = only(scene(dxf([['0', 'LINE'], ['10', 0], ['20', 0], ['30', 0], ['11', 5], ['21', 0], ['31', 0]]), 'mm'), 'line');
    expect(e).not.toHaveProperty('startElevation');
  });

  it('SPLINE control points keep their Z (a contour delivered as a spline)', () => {
    const e = only(scene(dxf([
      ['0', 'SPLINE'], ['71', 3], ['73', 3],
      ['10', 0], ['20', 0], ['30', 4], ['10', 5], ['20', 5], ['30', 4], ['10', 10], ['20', 0], ['30', 4],
    ]), 'mm'), 'polyline') as PolylineEntity;
    expect(e.elevation).toBe(4);
  });
});

describe('withPlacedElevation — INSERT Z placement', () => {
  const poly = (extra: Partial<PolylineEntity>): PolylineEntity => ({
    id: 'p', type: 'polyline', layerId: '0', vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }], ...extra,
  });

  it('z′ = insertZ + sz·(z − baseZ)', () => {
    const placed = withPlacedElevation(poly({ vertexElevations: [1, 3] }), (z) => 10 + 2 * (z - 1));
    expect(placed.vertexElevations).toEqual([10, 14]);
  });

  it('a flat member inserted at Z = 5 lands at 5', () => {
    expect(withPlacedElevation(poly({}), (z) => z + 5).elevation).toBe(5);
  });

  it('a member that lands on Z = 0 everywhere loses its fields (removed, never left undefined)', () => {
    const placed = withPlacedElevation(poly({ elevation: 5 }), (z) => z - 5);
    expect(Object.keys(placed)).not.toContain('elevation');
  });

  it('flattened block (*X): INSERT 30 offsets the member Z end to end', () => {
    const e = only(scene(dxf([['0', 'INSERT'], ['2', '*X1'], ['10', 0], ['20', 0], ['30', 7]], {
      blocks: [
        ['0', 'BLOCK'], ['2', '*X1'], ['70', 1], ['10', 0], ['20', 0], ['30', 0],
        ['0', 'LINE'], ['10', 0], ['20', 0], ['30', 1], ['11', 5], ['21', 0], ['31', 1],
        ['0', 'ENDBLK'],
      ],
    }), 'mm'), 'line');
    expect(e).toMatchObject({ startElevation: 8, endElevation: 8 });
  });
});
