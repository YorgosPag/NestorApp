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

  it('ADR-636 Στάδιο 1 — HEADER ($ACADVER/$INSUNITS/$DWGCODEPAGE) όταν δοθούν options, ΠΡΙΝ τα ENTITIES', () => {
    const dxf = writeDxfAscii([line()], {
      layersById: LAYERS, acadVer: 'AC1021', insunits: 6, codepage: 'ANSI_1253',
    });
    expect(dxf.startsWith('0\nSECTION\n2\nHEADER\n')).toBe(true);
    expect(dxf).toContain('9\n$ACADVER\n1\nAC1021\n');
    expect(dxf).toContain('9\n$INSUNITS\n70\n6\n');
    expect(dxf).toContain('9\n$DWGCODEPAGE\n3\nANSI_1253\n');
    // HEADER precedes ENTITIES
    expect(dxf.indexOf('2\nHEADER')).toBeLessThan(dxf.indexOf('2\nENTITIES'));
  });

  it('ADR-636 Στάδιο 1 — χωρίς header options → παραμένει bare (zero regression)', () => {
    const dxf = writeDxfAscii([line()], { layersById: LAYERS });
    expect(dxf).not.toContain('HEADER');
    expect(dxf).not.toContain('$ACADVER');
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

// ADR-505 §C — hatch carrier (patternType:'solid') με προ-υπολογισμένα dxfFaces → 3DFACE.
describe('writeDxfAscii — solid fill (3DFACE, ADR-505 §C)', () => {
  function fillQuad(): Entity {
    return {
      id: 'f', type: 'hatch', layerId: 'L', color: '#ff0000',
      patternType: 'solid', boundaryPaths: [[]],
      dxfFaces: [[
        { x: 0, y: 0, zMm: 0 }, { x: 10, y: 0, zMm: 0 },
        { x: 10, y: 0, zMm: 3000 }, { x: 0, y: 0, zMm: 3000 },
      ]],
    } as unknown as Entity;
  }
  function fillTri(): Entity {
    return {
      id: 't', type: 'hatch', layerId: 'L', boundaryPaths: [[]],
      dxfFaces: [[
        { x: 0, y: 0, zMm: 0 }, { x: 4, y: 0, zMm: 0 }, { x: 4, y: 4, zMm: 0 },
      ]],
    } as unknown as Entity;
  }

  it('quad face → 3DFACE με 4 κορυφές (10/20/30 … 13/23/33)', () => {
    const dxf = writeDxfAscii([fillQuad()], { layersById: LAYERS, mmScale: 0.001 });
    expect(dxf).toContain('0\n3DFACE\n');
    // 1η κορυφή (0,0,0) + 3η κορυφή z = 3000mm × 0.001 = 3m στο group 32.
    expect(dxf).toContain('10\n0\n20\n0\n30\n0\n');
    expect(dxf).toContain('\n32\n3\n');
    expect(dxf).toContain('8\nCOLOR_10\n62\n1\n'); // layer + κόκκινο ACI
  });

  it('triangle face → 4η κορυφή = 3η (3DFACE quirk)', () => {
    const dxf = writeDxfAscii([fillTri()], { layersById: LAYERS });
    expect(dxf).toContain('0\n3DFACE\n');
    // 3η κορυφή (12/22) == 4η κορυφή (13/23) = (4,4).
    expect(dxf).toContain('12\n4\n22\n4\n32\n0\n13\n4\n23\n4\n33\n0\n');
  });

  it('hatch χωρίς dxfFaces ΚΑΙ χωρίς usable boundary → skip χωρίς crash', () => {
    const bare = { id: 'b', type: 'hatch', layerId: 'L', boundaryPaths: [[]] } as unknown as Entity;
    const dxf = writeDxfAscii([bare, line()], { layersById: LAYERS });
    expect(dxf).not.toContain('3DFACE');
    expect(dxf).not.toContain('0\nHATCH\n'); // κενά όρια → κανένα HATCH
    expect(dxf).toContain('0\nLINE\n');
  });
});

// ADR-507 Φ1a — native HATCH (boundary loops + pattern meta) όταν ΔΕΝ υπάρχουν dxfFaces.
describe('writeDxfAscii — native HATCH (ADR-507 Φ1a)', () => {
  function solidHatch(): Entity {
    return {
      id: 'h', type: 'hatch', layerId: 'L', color: '#ff0000', fillType: 'solid',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
    } as unknown as Entity;
  }
  function userHatch(): Entity {
    return {
      id: 'u', type: 'hatch', layerId: 'L', fillType: 'user-defined',
      lineAngle: 0, lineSpacing: 5, islandStyle: 'normal',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
    } as unknown as Entity;
  }

  it('solid → HATCH με 2/SOLID, 70/1, 91/1, 93/4 + κορυφές', () => {
    const dxf = writeDxfAscii([solidHatch()], { layersById: LAYERS });
    expect(dxf).toContain('0\nHATCH\n');
    expect(dxf).toContain('100\nAcDbHatch\n');
    expect(dxf).toContain('2\nSOLID\n');
    expect(dxf).toMatch(/\n70\n1\n/);
    expect(dxf).toMatch(/\n91\n1\n/);
    expect(dxf).toMatch(/\n93\n4\n/);
    expect(dxf).toContain('62\n1\n'); // κόκκινο ACI
  });

  it('user-defined → 70/0, 76/0 (user-defined), 52 angle, 41 spacing, 78/1 pattern line', () => {
    const dxf = writeDxfAscii([userHatch()], { layersById: LAYERS });
    expect(dxf).toContain('0\nHATCH\n');
    expect(dxf).toMatch(/\n70\n0\n/);
    expect(dxf).toMatch(/\n76\n0\n/);
    expect(dxf).toMatch(/\n52\n0\n/);
    expect(dxf).toMatch(/\n41\n5\n/);
    expect(dxf).toMatch(/\n78\n1\n/);
  });

  it('lines mode (Τέκτονας): HATCH → exploded LINEs (boundary + pattern), ΟΧΙ HATCH', () => {
    const dxf = writeDxfAscii([userHatch()], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).not.toContain('0\nHATCH\n');
    // 4 boundary edges + ≥1 γραμμή μοτίβου (y=5 εσωτερική).
    expect(countOccurrences(dxf, '0\nLINE\n')).toBeGreaterThanOrEqual(5);
  });

  it('dxfFaces έχει προτεραιότητα (ADR-505) — δεν σπάει το 3DFACE path', () => {
    const withFaces = {
      id: 'f', type: 'hatch', layerId: 'L', patternType: 'solid', boundaryPaths: [[]],
      dxfFaces: [[{ x: 0, y: 0, zMm: 0 }, { x: 1, y: 0, zMm: 0 }, { x: 1, y: 1, zMm: 0 }]],
    } as unknown as Entity;
    const dxf = writeDxfAscii([withFaces], { layersById: LAYERS });
    expect(dxf).toContain('0\n3DFACE\n');
    expect(dxf).not.toContain('0\nHATCH\n'); // faces → δεν εκπέμπει native HATCH
  });
});

// ADR-507 Φ2 — predefined PAT patterns (group 76/1 + N pattern definition lines).
describe('writeDxfAscii — predefined HATCH (ADR-507 Φ2)', () => {
  function predef(name: string, scale = 1, angle = 0): Entity {
    return {
      id: 'pd', type: 'hatch', layerId: 'L', fillType: 'predefined',
      patternName: name, patternScale: scale, patternAngle: angle, islandStyle: 'normal',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]],
    } as unknown as Entity;
  }

  it('ANSI31 (1 γραμμή, χωρίς dash) → 76/1, 78/1, 79/0', () => {
    const dxf = writeDxfAscii([predef('ANSI31')], { layersById: LAYERS });
    expect(dxf).toContain('0\nHATCH\n');
    expect(dxf).toMatch(/\n70\n0\n/);   // pattern fill
    expect(dxf).toMatch(/\n76\n1\n/);   // predefined
    expect(dxf).toMatch(/\n78\n1\n/);   // 1 pattern definition line
    expect(dxf).toMatch(/\n53\n45\n/);  // line angle 45°
    expect(dxf).toMatch(/\n79\n0\n/);   // χωρίς dashes
  });

  it('ANSI37 (2 γραμμές 45°+135°) → 78/2', () => {
    const dxf = writeDxfAscii([predef('ANSI37')], { layersById: LAYERS });
    expect(dxf).toMatch(/\n78\n2\n/);
    expect(dxf).toMatch(/\n53\n45\n/);
    expect(dxf).toMatch(/\n53\n135\n/);
  });

  it('ANSI33 (γραμμή με dashes) → 79/2 + group 49 dash lengths', () => {
    const dxf = writeDxfAscii([predef('ANSI33')], { layersById: LAYERS });
    expect(dxf).toMatch(/\n79\n2\n/); // 2η γραμμή έχει 2 dash τιμές
    expect(dxf).toContain('\n49\n'); // group 49 dash length εκπέμπεται
  });

  it('patternScale κλιμακώνει το group 41 (effective = suggested ANSI31 ×20 × user 5 = 100)', () => {
    const dxf = writeDxfAscii([predef('ANSI31', 5)], { layersById: LAYERS });
    expect(dxf).toMatch(/\n41\n100\n/);
  });

  it('patternAngle προστίθεται στο group 53 (γωνία γραμμής)', () => {
    const dxf = writeDxfAscii([predef('ANSI31', 1, 10)], { layersById: LAYERS });
    expect(dxf).toMatch(/\n53\n55\n/); // 45 + 10
  });

  it('lines mode (Τέκτονας): predefined → exploded LINEs, ΟΧΙ HATCH', () => {
    const dxf = writeDxfAscii([predef('ANSI31', 5)], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).not.toContain('0\nHATCH\n');
    // 4 boundary edges + πολλές γραμμές μοτίβου εντός 100×100.
    expect(countOccurrences(dxf, '0\nLINE\n')).toBeGreaterThan(4);
  });

  it('άγνωστο pattern → fallback 78/1 (έγκυρο hatch χωρίς crash)', () => {
    const dxf = writeDxfAscii([predef('NOPE')], { layersById: LAYERS });
    expect(dxf).toContain('0\nHATCH\n');
    expect(dxf).toMatch(/\n78\n1\n/);
  });
});

