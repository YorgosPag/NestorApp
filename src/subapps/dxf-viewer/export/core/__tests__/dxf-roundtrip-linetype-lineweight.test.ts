/**
 * DXF linetype / lineweight / CELTSCALE Roundtrip — ADR-636 Φ2.4 (D.6).
 *
 * Αποδεικνύει ότι οι common STYLE group codes που γράφει ο writer (6 linetype name /
 * 48 CELTSCALE / 370 lineweight) είναι το ΑΚΡΙΒΕΣ inverse των import extractors
 * (`extractEntityLinetype` / `extractEntityLtscale` / `extractEntityLineweight`) — round-trip
 * της C.3/C.4 import. Καλύπτει: single-header (LINE/CIRCLE), POLYLINE header placement,
 * gating (absent / ByLayer sentinel / trivial ltscale=1) και το Tekton `explode` bare output.
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import {
  extractEntityLinetype,
  extractEntityLtscale,
  extractEntityLineweight,
} from '../../../utils/dxf-converter-helpers';
import type { Entity } from '../../../types/entities';

const LAYERS = { L: { name: 'STY' } };

function line(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'ln', type: 'line', layerId: 'L',
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, ...over,
  } as unknown as Entity;
}

function circle(over: Record<string, unknown> = {}): Entity {
  return { id: 'c', type: 'circle', layerId: 'L', center: { x: 0, y: 0 }, radius: 5, ...over } as unknown as Entity;
}

function polyline(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'pl', type: 'polyline', layerId: 'L',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: false, ...over,
  } as unknown as Entity;
}

/** Extract the first `<TYPE>` block from writer output as a flat `data` Record (header codes only). */
function extractEntity(dxf: string, type: string): Record<string, string> | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === type) { start = i + 2; break; }
  }
  if (start < 0) return null;
  const data: Record<string, string> = {};
  for (let i = start; i < t.length - 1; i += 2) {
    if (t[i] === '0') break; // stop at the next entity / sub-entity marker
    data[t[i]] = t[i + 1];
  }
  return data;
}

const STYLE = { linetypeName: 'DASHED', lineweightMm: 0.25, ltscale: 2 };

describe('writeDxfAscii — STYLE codes 6/48/370 (D.6)', () => {
  it('LINE: γράφει 6/48/370 και round-trip ανακτά ίδιες τιμές', () => {
    const data = extractEntity(writeDxfAscii([line(STYLE)], { layersById: LAYERS, acadVer: 'AC1027' }), 'LINE')!;
    expect(data['6']).toBe('DASHED');
    expect(data['370']).toBe('25'); // 0.25mm → hundredths
    expect(data['48']).toBe('2');
    // reverse symmetry — τα ΙΔΙΑ import extractors ανακτούν τις αρχικές τιμές
    expect(extractEntityLinetype(data)).toBe('DASHED');
    expect(extractEntityLineweight(data)).toBe(0.25);
    expect(extractEntityLtscale(data)).toBe(2);
  });

  it('CIRCLE: γράφει 370 (lineweight) round-trip', () => {
    const data = extractEntity(writeDxfAscii([circle({ lineweightMm: 0.5 })], { layersById: LAYERS }), 'CIRCLE')!;
    expect(data['370']).toBe('50');
    expect(extractEntityLineweight(data)).toBe(0.5);
  });

  it('POLYLINE: STYLE codes ζουν στο header (ΠΡΙΝ τα VERTEX)', () => {
    const dxf = writeDxfAscii([polyline(STYLE)], { layersById: LAYERS });
    const data = extractEntity(dxf, 'POLYLINE')!;
    expect(data['6']).toBe('DASHED');
    expect(data['370']).toBe('25');
    expect(data['48']).toBe('2');
    // το 6 πρέπει να εμφανίζεται ΠΡΙΝ το πρώτο VERTEX
    expect(dxf.indexOf('\n6\nDASHED\n')).toBeLessThan(dxf.indexOf('0\nVERTEX'));
  });
});

describe('writeDxfAscii — STYLE gating (D.6, zero regression)', () => {
  it('χωρίς STYLE fields → κανένα 6/48/370 (bare, byte-identical legacy)', () => {
    const data = extractEntity(writeDxfAscii([line()], { layersById: LAYERS }), 'LINE')!;
    expect(data['6']).toBeUndefined();
    expect(data['48']).toBeUndefined();
    expect(data['370']).toBeUndefined();
  });

  it('lineweightMm ByLayer sentinel (-2) → ΔΕΝ γράφεται (concrete-only, inverse του import)', () => {
    const data = extractEntity(writeDxfAscii([line({ lineweightMm: -2 })], { layersById: LAYERS }), 'LINE')!;
    expect(data['370']).toBeUndefined();
  });

  it('ltscale trivial 1 → ΔΕΝ γράφεται (mirror import guard value===1)', () => {
    const data = extractEntity(writeDxfAscii([line({ ltscale: 1 })], { layersById: LAYERS }), 'LINE')!;
    expect(data['48']).toBeUndefined();
  });

  it('Tekton explode mode → LINE μένει bare (χωρίς STYLE codes)', () => {
    const data = extractEntity(writeDxfAscii([line(STYLE)], { layersById: LAYERS, lineMode: 'lines' }), 'LINE')!;
    expect(data['6']).toBeUndefined();
    expect(data['370']).toBeUndefined();
    expect(data['48']).toBeUndefined();
  });

  it('POLYLINE explode → exploded LINEs χωρίς STYLE codes', () => {
    const dxf = writeDxfAscii([polyline(STYLE)], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).not.toContain('\n6\nDASHED\n');
    expect(dxf).not.toContain('POLYLINE');
  });
});
