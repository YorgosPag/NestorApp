/**
 * DXF POINT Roundtrip — ADR-636 Φ2.4 (D.1).
 *
 * Αποδεικνύει ότι `writeDxfAscii([point]) → convertPoint()` επιβιώνει (10/20/30 + 8 + 62)
 * — round-trip της C.1 import — και ότι το drawing-wide glyph ($PDMODE/$PDSIZE) γράφεται στο
 * HEADER (όχι per-POINT). Ο adapter `resolvePointDisplayForExport` παράγει τα header sysvars
 * από τα scene points (pre-scale $PDSIZE>0, viewport-% ≤0 raw).
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { resolvePointDisplayForExport } from '../../formats/dxf-export-adapter';
import { convertPoint } from '../../../utils/dxf-point-converter';
import type { Entity } from '../../../types/entities';

const LAYERS = { L: { name: 'PTS' } };

function point(over: Record<string, unknown> = {}): Entity {
  return { id: 'pt', type: 'point', layerId: 'L', position: { x: 10, y: 20 }, ...over } as unknown as Entity;
}

/** Extract the first POINT block from writer output as a flat `data` Record (no repeated codes). */
function extractPoint(dxf: string): { data: Record<string, string>; layer: string } | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === 'POINT') { start = i + 2; break; }
  }
  if (start < 0) return null;
  const data: Record<string, string> = {};
  let layer = '0';
  for (let i = start; i < t.length - 1; i += 2) {
    const code = t[i];
    const value = t[i + 1];
    if (code === '0') break;
    if (code === '8') layer = value;
    data[code] = value;
  }
  return { data, layer };
}

describe('writeDxfAscii — POINT entity (D.1)', () => {
  it('εκπέμπει POINT με 10/20/30 + 8 + 62 (bare envelope)', () => {
    const dxf = writeDxfAscii([point()], { layersById: LAYERS });
    const ext = extractPoint(dxf);
    expect(ext).not.toBeNull();
    expect(ext!.data['10']).toBe('10');
    expect(ext!.data['20']).toBe('20');
    expect(ext!.data['30']).toBe('0');
    expect(ext!.layer).toBe('PTS');
    expect(ext!.data['62']).toBeDefined();
  });

  it('κλιμακώνει τη θέση με το coordinate scale', () => {
    const ext = extractPoint(writeDxfAscii([point()], { layersById: LAYERS, scale: 2 }));
    expect(ext!.data['10']).toBe('20');
    expect(ext!.data['20']).toBe('40');
  });

  it('round-trip: writeDxfAscii → convertPoint ανακτά τη θέση', () => {
    const ext = extractPoint(writeDxfAscii([point()], { layersById: LAYERS }))!;
    const e = convertPoint(ext.data, ext.layer, 0) as unknown as { type: string; position: { x: number; y: number } };
    expect(e.type).toBe('point');
    expect(e.position).toEqual({ x: 10, y: 20 });
  });
});

describe('writeDxfAscii — $PDMODE/$PDSIZE στο HEADER (D.1)', () => {
  it('γράφει $PDMODE (70) + $PDSIZE (40) όταν δοθούν, ΠΡΙΝ τα ENTITIES', () => {
    const dxf = writeDxfAscii([point()], { layersById: LAYERS, pdmode: 35, pdsize: 2.5 });
    expect(dxf).toContain('9\n$PDMODE\n70\n35\n');
    expect(dxf).toContain('9\n$PDSIZE\n40\n2.5\n');
    expect(dxf.indexOf('2\nHEADER')).toBeLessThan(dxf.indexOf('2\nENTITIES'));
  });

  it('χωρίς pdmode/pdsize → παραμένει bare (zero regression)', () => {
    const dxf = writeDxfAscii([point()], { layersById: LAYERS });
    expect(dxf).not.toContain('$PDMODE');
    expect(dxf).not.toContain('$PDSIZE');
    expect(dxf.startsWith('0\nSECTION\n2\nENTITIES\n')).toBe(true);
  });
});

describe('resolvePointDisplayForExport — adapter derivation (D.1)', () => {
  it('διαβάζει pdMode/pdSize από το πρώτο point, pre-scale το $PDSIZE>0', () => {
    expect(resolvePointDisplayForExport([point({ pdMode: 35, pdSize: 3 })], 2)).toEqual({ pdmode: 35, pdsize: 6 });
  });

  it('$PDSIZE ≤ 0 (viewport-%) περνά raw (χωρίς scale)', () => {
    expect(resolvePointDisplayForExport([point({ pdSize: -5 })], 2)).toEqual({ pdsize: -5 });
  });

  it('pdMode 0 (dot) διατηρείται (δεν συγχέεται με absent)', () => {
    expect(resolvePointDisplayForExport([point({ pdMode: 0 })], 1)).toEqual({ pdmode: 0 });
  });

  it('κανένα point / χωρίς baked values → {}', () => {
    expect(resolvePointDisplayForExport([point()], 2)).toEqual({});
    expect(resolvePointDisplayForExport([], 2)).toEqual({});
    const lineEntity = { id: 'l', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    expect(resolvePointDisplayForExport([lineEntity], 2)).toEqual({});
  });
});