// ADR-362 Round 24 — dimensions are no longer dropped: native DIMENSION emission
// (group-code SSoT in utils/dxf-dimension-writer), scaled like every other entity.
describe('writeDxfAscii — native DIMENSION (ADR-362 Round 24)', () => {
  function linearDim(): Entity {
    return {
      id: 'd', type: 'dimension', dimensionType: 'linear', layerId: 'L',
      styleId: 'ISO-25',
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }],
      rotation: 0, measurementValue: 100,
    } as unknown as Entity;
  }
  function alignedDim(): Entity {
    return {
      id: 'd2', type: 'dimension', dimensionType: 'aligned', layerId: 'L',
      styleId: 'ISO-25',
      defPoints: [{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 15, y: 20 }],
      measurementValue: 50,
    } as unknown as Entity;
  }

  it('emits a native DIMENSION entity (no longer skipped)', () => {
    const dxf = writeDxfAscii([linearDim()], { layersById: LAYERS });
    expect(dxf).toContain('0\nDIMENSION\n');
    expect(dxf).toContain('100\nAcDbDimension\n');
    expect(dxf).toContain('100\nAcDbRotatedDimension\n');
    expect(dxf).toContain('70\n0\n');             // linear type flag
    expect(dxf).toContain('3\nISO-25\n');         // style name (code 3)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true); // envelope intact
  });

  it('def points are scaled like every other entity (mm→m ×0.001)', () => {
    const dxf = writeDxfAscii([linearDim()], { layersById: LAYERS, scale: 0.001 });
    // extOrigin2 (100,0) → (0.1, 0) on codes 14/24
    expect(dxf).toContain('14\n0.1\n24\n0\n');
    // measurement value (length) scales too: 100 × 0.001 = 0.1
    expect(dxf).toContain('42\n0.1\n');
  });

  it('sequential anonymous block names *D0/*D1 across the file', () => {
    const dxf = writeDxfAscii([linearDim(), alignedDim()], { layersById: LAYERS });
    expect(dxf).toContain('2\n*D0\n');
    expect(dxf).toContain('2\n*D1\n');
  });

  it('missing styleId → falls back to Standard', () => {
    const noStyle = { ...(linearDim() as object), styleId: undefined } as unknown as Entity;
    const dxf = writeDxfAscii([noStyle], { layersById: LAYERS });
    expect(dxf).toContain('3\nStandard\n');
  });

  it('dimension lands on the SAME resolved layer name as siblings (code 8)', () => {
    const dxf = writeDxfAscii([linearDim()], { layersById: LAYERS });
    expect(dxf).toContain('8\nCOLOR_10\n'); // resolved layer name, not the raw id 'L'
  });
});

