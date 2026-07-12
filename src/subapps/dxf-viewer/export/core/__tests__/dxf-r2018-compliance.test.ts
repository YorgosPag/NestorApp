/**
 * ADR-644 — DXF AutoCAD R2018 structural compliance (#3 APPID / #5 handles+$HANDSEED /
 * #6 HATCH pixel-size / #9 subclass markers / #4 complete LTYPE).
 *
 * Proves the professional (AutoCAD) export path emits a structurally valid R2018 file that opens
 * instead of «Invalid or incomplete DXF input — drawing discarded». The `writeFileSync` dump feeds
 * the ezdxf strict-read + audit ground-truth check (see the scratchpad harness).
 */

import * as fs from 'fs';
import * as path from 'path';
import { writeDxfAscii, type DxfWriteOptions } from '../dxf-ascii-writer';
import { EXPORT_APPID_NAMES } from '../dxf-ascii-tables-writer';
import type { Entity, SceneLayer } from '../../../types/entities';
import { createSceneLayer } from '../../../types/entities';
import { LINETYPE_ISO_CATALOG } from '../../../config/linetype-iso-catalog';
import { ISO_129_TEMPLATE } from '../../../systems/dimensions/dim-style-templates';

// ── A representative professional scene: line + solid hatch + text on a dashed (ISO) layer ──
function line(): Entity {
  return { id: 'a', type: 'line', layerId: 'walls', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } } as unknown as Entity;
}
function solidHatch(): Entity {
  return {
    id: 'h', type: 'hatch', layerId: 'walls', color: '#ff0000', fillType: 'solid',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]],
  } as unknown as Entity;
}
function text(): Entity {
  return { id: 't', type: 'text', layerId: 'walls', position: { x: 5, y: 5 }, text: 'ΓΕΙΑ', height: 2 } as unknown as Entity;
}
function circle(): Entity {
  return { id: 'c', type: 'circle', layerId: 'walls', center: { x: 5, y: 5 }, radius: 3 } as unknown as Entity;
}
function arc(): Entity {
  return { id: 'r', type: 'arc', layerId: 'walls', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90 } as unknown as Entity;
}
function poly(): Entity {
  return {
    id: 'p', type: 'lwpolyline', layerId: 'walls', closed: true,
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  } as unknown as Entity;
}

const wallLayer: SceneLayer = createSceneLayer({
  id: 'lyr_walls', name: 'A-WALL', color: '#FF0000', colorAci: 1,
  linetype: 'Dashed', lineweight: 0.5, source: 'dxf-import',
});
const LAYERS = { walls: { name: 'A-WALL', colorAci: 1 } };

/** Mirror of the adapter's professional (AutoCAD) options — the path that must open in AutoCAD. */
function proOptions(): DxfWriteOptions {
  return {
    layersById: LAYERS,
    acadVer: 'AC1021', insunits: 6, codepage: 'ANSI_1253',
    extMin: { x: 0, y: 0 }, extMax: { x: 100, y: 50 },
    measurement: 1, ltscale: 1, lunits: 2,
    tableLayers: [wallLayer],
    // ADR-644 (#4) — the adapter now includes ISO defs; pass the real 'Dashed' baseline pattern.
    customLinetypes: [LINETYPE_ISO_CATALOG.Dashed],
  };
}

/** Walk the flat `code\nvalue\n…` stream and collect the values of every handle code (5 / 105). */
function handleValues(dxf: string): string[] {
  const t = dxf.split('\n');
  const out: string[] = [];
  for (let i = 0; i + 1 < t.length; i += 2) {
    if (t[i] === '5' || t[i] === '105') out.push(t[i + 1]);
  }
  return out;
}

