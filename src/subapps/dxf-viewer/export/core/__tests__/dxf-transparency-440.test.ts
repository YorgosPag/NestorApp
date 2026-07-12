/**
 * DXF group 440 transparency codec + generic entity roundtrip — ADR-507.
 *
 * (1) `encodeDxf440`/`decodeDxf440` = ακριβώς αντίστροφα, με gating (opaque/undefined
 *     → κανένας κωδικός· ByLayer/ByBlock χωρίς BYALPHA → undefined).
 * (2) Το generic `emitEntityStyle` γράφει 440 για non-hatch (LINE) και ο
 *     `extractEntityTransparency` το διαβάζει — ώστε ΟΛΕΣ οι οντότητες κάνουν roundtrip.
 */

import { describe, it, expect } from '@jest/globals';
import { encodeDxf440, decodeDxf440, TRANSPARENCY_MAX } from '../dxf-transparency-440';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { extractEntityTransparency } from '../../../utils/dxf-entity-style-extract';
import type { Entity } from '../../../types/entities';

describe('DXF 440 codec — encode/decode', () => {
  it('undefined / opaque (0) → undefined (κανένας κωδικός)', () => {
    expect(encodeDxf440(undefined)).toBeUndefined();
    expect(encodeDxf440(0)).toBeUndefined();
    expect(encodeDxf440(NaN)).toBeUndefined();
  });

  it('roundtrip για κάθε ακέραιο 1..90 → ταυτίζεται', () => {
    for (let pct = 1; pct <= TRANSPARENCY_MAX; pct += 1) {
      const raw = encodeDxf440(pct);
      expect(raw).toBeDefined();
      expect(decodeDxf440(raw!)).toBe(pct);
    }
  });

  it('encode θέτει το BYALPHA flag (0x02000000)', () => {
    expect((encodeDxf440(50)! & 0x02000000) !== 0).toBe(true);
  });

  it('πάνω από 90 → clamp στο 90', () => {
    expect(decodeDxf440(encodeDxf440(150)!)).toBe(TRANSPARENCY_MAX);
  });

  it('decode χωρίς BYALPHA flag (ByLayer/ByBlock) → undefined', () => {
    // 0x01000000 = by block· καθαρό alpha χωρίς flag = κληρονομείται.
    expect(decodeDxf440(0x01000000 | 128)).toBeUndefined();
    expect(decodeDxf440(128)).toBeUndefined();
  });
});

describe('generic entity transparency (DXF 440) — LINE roundtrip', () => {
  const LAYERS = { L: { name: 'L0' } };

  function lineCodes(dxf: string): Record<string, string> {
    const tokens = dxf.split('\n');
    let start = -1;
    for (let i = 0; i < tokens.length - 1; i += 2) {
      if (tokens[i] === '0' && tokens[i + 1] === 'LINE') { start = i + 2; break; }
    }
    const rec: Record<string, string> = {};
    if (start < 0) return rec;
    for (let i = start; i < tokens.length - 1; i += 2) {
      if (tokens[i] === '0') break;
      rec[tokens[i]] = tokens[i + 1];
    }
    return rec;
  }

  const line = (over: Record<string, unknown> = {}): Entity => ({
    id: 'l', type: 'line', layerId: 'L',
    start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, ...over,
  } as unknown as Entity);

  it('LINE με transparency 30 → group 440 + διαβάζεται πίσω ως 30', () => {
    const rec = lineCodes(writeDxfAscii([line({ transparency: 30 })], { layersById: LAYERS }));
    expect(rec['440']).toBeDefined();
    expect(extractEntityTransparency(rec)).toBe(30);
  });

  it('LINE αδιαφανής → κανένας κωδικός 440', () => {
    const rec = lineCodes(writeDxfAscii([line()], { layersById: LAYERS }));
    expect(rec['440']).toBeUndefined();
  });
});