// ADR-362 Round 25 — DIMSTYLE table: dimensions resolve to a real style (not STANDARD).
import { ISO_129_TEMPLATE } from '../../../systems/dimensions/dim-style-templates';

describe('writeDxfAscii — DIMSTYLE table (ADR-362 Round 25)', () => {
  const STYLE = ISO_129_TEMPLATE;
  function dimWithStyle(): Entity {
    return {
      id: 'd', type: 'dimension', dimensionType: 'linear', layerId: 'L',
      styleId: STYLE.id,
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }],
      rotation: 0, measurementValue: 100,
    } as unknown as Entity;
  }

  it('prepends a TABLES → DIMSTYLE section when dimStyles is provided', () => {
    const dxf = writeDxfAscii([dimWithStyle()], { layersById: LAYERS, dimStyles: [STYLE] });
    expect(dxf).toContain('0\nSECTION\n2\nTABLES\n');
    expect(dxf).toContain('0\nTABLE\n2\nDIMSTYLE\n');
    expect(dxf).toContain('0\nDIMSTYLE\n2\n' + STYLE.name + '\n'); // the style record
    // TABLES section comes BEFORE the ENTITIES section.
    expect(dxf.indexOf('2\nTABLES\n')).toBeLessThan(dxf.indexOf('2\nENTITIES\n'));
  });

  it('the DIMENSION references the real style name via code 3 (matches the table)', () => {
    const dxf = writeDxfAscii([dimWithStyle()], { layersById: LAYERS, dimStyles: [STYLE] });
    expect(dxf).toContain('3\n' + STYLE.name + '\n');
  });

  it('DIMSCALE (code 40) is multiplied by the coordinate scale', () => {
    const dxf = writeDxfAscii([dimWithStyle()], { layersById: LAYERS, dimStyles: [STYLE], scale: 2 });
    // code 40 appears in the DIMSTYLE record = dimscale × 2
    expect(dxf).toContain('40\n' + String(STYLE.dimscale * 2) + '\n');
  });

  it('NO dimStyles → bare envelope, no TABLES (Round 24 fallback preserved)', () => {
    const dxf = writeDxfAscii([dimWithStyle()], { layersById: LAYERS });
    expect(dxf).not.toContain('TABLES');
    expect(dxf).toContain('0\nDIMENSION\n'); // dimension still emitted (just STANDARD style)
  });
});

