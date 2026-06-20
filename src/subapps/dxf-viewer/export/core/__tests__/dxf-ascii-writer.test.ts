/**
 * ADR-505 §A — `dxf-ascii-writer` (Tekton-compatible minimal DXF).
 *
 * Επαληθεύει: bare ENTITIES envelope (χωρίς HEADER/TABLES)· LINE 10/20/11/21/8
 * χωρίς Z· POLYLINE → explode σε LINE segments (Tekton δεν διαβάζει POLYLINE)·
 * CIRCLE· ARC → tessellation σε LINEs· layer name· coordinate scaling· skip.
 */

import { writeDxfAscii } from '../dxf-ascii-writer';
import type { Entity } from '../../../types/entities';

function line(): Entity {
  return { id: 'a', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } } as unknown as Entity;
}
function closedPoly(): Entity {
  return {
    id: 'p', type: 'lwpolyline', layerId: 'L', closed: true,
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  } as unknown as Entity;
}
function circle(): Entity {
  return { id: 'c', type: 'circle', layerId: 'L', center: { x: 5, y: 5 }, radius: 2.5 } as unknown as Entity;
}
function arc(): Entity {
  return { id: 'r', type: 'arc', layerId: 'L', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90 } as unknown as Entity;
}

const LAYERS = { L: { name: 'COLOR_10' } };

const countOccurrences = (s: string, sub: string): number => s.split(sub).length - 1;

describe('writeDxfAscii — Tekton minimal dialect', () => {
  it('bare ENTITIES envelope, ΧΩΡΙΣ HEADER/TABLES', () => {
    const dxf = writeDxfAscii([line()], { layersById: LAYERS });
    expect(dxf.startsWith('0\nSECTION\n2\nENTITIES\n')).toBe(true);
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    expect(dxf).not.toContain('AC1009');
    expect(dxf).not.toContain('TABLES');
    expect(dxf).not.toContain('$INSUNITS');
  });

  it('LINE = 10/20/11/21/8 χωρίς Z (Tekton layout)', () => {
    const dxf = writeDxfAscii([line()], { layersById: LAYERS });
    expect(dxf).toContain('0\nLINE\n10\n0\n20\n0\n11\n100\n21\n50\n8\nCOLOR_10\n');
    expect(dxf).not.toContain('\n30\n'); // κανένα Z
  });

  it('lines mode: closed POLYLINE → 3 LINE segments (όχι POLYLINE)', () => {
    const dxf = writeDxfAscii([closedPoly()], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).not.toContain('POLYLINE');
    expect(dxf).not.toContain('VERTEX');
    expect(countOccurrences(dxf, '0\nLINE\n')).toBe(3); // 2 ακμές + 1 κλείσιμο
  });

  it('CIRCLE = 10/20/40/8', () => {
    const dxf = writeDxfAscii([circle()], { layersById: LAYERS });
    expect(dxf).toContain('0\nCIRCLE\n10\n5\n20\n5\n40\n2.5\n8\nCOLOR_10\n');
  });

  it('lines mode: ARC → tessellation σε LINEs (Tekton δεν έχει ARC)', () => {
    const dxf = writeDxfAscii([arc()], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).not.toContain('0\nARC\n');
    expect(countOccurrences(dxf, '0\nLINE\n')).toBeGreaterThanOrEqual(8);
  });

  it('coordinate scale εφαρμόζεται (mm→m, ×0.001)', () => {
    const dxf = writeDxfAscii([line()], { layersById: LAYERS, scale: 0.001 });
    // start (0,0) → 0· end (100,50) → (0.1, 0.05)
    expect(dxf).toContain('11\n0.1\n21\n0.05\n');
  });

  it('άγνωστος layerId → "0"', () => {
    const dxf = writeDxfAscii([circle()], {});
    expect(dxf).toContain('8\n0\n');
  });

  it('unsupported type (spline/point) → skip χωρίς crash', () => {
    const spline = { id: 's', type: 'spline', layerId: 'L' } as unknown as Entity;
    const dxf = writeDxfAscii([spline, line()], { layersById: LAYERS });
    expect(dxf).not.toContain('SPLINE');
    expect(dxf).toContain('0\nLINE\n');
  });
});

