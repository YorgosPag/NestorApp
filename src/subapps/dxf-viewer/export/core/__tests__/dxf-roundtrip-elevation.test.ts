/**
 * DXF elevation + arc round-trip — ADR-636 Φ2.4 (D.8), the export half of ADR-635 Φ C.29.
 *
 * Measured before D.8: contours imported WITH elevation were exported FLAT (the writer never wrote 38 / header 30 /
 * VERTEX 30 / LINE 30-31), and every polyline arc (42) left as a chord. Each case runs the whole cycle through the
 * real code: `DxfSceneBuilder.buildScene` (import) → `writeDxfAscii` (export) → `buildScene` again ⇒ the same Z in
 * canonical mm, on both the bare and the professional (R2018) envelope.
 */

import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii, type DxfWriteOptions } from '../dxf-ascii-writer';
import { densifyElevatedPath } from '../dxf-ascii-path-emitter';
import { DxfSceneBuilder } from '../../../utils/dxf-scene-builder';
import { entityVertexElevations } from '../../../utils/entity-elevation';
import type { AnySceneEntity } from '../../../types/scene';
import type { SceneUnits } from '../../../utils/scene-units';
import type { Entity, PolylineEntity } from '../../../types/entities';

type Pair = [string | number, string | number];
const flat = (pairs: Pair[]): string[] => pairs.flatMap(([c, v]) => [String(c), String(v)]);

const DXF_MM = 4;
const DXF_M = 6;

/** A source DXF: $INSUNITS header + ENTITIES. */
function source(entities: Pair[], insunits = DXF_MM): string {
  return [
    ...flat([['0', 'SECTION'], ['2', 'HEADER'], ['9', '$INSUNITS'], ['70', insunits], ['0', 'ENDSEC']]),
    ...flat([['0', 'SECTION'], ['2', 'ENTITIES'], ...entities, ['0', 'ENDSEC'], ['0', 'EOF']]),
  ].join('\n');
}

/**
 * The unit is pinned (wizard override) so the ADR-716 bounds heuristic cannot reinterpret these tiny test drawings
 * (it reads a small `$INSUNITS=4` drawing as centimetres) — this suite is about Z, not unit guessing.
 */
const importScene = (content: string, units: SceneUnits = 'mm'): AnySceneEntity[] =>
  DxfSceneBuilder.buildScene(content, units).entities;

const LAYERS = { '0': { name: '0' } };
const BARE: DxfWriteOptions = { layersById: LAYERS, insunits: DXF_MM };
const PRO: DxfWriteOptions = { layersById: LAYERS, insunits: DXF_MM, acadVer: 'AC1021' };

/** Export a scene and import it back. */
function cycle(
  entities: readonly AnySceneEntity[], options: DxfWriteOptions, units: SceneUnits = 'mm',
): { dxf: string; back: AnySceneEntity[] } {
  const dxf = writeDxfAscii(entities as unknown as Entity[], options);
  return { dxf, back: importScene(dxf, units) };
}

const only = (es: readonly AnySceneEntity[], type: string): AnySceneEntity => {
  const found = es.filter((e) => e.type === type);
  expect(found).toHaveLength(1);
  return found[0]!;
};

const zsOf = (e: AnySceneEntity): readonly number[] | null => entityVertexElevations(e as unknown as Entity);

/** The POLYLINE header record (between `0 POLYLINE` and the first `0 VERTEX`) as code → value. */
function polylineHeader(dxf: string): Record<string, string> {
  const t = dxf.split('\n');
  const out: Record<string, string> = {};
  let i = t.findIndex((v, k) => k % 2 === 1 && v === 'POLYLINE' && t[k - 1] === '0') + 1;
  for (; i + 1 < t.length && t[i] !== '0'; i += 2) out[t[i]!] = t[i + 1]!;
  return out;
}

const count = (dxf: string, needle: string): number => dxf.split(needle).length - 1;