// ADR-362 Round 26 — anonymous dimension BLOCKS: each dimension's real drawn
// geometry (ext lines + dim line/arc + arrowheads + text) emitted as a *Dn block
// so dimensions display reliably without relying on the reader's DIMREGEN.
import { ASME_Y14_5_TEMPLATE } from '../../../systems/dimensions/dim-style-templates';

describe('writeDxfAscii — dimension BLOCKS section (ADR-362 Round 26)', () => {
  const STYLE = ISO_129_TEMPLATE;
  function linearDim(id: string, styleId = STYLE.id): Entity {
    return {
      id, type: 'dimension', dimensionType: 'linear', layerId: 'L', styleId,
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }],
      rotation: 0, measurementValue: 100,
    } as unknown as Entity;
  }

  it('emits a BLOCKS section between TABLES and ENTITIES when dimStyles is provided', () => {
    const dxf = writeDxfAscii([linearDim('d')], { layersById: LAYERS, dimStyles: [STYLE] });
    expect(dxf).toContain('0\nSECTION\n2\nBLOCKS\n');
    expect(dxf.indexOf('2\nTABLES\n')).toBeLessThan(dxf.indexOf('2\nBLOCKS\n'));
    expect(dxf.indexOf('2\nBLOCKS\n')).toBeLessThan(dxf.indexOf('2\nENTITIES\n'));
  });

  it('one BLOCK/ENDBLK per dimension, named to match the DIMENSION code-2 ref', () => {
    const dxf = writeDxfAscii([linearDim('d0'), linearDim('d1')], { layersById: LAYERS, dimStyles: [STYLE] });
    expect(countOccurrences(dxf, '0\nBLOCK\n')).toBe(2);
    expect(countOccurrences(dxf, '0\nENDBLK\n')).toBe(2);
    expect(dxf).toContain('2\n*D0\n'); // block header *D0 AND the DIMENSION entity ref
    expect(dxf).toContain('2\n*D1\n');
    expect(dxf).toContain('3\n*D0\n'); // block name (code 3) inside the BLOCK header
  });

  it('block carries real drawn geometry (LINEs for the oblique-tick ISO dim)', () => {
    const dxf = writeDxfAscii([linearDim('d')], { layersById: LAYERS, dimStyles: [STYLE] });
    const blocks = dxf.slice(dxf.indexOf('2\nBLOCKS\n'), dxf.indexOf('2\nENTITIES\n'));
    expect(countOccurrences(blocks, '0\nLINE\n')).toBeGreaterThanOrEqual(3); // ext+dim+arrows
    expect(blocks).toContain('0\nTEXT\n');
    expect(blocks).toContain('72\n1\n'); // dim text is centered (code 72=1)
  });

  it('solid arrowheads (ASME closedFilled) → 3DFACE inside the block', () => {
    const dxf = writeDxfAscii(
      [linearDim('d', ASME_Y14_5_TEMPLATE.id)],
      { layersById: LAYERS, dimStyles: [ASME_Y14_5_TEMPLATE] },
    );
    const blocks = dxf.slice(dxf.indexOf('2\nBLOCKS\n'), dxf.indexOf('2\nENTITIES\n'));
    expect(blocks).toContain('0\n3DFACE\n');
  });

  it('block geometry is coordinate-scaled like every entity (mm→m ×0.001)', () => {
    const dxf = writeDxfAscii([linearDim('d')], { layersById: LAYERS, dimStyles: [STYLE], scale: 0.001 });
    const blocks = dxf.slice(dxf.indexOf('2\nBLOCKS\n'), dxf.indexOf('2\nENTITIES\n'));
    // dim-line foot (100,20) → (0.1, 0.02): the dim line end lands on 11/21.
    expect(blocks).toContain('11\n0.1\n21\n0.02\n');
  });

  it('NO dimStyles → no BLOCKS section (Round 24/25 fallback preserved)', () => {
    const dxf = writeDxfAscii([linearDim('d')], { layersById: LAYERS });
    expect(dxf).not.toContain('2\nBLOCKS\n');
    expect(dxf).toContain('0\nDIMENSION\n');
  });

  it('unresolved style → DIMENSION stays but its block is skipped (no crash)', () => {
    const dxf = writeDxfAscii(
      [linearDim('d', 'UNKNOWN_STYLE')],
      { layersById: LAYERS, dimStyles: [STYLE] },
    );
    // BLOCKS section opens (other dims could resolve) but this dim contributes no block.
    expect(countOccurrences(dxf, '0\nBLOCK\n')).toBe(0);
    expect(dxf).toContain('0\nDIMENSION\n');
  });
});
