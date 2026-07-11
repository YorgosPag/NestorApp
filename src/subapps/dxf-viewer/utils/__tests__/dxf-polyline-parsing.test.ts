import { parseVerticesFromPairs } from '../dxf-converter-helpers';
import { DxfEntityParser } from '../dxf-entity-parser';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { AnySceneEntity } from '../../types/scene';

/**
 * Φ1 — AutoCAD DXF polyline support (ADR-065 / ADR-507 pattern).
 *
 * Guards the two silent-drop bugs that hid polylines from every AutoCAD import:
 *  1. Old-style POLYLINE (R12/AC1009: POLYLINE + N×VERTEX + SEQEND) was never parsed.
 *  2. LWPOLYLINE vertices read from the flat `data` map → repeated 10/20 overwritten →
 *     only the last vertex survived → `<2 vertices` → dropped.
 */

/** Split a code/value list into the trimmed line array buildScene/parser expect. */
function lines(...pairs: Array<[string | number, string | number]>): string[] {
  return pairs.flatMap(([c, v]) => [String(c), String(v)]);
}

function polylineEntities(content: string): AnySceneEntity[] {
  return DxfSceneBuilder.buildScene(content).entities.filter(e => e.type === 'polyline');
}

describe('parseVerticesFromPairs (ordered-pairs vertex SSoT)', () => {
  it('keeps every vertex when 10/20 repeat (flat data map would lose all but last)', () => {
    const verts = parseVerticesFromPairs([
      ['10', '0'], ['20', '0'],
      ['10', '10'], ['20', '0'],
      ['10', '10'], ['20', '10'],
      ['10', '0'], ['20', '10'],
    ]);
    expect(verts).toHaveLength(4);
    expect(verts[2]).toEqual({ x: 10, y: 10 });
  });

  it('captures non-zero bulge (code 42) on the owning vertex, skips zero bulge', () => {
    const verts = parseVerticesFromPairs([
      ['10', '0'], ['20', '0'], ['42', '0.5'],
      ['10', '10'], ['20', '0'], ['42', '0'],
    ]);
    expect(verts[0]).toEqual({ x: 0, y: 0, bulge: 0.5 });
    expect(verts[1]).toEqual({ x: 10, y: 0 });
    expect(verts[1]).not.toHaveProperty('bulge');
  });

  it('returns [] for undefined / empty pairs', () => {
    expect(parseVerticesFromPairs(undefined)).toEqual([]);
    expect(parseVerticesFromPairs([])).toEqual([]);
  });
});

describe('DxfEntityParser.parsePolylineGroup (old-style compound POLYLINE)', () => {
  it('aggregates VERTEX blocks and EXCLUDES the header elevation 10/20/30', () => {
    // Header dummy point is 0,0,0; real vertices start at (1,1). If the header leaked
    // we would see 4 vertices including a spurious (0,0).
    const src = lines(
      ['0', 'POLYLINE'], ['8', 'WALLS'], ['66', '1'], ['70', '1'],
      ['10', '0'], ['20', '0'], ['30', '0'],
      ['0', 'VERTEX'], ['8', 'WALLS'], ['10', '1'], ['20', '1'],
      ['0', 'VERTEX'], ['8', 'WALLS'], ['10', '10'], ['20', '1'],
      ['0', 'VERTEX'], ['8', 'WALLS'], ['10', '10'], ['20', '10'],
      ['0', 'SEQEND'], ['8', 'WALLS'],
      ['0', 'LINE'], // sentinel: scanning must resume here
    );

    const { entity, next } = DxfEntityParser.parsePolylineGroup(src, 0);
    const verts = parseVerticesFromPairs(entity.pairs);

    expect(entity.type).toBe('POLYLINE');
    expect(entity.layer).toBe('WALLS');
    expect(entity.data['70']).toBe('1');
    expect(verts).toHaveLength(3);
    expect(verts[0]).toEqual({ x: 1, y: 1 });
    // `next` must land on the sentinel LINE marker (past SEQEND).
    expect(src[next]).toBe('0');
    expect(src[next + 1]).toBe('LINE');
  });
});

describe('DxfSceneBuilder.buildScene — polyline coverage (end-to-end)', () => {
  const wrap = (body: string[]): string =>
    [...lines(['0', 'SECTION'], ['2', 'ENTITIES']), ...body, ...lines(['0', 'ENDSEC'], ['0', 'EOF'])].join('\n');

  it('renders an old-style POLYLINE as a polyline entity', () => {
    const polys = polylineEntities(wrap(lines(
      ['0', 'POLYLINE'], ['8', '0'], ['66', '1'], ['70', '0'],
      ['10', '0'], ['20', '0'], ['30', '0'],
      ['0', 'VERTEX'], ['8', '0'], ['10', '1'], ['20', '1'],
      ['0', 'VERTEX'], ['8', '0'], ['10', '20'], ['20', '1'],
      ['0', 'VERTEX'], ['8', '0'], ['10', '20'], ['20', '20'],
      ['0', 'SEQEND'], ['8', '0'],
    )));
    expect(polys).toHaveLength(1);
    expect((polys[0] as { vertices: unknown[] }).vertices).toHaveLength(3);
  });

  it('treats POLYLINE flag 129 (128|1) as CLOSED and 128 as open (bitmask, not ===1)', () => {
    const build = (flag: number) => polylineEntities(wrap(lines(
      ['0', 'POLYLINE'], ['8', '0'], ['66', '1'], ['70', String(flag)],
      ['10', '0'], ['20', '0'], ['30', '0'],
      ['0', 'VERTEX'], ['8', '0'], ['10', '1'], ['20', '1'],
      ['0', 'VERTEX'], ['8', '0'], ['10', '20'], ['20', '20'],
      ['0', 'SEQEND'], ['8', '0'],
    )))[0] as { closed: boolean };
    expect(build(129).closed).toBe(true);
    expect(build(128).closed).toBe(false);
  });

  it('regression: a multi-vertex LWPOLYLINE keeps ALL vertices (was dropped)', () => {
    const polys = polylineEntities(wrap(lines(
      ['0', 'LWPOLYLINE'], ['8', '0'], ['90', '4'], ['70', '1'],
      ['10', '0'], ['20', '0'],
      ['10', '10'], ['20', '0'],
      ['10', '10'], ['20', '10'],
      ['10', '0'], ['20', '10'],
    )));
    expect(polys).toHaveLength(1);
    expect((polys[0] as { vertices: unknown[] }).vertices).toHaveLength(4);
    expect((polys[0] as { closed: boolean }).closed).toBe(true);
  });
});