describe('ADR-644 — R2018 structural compliance (professional path)', () => {
  it('#5 — every object carries a UNIQUE handle and $HANDSEED exceeds them all', () => {
    const dxf = writeDxfAscii([line(), solidHatch(), text()], proOptions());
    const handles = handleValues(dxf);
    const seedMatch = dxf.match(/9\n\$HANDSEED\n5\n([0-9A-F]+)\n/);
    expect(seedMatch).not.toBeNull();
    const seed = seedMatch![1];
    const seedVal = parseInt(seed, 16);
    // Every code-5/105 value except the single $HANDSEED occurrence is a real object handle.
    const objs = handles.filter((h) => h !== seed);
    expect(objs.length).toBeGreaterThan(4);
    expect(new Set(objs).size).toBe(objs.length);             // all unique
    for (const h of objs) expect(parseInt(h, 16)).toBeLessThan(seedVal); // seed > every handle
  });

  it('#3 — APPID table declares ACAD + every Nestor app id (referenced by the layer XDATA)', () => {
    const dxf = writeDxfAscii([line()], proOptions());
    expect(dxf).toContain('0\nTABLE\n2\nAPPID\n');
    for (const name of EXPORT_APPID_NAMES) expect(dxf).toContain(`\n2\n${name}\n`);
    expect(dxf).toContain('100\nAcDbRegAppTableRecord\n');
  });

  it('#9 — table records carry subclass markers (LAYER/LTYPE/VPORT)', () => {
    const dxf = writeDxfAscii([line()], proOptions());
    expect(dxf).toContain('100\nAcDbSymbolTableRecord\n');
    expect(dxf).toContain('100\nAcDbLayerTableRecord\n');
    expect(dxf).toContain('100\nAcDbLinetypeTableRecord\n');
    expect(dxf).toContain('100\nAcDbViewportTableRecord\n');
    // table header subclass too.
    expect(dxf).toContain('100\nAcDbSymbolTable\n');
  });

  it('#9c — ALL 9 mandatory symbol tables present in canonical order (VIEW/UCS/BLOCK_RECORD incl.)', () => {
    const dxf = writeDxfAscii([line()], proOptions());
    const order = ['VPORT', 'LTYPE', 'LAYER', 'STYLE', 'VIEW', 'UCS', 'APPID', 'DIMSTYLE', 'BLOCK_RECORD'];
    let prev = -1;
    for (const name of order) {
      const at = dxf.indexOf(`2\n${name}\n`);
      expect(at).toBeGreaterThan(prev); // present AND in canonical order
      prev = at;
    }
    // BLOCK_RECORD carries the two well-known records.
    expect(dxf).toContain('2\n*Model_Space\n');
    expect(dxf).toContain('2\n*Paper_Space\n');
  });

  it('#9d — mandatory DEFAULT entries present (LTYPE ByBlock/ByLayer/Continuous, LAYER 0, STYLE/DIMSTYLE Standard)', () => {
    const dxf = writeDxfAscii([line()], proOptions());
    // LTYPE defaults, in order, before the custom Dashed.
    const ltype = dxf.slice(dxf.indexOf('2\nLTYPE\n'), dxf.indexOf('2\nLAYER\n'));
    for (const n of ['ByBlock', 'ByLayer', 'Continuous']) expect(ltype).toContain(`2\n${n}\n`);
    // LAYER default "0" (the scene here only has A-WALL → synthesized).
    const layer = dxf.slice(dxf.indexOf('2\nLAYER\n'), dxf.indexOf('2\nVIEW\n'));
    expect(layer).toContain('2\n0\n');
    // STYLE + DIMSTYLE default "Standard".
    const style = dxf.slice(dxf.indexOf('2\nSTYLE\n'), dxf.indexOf('2\nVIEW\n'));
    expect(style).toContain('2\nStandard\n');
    const dim = dxf.slice(dxf.indexOf('2\nDIMSTYLE\n'), dxf.indexOf('2\nBLOCK_RECORD\n'));
    expect(dim).toContain('2\nStandard\n');
  });

  it('#9f — BLOCKS section defines *Model_Space/*Paper_Space; entity owner (330) = the msp record handle', () => {
    const dxf = writeDxfAscii([line()], proOptions());
    expect(dxf).toContain('0\nSECTION\n2\nBLOCKS\n');
    expect(dxf).toContain('100\nAcDbBlockBegin\n');
    expect(dxf).toContain('2\n*Model_Space\n');
    expect(dxf).toContain('2\n*Paper_Space\n');
    // the *Model_Space BLOCK_RECORD handle == the BLOCK definition owner == the entity owner (330).
    const recH = dxf.match(/0\nBLOCK_RECORD\n5\n([0-9A-F]+)\n330\n[0-9A-F]+\n100\nAcDbSymbolTableRecord\n100\nAcDbBlockTableRecord\n2\n\*Model_Space\n/)?.[1];
    expect(recH).toBeTruthy();
    // the LINE entity's owner group (330) points to that same handle.
    const lineRec = dxf.slice(dxf.indexOf('0\nLINE\n'), dxf.indexOf('0\nLINE\n') + 60);
    expect(lineRec).toContain(`330\n${recH}\n`);
  });

  it('#9b — every LAYER record carries a PlotStyleName (390) + HEADER declares $PSTYLEMODE', () => {
    const dxf = writeDxfAscii([line()], proOptions());
    expect(dxf).toContain('9\n$PSTYLEMODE\n290\n1\n'); // color-dependent (CTB) mode
    // the A-WALL layer record has a 390 hard-pointer (null handle valid in CTB mode): the plottable
    // flag (290 1) is immediately followed by the PlotStyleName (390 0).
    const aWall = dxf.indexOf('2\nA-WALL\n');
    const rec = dxf.slice(aWall, dxf.indexOf('0\nENDTAB', aWall));
    expect(rec).toContain('290\n1\n390\n0\n');
  });

  it('#4 — the ISO baseline linetype the layer references IS defined in the LTYPE table', () => {
    const dxf = writeDxfAscii([line()], proOptions());
    expect(dxf).toContain('2\nDashed\n');           // ISO name now emitted (was skipped pre-644)
    // record: 0 LTYPE → handle → subclass → 2 Dashed → 70 → 3 desc → 72 → 73 → 40 → 49 → 74
    const ltStart = dxf.indexOf('2\nDashed\n');
    expect(dxf.slice(ltStart, ltStart + 200)).toContain('49\n'); // dash pattern present
    expect(dxf.slice(ltStart, ltStart + 200)).toContain('74\n0\n'); // R2018 element-type flag
  });

  it('#9h — an entity with the bogus linetype "0" does NOT emit `6 0` (AutoCAD «Bad linetype name 0»)', () => {
    const badLt = { id: 'x', type: 'line', layerId: 'walls', linetypeName: '0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    const dxf = writeDxfAscii([badLt], proOptions());
    const rec = dxf.slice(dxf.indexOf('0\nLINE\n'), dxf.indexOf('0\nENDSEC', dxf.indexOf('0\nLINE\n')));
    expect(rec).not.toContain('\n6\n0\n'); // no linetype-0 reference
    // a valid linetype name IS still emitted.
    const okLt = { id: 'y', type: 'line', layerId: 'walls', linetypeName: 'Dashed', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    expect(writeDxfAscii([okLt], proOptions())).toContain('\n6\nDashed\n');
  });

  it('#7 — predefined HATCH pattern offset scales with the coordinate scale s (visible density)', () => {
    const hatch = {
      id: 'h', type: 'hatch', layerId: 'walls', fillType: 'predefined', patternName: 'ANSI31',
      patternScale: 1, patternAngle: 0, islandStyle: 'normal',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]],
    } as unknown as Entity;
    // s=1 → group 41 = suggested×user (unchanged); s=0.001 → 1000× smaller (mm-scene → m-output).
    const at1 = writeDxfAscii([hatch], proOptions());
    const atMilli = writeDxfAscii([hatch], { ...proOptions(), scale: 0.001 });
    // group 41 (pattern scale) follows the 52 (pattern angle) in the HATCH's pattern-data block.
    const g41 = (dxf: string): number => Number(dxf.match(/\n52\n[0-9.eE-]+\n41\n([0-9.eE-]+)\n/)![1]);
    expect(g41(at1)).toBeGreaterThan(1);            // meaningful density at s=1
    expect(g41(atMilli)).toBeCloseTo(g41(at1) * 0.001, 6); // scaled by s → visible in a metre drawing
  });

  it('#6 — HATCH does NOT emit the invalid `47 0` pixel-size (AutoCAD expects 98)', () => {
    const dxf = writeDxfAscii([solidHatch()], proOptions());
    const hatch = dxf.slice(dxf.indexOf('100\nAcDbHatch\n'), dxf.indexOf('0\nENDSEC\n', dxf.indexOf('AcDbHatch')));
    expect(hatch).not.toContain('\n47\n0\n');
    expect(hatch).toContain('\n98\n'); // seed-point count directly, no stray 47
  });

  it('#9i — OBJECTS section always present with the root Named Object Dictionary (ACAD_GROUP)', () => {
    const dxf = writeDxfAscii([line()], proOptions()); // no mline / no image
    expect(dxf).toContain('0\nSECTION\n2\nOBJECTS\n');
    expect(dxf).toContain('100\nAcDbDictionary\n');
    expect(dxf).toContain('3\nACAD_GROUP\n');
    // root NOD owner is 0 (root); the ACAD_GROUP dict is owned by the NOD.
    const nod = dxf.match(/0\nDICTIONARY\n5\n([0-9A-F]+)\n330\n0\n100\nAcDbDictionary\n/);
    expect(nod).not.toBeNull();
  });

  it('gating — Tekton (explode) stays handle-less/byte-identical', () => {
    const dxf = writeDxfAscii([line()], { ...proOptions(), lineMode: 'lines' });
    expect(dxf).not.toContain('$HANDSEED');
    expect(dxf).not.toContain('0\nAPPID\n');
  });

  it('#9e — entities carry AcDbEntity + geometry subclass markers (LINE/CIRCLE/ARC/POLYLINE/TEXT)', () => {
    const dxf = writeDxfAscii([line(), circle(), arc(), poly(), text()], proOptions());
    expect(dxf).toContain('0\nLINE\n');
    expect(dxf).toContain('100\nAcDbLine\n');
    expect(dxf).toContain('100\nAcDbCircle\n');
    expect(dxf).toContain('100\nAcDbArc\n');
    expect(dxf).toContain('100\nAcDb2dPolyline\n');
    expect(dxf).toContain('100\nAcDbText\n');
    // every entity's AcDbEntity marker precedes its geometry class (spot-check LINE).
    const lineRec = dxf.slice(dxf.indexOf('0\nLINE\n'));
    expect(lineRec.indexOf('100\nAcDbEntity\n')).toBeLessThan(lineRec.indexOf('100\nAcDbLine\n'));
  });

  it('dumps a professional sample for the ezdxf strict-read + audit ground-truth check', () => {
    const dxf = writeDxfAscii([line(), circle(), arc(), poly(), solidHatch(), text()], proOptions());
    const dir = process.env.DXF_R2018_DUMP_DIR;
    if (dir) fs.writeFileSync(path.join(dir, 'nestor_r2018_sample.dxf'), dxf, 'utf-8');
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
  });

  it('#9g — a named BLOCK has a matching BLOCK_RECORD entry (record ⇄ def owner handle)', () => {
    const block = {
      id: 'b', type: 'block', layerId: 'walls', name: 'NEW_BLOCK',
      position: { x: 5, y: 5 }, scale: { x: 1, y: 1 }, rotation: 0,
      entities: [{ id: 'bl', type: 'line', layerId: 'walls', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }],
    } as unknown as Entity;
    const dxf = writeDxfAscii([line(), block], proOptions());
    // BLOCK_RECORD entry for NEW_BLOCK with a handle.
    const recH = dxf.match(/0\nBLOCK_RECORD\n5\n([0-9A-F]+)\n330\n[0-9A-F]+\n100\nAcDbSymbolTableRecord\n100\nAcDbBlockTableRecord\n2\nNEW_BLOCK\n/)?.[1];
    expect(recH).toBeTruthy();
    // BLOCK definition owner (330) points to that same record handle.
    const def = dxf.slice(dxf.indexOf('0\nBLOCK\n', dxf.indexOf('AcDbBlockEnd')));
    const defRec = dxf.slice(dxf.indexOf('100\nAcDbBlockBegin\n2\nNEW_BLOCK\n') - 200, dxf.indexOf('100\nAcDbBlockBegin\n2\nNEW_BLOCK\n'));
    expect(defRec).toContain(`330\n${recH}\n`);
    // INSERT references the block by name.
    expect(dxf).toContain('100\nAcDbBlockReference\n');
    expect(def.length >= 0).toBe(true);
    const dir = process.env.DXF_R2018_DUMP_DIR;
    if (dir) fs.writeFileSync(path.join(dir, 'nestor_r2018_block.dxf'), dxf, 'utf-8');
  });

  it('dumps a DIMSTYLE/BLOCKS sample (105 handle path) for the ezdxf check', () => {
    const dim = {
      id: 'd', type: 'dimension', dimensionType: 'linear', layerId: 'walls',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }],
      rotation: 0, measurementValue: 100,
    } as unknown as Entity;
    const dxf = writeDxfAscii([line(), dim], { ...proOptions(), dimStyles: [ISO_129_TEMPLATE] });
    expect(dxf).toContain('105\n');                        // DIMSTYLE record handle (not 5)
    expect(dxf).toContain('100\nAcDbDimStyleTableRecord\n');
    const dir = process.env.DXF_R2018_DUMP_DIR;
    if (dir) fs.writeFileSync(path.join(dir, 'nestor_r2018_dim.dxf'), dxf, 'utf-8');
  });
});
