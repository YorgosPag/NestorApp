/**
 * ADR-920 Β6.11 Ζ1 — DXF polylines and text labels, read in plan without the DXF Viewer.
 *
 *   L  LWPOLYLINE: vertices + bulges + closed flag + layer/handle; 210–230 written AFTER the vertices still apply
 *   O  OCS: a flipped extrusion mirrors x AND reverses every bulge; a tilted plane is skipped by name, never bent
 *   P  POLYLINE / VERTEX / SEQEND: 2D (OCS), 3D (WCS, elevation only when level), meshes skipped, spline frame dropped
 *   B  only ENTITIES: a polyline inside a BLOCK definition is a template, not the drawing
 *   T  TEXT anchors at the alignment point when justified; plain MTEXT read; formatted MTEXT counted, not guessed
 */

import { scanDxfPolylines } from '../dxf-polylines';
import { scanDxfTextLabels } from '../dxf-text-labels';

/** `[code, value, code, value, …]` → DXF text. */
const dxf = (...pairs: (string | number)[]): string => pairs.map(String).join('\n');
const section = (name: string, ...pairs: (string | number)[]): (string | number)[] => ['0', 'SECTION', '2', name, ...pairs, '0', 'ENDSEC'];
const file = (...sections: (string | number)[][]): string => dxf(...sections.flat(), '0', 'EOF');

const SQUARE = ['10', 0, '20', 0, '42', 1, '10', 10, '20', 0, '10', 10, '20', 10, '10', 0, '20', 10];

describe('L — LWPOLYLINE', () => {
  it('reads vertices, bulges, closed flag, layer and handle', () => {
    const scan = scanDxfPolylines(file(
      section('HEADER', '9', '$INSUNITS', '70', 6),
      section('ENTITIES', '0', 'LWPOLYLINE', '5', '2F', '8', 'ΟΡΙΑ_ΟΙΚΟΠΕΔΟΥ', '90', 4, '70', 1, '38', 12.5, ...SQUARE),
    ));
    expect(scan.declaredInsunits).toBe(6);
    expect(scan.polylines).toHaveLength(1);
    const [p] = scan.polylines;
    expect(p).toMatchObject({ kind: 'LWPOLYLINE', handle: '2F', layer: 'ΟΡΙΑ_ΟΙΚΟΠΕΔΟΥ', closed: true, elevation: 12.5 });
    expect(p.vertices).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(p.bulges).toEqual([1, 0, 0, 0]);
  });

  it('an open polyline is returned open; a missing layer is the DXF default «0»', () => {
    const scan = scanDxfPolylines(file(section('ENTITIES', '0', 'LWPOLYLINE', '90', 2, '70', 0, '10', 0, '20', 0, '10', 5, '20', 5)));
    expect(scan.polylines[0]).toMatchObject({ closed: false, layer: '0', handle: null });
  });
});

describe('O — OCS', () => {
  it('flipped extrusion (written after the vertices): x mirrors, bulges reverse, elevation flips sign', () => {
    const scan = scanDxfPolylines(file(section('ENTITIES',
      '0', 'LWPOLYLINE', '90', 4, '70', 1, '38', 5, ...SQUARE, '210', 0, '220', 0, '230', -1)));
    const [p] = scan.polylines;
    expect(p.vertices.map((v) => ({ x: v.x + 0, y: v.y }))).toEqual([{ x: 0, y: 0 }, { x: -10, y: 0 }, { x: -10, y: 10 }, { x: 0, y: 10 }]);
    expect(p.bulges[0]).toBe(-1);
    expect(p.elevation).toBe(-5);
  });

  it('a tilted plane is skipped and counted', () => {
    const scan = scanDxfPolylines(file(section('ENTITIES',
      '0', 'LWPOLYLINE', '90', 4, '70', 1, ...SQUARE, '210', 1, '220', 0, '230', 0)));
    expect(scan.polylines).toHaveLength(0);
    expect(scan.skipped['tilted-plane']).toBe(1);
  });
});