describe('writeDxfAscii — polyline mode (AutoCAD, default)', () => {
  it('default → POLYLINE/VERTEX/SEQEND (όχι exploded LINEs)', () => {
    const dxf = writeDxfAscii([closedPoly()], { layersById: LAYERS });
    expect(dxf).toContain('0\nPOLYLINE\n');
    expect(countOccurrences(dxf, '0\nVERTEX\n')).toBe(3);
    expect(dxf).toContain('0\nSEQEND\n');
    expect(dxf).toMatch(/\n70\n1\n/); // closed flag
  });

  it('default → native ARC (όχι tessellation)', () => {
    const dxf = writeDxfAscii([arc()], { layersById: LAYERS });
    expect(dxf).toContain('0\nARC\n');
    expect(dxf).toMatch(/\n50\n0\n51\n90\n/);
  });

  it('lineMode polyline ρητά = ίδιο με default', () => {
    const a = writeDxfAscii([closedPoly()], { layersById: LAYERS });
    const b = writeDxfAscii([closedPoly()], { layersById: LAYERS, lineMode: 'polyline' });
    expect(a).toBe(b);
  });

  it('3Δ extrusion: dxfThicknessMm × mmScale → group 39 (polyline mode)', () => {
    const extruded = {
      id: 'w', type: 'lwpolyline', layerId: 'L', closed: true, dxfThicknessMm: 3000,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
    } as unknown as Entity;
    // mmScale 0.001 (mm→m): 3000mm → 3m
    const dxf = writeDxfAscii([extruded], { layersById: LAYERS, mmScale: 0.001 });
    expect(dxf).toContain('\n39\n3\n');
  });

  it('lines mode (Τέκτονας) → ΚΑΜΙΑ extrusion (2Δ)', () => {
    const extruded = {
      id: 'w', type: 'lwpolyline', layerId: 'L', closed: true, dxfThicknessMm: 3000,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
    } as unknown as Entity;
    const dxf = writeDxfAscii([extruded], { layersById: LAYERS, lineMode: 'lines', mmScale: 0.001 });
    expect(dxf).not.toContain('\n39\n');
  });
});

describe('writeDxfAscii — colour (ACI code 62)', () => {
  it('entity hex color → ACI (κόκκινο #ff0000 → 1)', () => {
    const red = { id: 'a', type: 'line', layerId: 'L', color: '#ff0000', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as unknown as Entity;
    const dxf = writeDxfAscii([red], { layersById: LAYERS });
    expect(dxf).toContain('8\nCOLOR_10\n62\n1\n');
  });

  it('entity colorAci χρησιμοποιείται απευθείας', () => {
    const e = { id: 'a', type: 'line', layerId: 'L', colorAci: 3, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as unknown as Entity;
    const dxf = writeDxfAscii([e], { layersById: LAYERS });
    expect(dxf).toContain('62\n3\n');
  });

  it('χωρίς χρώμα entity → πέφτει σε layer colour', () => {
    const layers = { L: { name: 'Walls', colorAci: 5 } };
    const dxf = writeDxfAscii([line()], { layersById: layers });
    expect(dxf).toContain('62\n5\n');
  });

  it('χωρίς entity & layer colour → default 7', () => {
    const dxf = writeDxfAscii([line()], { layersById: LAYERS });
    expect(dxf).toContain('62\n7\n');
  });

  it('exploded BIM polyline (lines mode) κρατά το χρώμα σε όλα τα segments', () => {
    const wall = {
      id: 'w', type: 'lwpolyline', layerId: 'L', color: '#ff0000', closed: true,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
    } as unknown as Entity;
    const dxf = writeDxfAscii([wall], { layersById: LAYERS, lineMode: 'lines' });
    expect(countOccurrences(dxf, '62\n1\n')).toBe(3); // και τα 3 segments κόκκινα
  });

  // ADR-505 (rebar 3D) — LINE με προαιρετικό Z ανά άκρο (group 30/31).
  it('LINE με dxfStartZMm/dxfEndZMm → group 30/31 (z × mmScale)', () => {
    const seg = {
      id: 'r', type: 'line', layerId: 'L',
      start: { x: 0, y: 0 }, end: { x: 0, y: 0 },
      dxfStartZMm: 0, dxfEndZMm: 3000,
    } as unknown as Entity;
    const dxf = writeDxfAscii([seg], { layersById: LAYERS, mmScale: 0.001 }); // mm → m
    expect(dxf).toContain('30\n0\n');   // start z = 0
    expect(dxf).toContain('31\n3\n');   // end z = 3000mm × 0.001 = 3m
  });

  it('απλό LINE (χωρίς Z) → ΚΑΝΕΝΑ group 30/31 (body 2Δ αμετάβλητο)', () => {
    const dxf = writeDxfAscii([line()], { layersById: LAYERS });
    expect(dxf).not.toContain('\n30\n');
    expect(dxf).not.toContain('\n31\n');
  });
});
