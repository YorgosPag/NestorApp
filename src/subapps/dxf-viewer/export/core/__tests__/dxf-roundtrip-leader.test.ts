/**
 * DXF LEADER Roundtrip — ADR-636 Φ2.4 (D.2) / ADR-635 Batch 2-B parity.
 *
 * Αποδεικνύει ότι `writeDxfAscii([leader]) → convertLeader()` επιβιώνει: τα 10/20 μένουν
 * καθαρά ordered vertices (arrow tip = vertices[0]), το 71 arrowhead flag ανακτά το
 * `arrowHead.type` (closed↔none), το 62 το χρώμα — round-trip της C.x import. Οι AutoCAD-faithful
 * defaults (3='Standard' / 72 / 73 / 76) γράφονται για fidelity ΧΩΡΙΣ να χαλούν το re-parse.
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { convertLeader } from '../../../utils/dxf-leader-converter';
import type { Entity } from '../../../types/entities';

const LAYERS = { L: { name: 'ANNO', colorAci: 3 } };

function leader(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'ld', type: 'leader', layerId: 'L',
    vertices: [{ x: 10, y: 20 }, { x: 40, y: 20 }, { x: 55, y: 35 }],
    arrowHead: { type: 'closed', size: 2.5 },
    ...over,
  } as unknown as Entity;
}

/**
 * Extract the first LEADER block as BOTH the ordered `pairs` array (repeated 10/20 preserved)
 * and the flat `data` Record (last-wins) — exactly the two views `convertLeader` consumes.
 */
function extractLeader(dxf: string): { data: Record<string, string>; layer: string; pairs: Array<[string, string]> } | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === 'LEADER') { start = i + 2; break; }
  }
  if (start < 0) return null;
  const data: Record<string, string> = {};
  const pairs: Array<[string, string]> = [];
  let layer = '0';
  for (let i = start; i < t.length - 1; i += 2) {
    const code = t[i];
    const value = t[i + 1];
    if (code === '0') break;
    if (code === '8') layer = value;
    data[code] = value;
    pairs.push([code, value]);
  }
  return { data, layer, pairs };
}

type ParsedLeader = {
  type: string;
  vertices: Array<{ x: number; y: number }>;
  arrowHead?: { type: string; size: number };
  color?: string;
};

describe('writeDxfAscii — LEADER entity (D.2)', () => {
  it('εκπέμπει LEADER με 71 arrowhead flag + 76 vertex-count + ordered 10/20/30', () => {
    const ext = extractLeader(writeDxfAscii([leader()], { layersById: LAYERS }))!;
    expect(ext).not.toBeNull();
    expect(ext.data['71']).toBe('1');       // arrowhead enabled
    expect(ext.data['76']).toBe('3');       // 3 vertices
    expect(ext.data['3']).toBe('Standard'); // dimstyle default
    expect(ext.data['72']).toBe('0');       // straight path
    expect(ext.layer).toBe('ANNO');
    // τρία ζεύγη 10/20 στο pairs (repeated codes διατηρημένα)
    expect(ext.pairs.filter(([c]) => c === '10')).toHaveLength(3);
  });

  it('round-trip: writeDxfAscii → convertLeader ανακτά ΙΔΙΕΣ vertices (tip=vertices[0])', () => {
    const ext = extractLeader(writeDxfAscii([leader()], { layersById: LAYERS }))!;
    const e = convertLeader({ type: 'LEADER', ...ext }, 0) as unknown as ParsedLeader;
    expect(e.type).toBe('leader');
    expect(e.vertices).toEqual([{ x: 10, y: 20 }, { x: 40, y: 20 }, { x: 55, y: 35 }]);
    expect(e.arrowHead?.type).toBe('closed');
  });

  it('κλιμακώνει τις vertices με το coordinate scale', () => {
    const ext = extractLeader(writeDxfAscii([leader()], { layersById: LAYERS, scale: 2 }))!;
    const e = convertLeader({ type: 'LEADER', ...ext }, 0) as unknown as ParsedLeader;
    expect(e.vertices).toEqual([{ x: 20, y: 40 }, { x: 80, y: 40 }, { x: 110, y: 70 }]);
  });

  it('arrowHead none → 71=0 → convertLeader ανακτά type "none"', () => {
    const ext = extractLeader(writeDxfAscii([leader({ arrowHead: { type: 'none', size: 2.5 } })], { layersById: LAYERS }))!;
    expect(ext.data['71']).toBe('0');
    const e = convertLeader({ type: 'LEADER', ...ext }, 0) as unknown as ParsedLeader;
    expect(e.arrowHead?.type).toBe('none');
  });

  it('arrowHead undefined → default enabled (71=1)', () => {
    const ext = extractLeader(writeDxfAscii([leader({ arrowHead: undefined })], { layersById: LAYERS }))!;
    expect(ext.data['71']).toBe('1');
    const e = convertLeader({ type: 'LEADER', ...ext }, 0) as unknown as ParsedLeader;
    expect(e.arrowHead?.type).toBe('closed');
  });

  it('< 2 vertices → κανένα LEADER block (writer guard, mirror emitPath)', () => {
    const dxf = writeDxfAscii([leader({ vertices: [{ x: 1, y: 1 }] })], { layersById: LAYERS });
    expect(dxf).not.toContain('\nLEADER\n');
  });

  it('χωρίς HEADER opts → bare envelope (zero regression)', () => {
    const dxf = writeDxfAscii([leader()], { layersById: LAYERS });
    expect(dxf.startsWith('0\nSECTION\n2\nENTITIES\n')).toBe(true);
  });
});