describe('P — POLYLINE / VERTEX / SEQEND', () => {
  const vertex = (x: number, y: number, z = 0, extra: (string | number)[] = []): (string | number)[] =>
    ['0', 'VERTEX', '8', 'X', '10', x, '20', y, '30', z, ...extra];

  it('2D closed polyline with a bulge, then the scan continues after SEQEND', () => {
    const scan = scanDxfPolylines(file(section('ENTITIES',
      '0', 'POLYLINE', '5', 'AA', '8', 'BOUNDARY', '66', 1, '10', 0, '20', 0, '30', 3, '70', 1,
      ...vertex(0, 0, 0, ['42', 0.5]), ...vertex(8, 0), ...vertex(8, 6), '0', 'SEQEND',
      '0', 'LWPOLYLINE', '90', 2, '70', 0, '10', 0, '20', 0, '10', 1, '20', 1)));
    expect(scan.polylines).toHaveLength(2);
    expect(scan.polylines[0]).toMatchObject({ kind: 'POLYLINE', handle: 'AA', layer: 'BOUNDARY', closed: true, elevation: 3 });
    expect(scan.polylines[0].bulges).toEqual([0.5, 0, 0]);
  });

  it('3D polyline: WCS, no bulges; elevation only when every vertex shares it', () => {
    const scan = scanDxfPolylines(file(section('ENTITIES',
      '0', 'POLYLINE', '70', 9, ...vertex(0, 0, 1), ...vertex(4, 0, 2), ...vertex(4, 4, 3), '0', 'SEQEND')));
    expect(scan.polylines[0]).toMatchObject({ closed: true, elevation: null, bulges: [0, 0, 0] });
  });

  it('polyface / mesh polylines are surfaces, not outlines', () => {
    const scan = scanDxfPolylines(file(section('ENTITIES', '0', 'POLYLINE', '70', 64, ...vertex(0, 0), '0', 'SEQEND')));
    expect(scan.polylines).toHaveLength(0);
    expect(scan.skipped.mesh).toBe(1);
  });

  it('spline frame control points (vertex flag 16) are not on the curve and are dropped', () => {
    const scan = scanDxfPolylines(file(section('ENTITIES',
      '0', 'POLYLINE', '70', 1, ...vertex(0, 0), ...vertex(50, 50, 0, ['70', 16]), ...vertex(4, 0), ...vertex(4, 4), '0', 'SEQEND')));
    expect(scan.polylines[0].vertices).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }]);
  });
});

describe('B — only the ENTITIES section', () => {
  it('ignores polylines inside BLOCK definitions', () => {
    const scan = scanDxfPolylines(file(
      section('BLOCKS', '0', 'BLOCK', '2', 'TREE', '0', 'LWPOLYLINE', '90', 3, '70', 1, '10', 0, '20', 0, '10', 1, '20', 0, '10', 1, '20', 1, '0', 'ENDBLK'),
      section('ENTITIES'),
    ));
    expect(scan.polylines).toHaveLength(0);
  });
});

describe('T — text labels', () => {
  it('TEXT anchors at its alignment point when justified, else at its insertion point', () => {
    const scan = scanDxfTextLabels(file(section('ENTITIES',
      '0', 'TEXT', '8', 'ΚΟΡΥΦΕΣ', '10', 0, '20', 0, '1', 'Α',
      '0', 'TEXT', '10', 0, '20', 0, '11', 7, '21', 8, '72', 1, '1', 'Β')));
    expect(scan.labels).toEqual([
      { text: 'Α', at: { x: 0, y: 0 }, layer: 'ΚΟΡΥΦΕΣ' },
      { text: 'Β', at: { x: 7, y: 8 }, layer: '0' },
    ]);
  });

  it('reads plain MTEXT and counts formatted MTEXT instead of guessing it', () => {
    const scan = scanDxfTextLabels(file(section('ENTITIES',
      '0', 'MTEXT', '10', 3, '20', 4, '1', 'Γ',
      '0', 'MTEXT', '10', 3, '20', 4, '1', '{\\fArial|b0;Ε = 1.364,05 τ.μ.}')));
    expect(scan.labels).toEqual([{ text: 'Γ', at: { x: 3, y: 4 }, layer: '0' }]);
    expect(scan.formattedMtextSkipped).toBe(1);
  });
});
