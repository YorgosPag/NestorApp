/** ADR-644 — stress/regression: mimic Giorgio's «Ισόγειο» export (many blocks/inserts/hatches) to
 *  catch a hang or throw in the professional writer. NOT a fixture test — a smoke run under a timeout. */

import { writeDxfAscii, type DxfWriteOptions } from '../dxf-ascii-writer';
import type { Entity, SceneLayer } from '../../../types/entities';
import { createSceneLayer } from '../../../types/entities';
import { LINETYPE_ISO_CATALOG } from '../../../config/linetype-iso-catalog';

const wallLayer: SceneLayer = createSceneLayer({
  id: 'lyr_walls', name: 'A-WALL', color: '#FF0000', colorAci: 1, linetype: 'Dashed', source: 'dxf-import',
});
const LAYERS = { walls: { name: 'A-WALL', colorAci: 1 } };

function proOptions(): DxfWriteOptions {
  return {
    layersById: LAYERS, acadVer: 'AC1021', insunits: 6, codepage: 'ANSI_1253',
    extMin: { x: 0, y: 0 }, extMax: { x: 1000, y: 1000 }, measurement: 1, ltscale: 1, lunits: 2,
    tableLayers: [wallLayer], customLinetypes: [LINETYPE_ISO_CATALOG.Dashed],
  };
}

function buildGiorgioLikeScene(): Entity[] {
  const es: Entity[] = [];
  for (let i = 0; i < 960; i++) es.push({ id: `l${i}`, type: 'line', layerId: 'walls', start: { x: i, y: 0 }, end: { x: i, y: 10 } } as unknown as Entity);
  for (let i = 0; i < 480; i++) es.push({ id: `p${i}`, type: 'lwpolyline', layerId: 'walls', closed: true, vertices: [{ x: i, y: 0 }, { x: i + 5, y: 0 }, { x: i + 5, y: 5 }, { x: i, y: 5 }, { x: i, y: 2 }] } as unknown as Entity);
  for (let i = 0; i < 468; i++) es.push({ id: `t${i}`, type: 'text', layerId: 'walls', position: { x: i, y: i }, text: `ΚΕΙΜΕΝΟ ${i}`, height: 2 } as unknown as Entity);
  for (let i = 0; i < 64; i++) es.push({ id: `c${i}`, type: 'circle', layerId: 'walls', center: { x: i, y: i }, radius: 3 } as unknown as Entity);
  for (let i = 0; i < 25; i++) es.push({ id: `a${i}`, type: 'arc', layerId: 'walls', center: { x: i, y: i }, radius: 10, startAngle: 0, endAngle: 90 } as unknown as Entity);
  for (let i = 0; i < 116; i++) es.push({ id: `h${i}`, type: 'hatch', layerId: 'walls', fillType: 'solid', boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]] } as unknown as Entity);
  // 96 INSERTs over 10 distinct block names (mirror of Giorgio's «NEW_BLOCK» variations).
  const names = ['NEW_BNBBNLOCK', 'NNBNBW_BLOCK', 'NEW_BLOCKBBNB', 'NEWAQ1_BLOCK', 'NEW00O_BLOCK', 'NEW_SSSCLOCK', 'NEKKKW_BLOCK', 'NK1EW_BLOCK', 'NC1EW_BLOCK', 'NEC32_BLOCK'];
  for (let i = 0; i < 96; i++) {
    es.push({
      id: `b${i}`, type: 'block', layerId: 'walls', name: names[i % names.length],
      position: { x: i, y: i }, scale: { x: 1, y: 1 }, rotation: 0,
      entities: [{ id: `bm${i}`, type: 'line', layerId: 'walls', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }],
    } as unknown as Entity);
  }
  return es;
}

describe('ADR-644 — professional writer stress (Giorgio-like scene)', () => {
  it('serializes a large multi-block scene WITHOUT hanging or throwing', () => {
    const scene = buildGiorgioLikeScene();
    const t0 = Date.now();
    const dxf = writeDxfAscii(scene, proOptions());
    const ms = Date.now() - t0;
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    expect(dxf).toContain('2\nNEW_BNBBNLOCK\n');
    // eslint-disable-next-line no-console
    console.log(`stress: ${scene.length} entities → ${dxf.length} chars in ${ms}ms`);
    expect(ms).toBeLessThan(15000);
  }, 20000);
});