/** POLYLINE … SEQEND only — a professional file also carries handles whose VALUE may read `42` (`5 / 42`). */
const polylineRecord = (dxf: string): string => dxf.slice(dxf.indexOf('0\nPOLYLINE\n'), dxf.indexOf('0\nSEQEND\n'));

const LW_SQUARE: Pair[] = [['10', 0], ['20', 0], ['10', 10000], ['20', 0], ['10', 10000], ['20', 10000]];
const lwpolyline = (extra: Pair[], verts: Pair[] = LW_SQUARE): Pair[] =>
  [['0', 'LWPOLYLINE'], ['8', '0'], ['90', verts.length / 2], ['70', 0], ...extra, ...verts];

function polyline3d(zs: number[]): Pair[] {
  const vs = zs.flatMap((z, i): Pair[] => [['0', 'VERTEX'], ['8', '0'], ['10', i * 1000], ['20', 0], ['30', z], ['70', 32]]);
  return [['0', 'POLYLINE'], ['8', '0'], ['66', 1], ['70', 8], ...vs, ['0', 'SEQEND'], ['8', '0']];
}

describe.each([['bare', BARE], ['professional (R2018)', PRO]] as const)('D.8 elevation round-trip — %s', (_n, opts) => {
  it('2.5D: LWPOLYLINE 38 → 2D POLYLINE header 30 → the same single elevation', () => {
    const first = importScene(source(lwpolyline([['38', 1500]])));
    const { dxf, back } = cycle(first, opts);
    const head = polylineHeader(dxf);
    expect(head['30']).toBe('1500');
    expect(Number(head['70']) & 8).toBe(0);
    expect((only(back, 'polyline') as unknown as PolylineEntity).elevation).toBe(1500);
    expect(zsOf(only(back, 'polyline'))).toEqual([1500, 1500, 1500]);
  });

  it('3D: per-vertex Z → 3D POLYLINE (70 bit 8, VERTEX 70 32) → the same Zs', () => {
    const first = importScene(source(polyline3d([100, 1200, 2750])));
    const { dxf, back } = cycle(first, opts);
    expect(Number(polylineHeader(dxf)['70']) & 8).toBe(8);
    expect(count(dxf, '\n70\n32\n')).toBe(3);
    if (opts === PRO) {
      expect(dxf).toContain('100\nAcDb3dPolyline\n');
      expect(count(dxf, '100\nAcDb3dPolylineVertex\n')).toBe(3);
      expect(dxf).not.toContain('AcDb2dVertex');
    }
    expect(zsOf(only(back, 'polyline'))).toEqual([100, 1200, 2750]);
  });

  it('LINE 30 / 31 → the same endpoint Zs', () => {
    const first = importScene(source([['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['30', 250], ['11', 5000], ['21', 0], ['31', 900]]));
    expect(zsOf(only(cycle(first, opts).back, 'line'))).toEqual([250, 900]);
  });

  it('a metre file: Z scales with the COORDINATE factor (1 m ⇄ 1000 mm), not with mmScale', () => {
    const first = importScene(source([
      ...lwpolyline([['38', 1]], [['10', 0], ['20', 0], ['10', 10], ['20', 0]]),
      ['0', 'LINE'], ['8', '0'], ['10', 0], ['20', 0], ['30', 2], ['11', 5], ['21', 0], ['31', 3],
    ], DXF_M), 'm');
    expect(zsOf(only(first, 'polyline'))).toEqual([1000, 1000]);
    // `mmScale` deliberately WRONG (≠ `scale`): a writer that scaled the scene Z by it would print 7000, not 1.
    const { dxf, back } = cycle(first, { ...opts, insunits: DXF_M, scale: 0.001, mmScale: 7 }, 'm');
    expect(polylineHeader(dxf)['30']).toBe('1');
    expect(zsOf(only(back, 'polyline'))).toEqual([1000, 1000]);
    expect(zsOf(only(back, 'line'))).toEqual([2000, 3000]);
  });

  it('no elevation → no header point (the pre-D.8 POLYLINE, unchanged)', () => {
    const { dxf, back } = cycle(importScene(source(lwpolyline([]))), opts);
    const head = polylineHeader(dxf);
    expect(head['10']).toBeUndefined();
    expect(head['30']).toBeUndefined();
    expect(zsOf(only(back, 'polyline'))).toBeNull();
  });

  it('fail-closed: a per-vertex array that no longer matches the vertices exports 2D', () => {
    const [poly] = importScene(source(polyline3d([1, 2, 3])));
    const stale = { ...(poly as unknown as PolylineEntity), vertexElevations: [1, 2] } as unknown as AnySceneEntity;
    const { dxf, back } = cycle([stale], opts);
    expect(Number(polylineHeader(dxf)['70']) & 8).toBe(0);
    expect(zsOf(only(back, 'polyline'))).toBeNull();
  });
});

describe('D.8 arcs (42) — the export half of the bulge round-trip', () => {
  // ⚠️ The IMPORT still drops 42 (`buildPolylineSceneEntity` keeps no `bulges`), so these start from a scene polyline
  // drawn in the app (ADR-510 fillet / bulge grip) — the source of every `bulges` array today.
  const arcPolyline = (extra: Partial<PolylineEntity> = {}): AnySceneEntity => ({
    id: 'p', type: 'polyline', layerId: '0', visible: true, closed: false,
    vertices: [{ x: 0, y: 0 }, { x: 10000, y: 0 }], bulges: [1, 0], ...extra,
  }) as unknown as AnySceneEntity;
  const write = (e: AnySceneEntity, opts: DxfWriteOptions): string => writeDxfAscii([e] as unknown as Entity[], opts);

  it('2D POLYLINE writes VERTEX 42 on the vertex that STARTS the arc — never on the last vertex of an open path', () => {
    const dxf = write(arcPolyline({ bulges: [1, 0.5] }), PRO);
    expect(count(polylineRecord(dxf), '\n42\n')).toBe(1);
    expect(count(polylineRecord(dxf), '\n42\n1\n')).toBe(1);
  });

  it('a closed path writes the 42 of the closing segment on its last vertex', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const dxf = write(arcPolyline({ closed: true, vertices: square, bulges: [0, 0, -0.5] }), BARE);
    expect(count(dxf, '\n42\n-0.5\n')).toBe(1);
  });

  it('Tekton (lines): the arc is tessellated, never a single chord — and stays 2D', () => {
    const dxf = write(arcPolyline({ elevation: 500 }), { ...BARE, lineMode: 'lines' });
    expect(count(dxf, '0\nLINE\n')).toBeGreaterThan(10);
    expect(dxf).not.toContain('\n30\n');
    expect(dxf).not.toContain('POLYLINE');
  });

  it('Tekton (lines): a LINE with scene Z stays 2D too (its parser reads no Z)', () => {
    const line = {
      id: 'l', type: 'line', layerId: '0', visible: true,
      start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, startElevation: 250, endElevation: 900,
    } as unknown as AnySceneEntity;
    const dxf = write(line, { ...BARE, lineMode: 'lines' });
    expect(count(dxf, '0\nLINE\n')).toBe(1);
    expect(dxf).not.toContain('\n30\n');
    expect(dxf).not.toContain('\n31\n');
  });

  it('3D + arc: densified (a 3D POLYLINE has no 42) with Z linear along the arc', () => {
    const { dxf, back } = cycle([arcPolyline({ vertexElevations: [0, 1500] })], PRO);
    expect(polylineRecord(dxf)).not.toContain('\n42\n');
    const zs = zsOf(only(back, 'polyline'))!;
    expect(zs.length).toBeGreaterThan(10);
    expect(zs[0]).toBe(0);
    expect(zs[zs.length - 1]).toBe(1500);
    zs.slice(1).forEach((z, i) => expect(z).toBeGreaterThan(zs[i]!));
  });

  it('densify: a closed path does not repeat its first point', () => {
    const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    const out = densifyElevatedPath(square, [0, 0, 0], true, [1, 2, 3]);
    expect(out.points).toEqual(square);
    expect(out.zs).toEqual([1, 2, 3]);
  });
});
