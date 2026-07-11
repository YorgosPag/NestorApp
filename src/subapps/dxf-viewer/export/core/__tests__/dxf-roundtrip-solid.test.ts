/**
 * DXF SOLID / TRACE / 3DFACE Roundtrip — ADR-636 Φ2.4 (D.3) / ADR-635 Φάση B parity.
 *
 * Αποδεικνύει ότι ένα imported SOLID/TRACE/3DFACE (που το import χαρτογραφεί σε `HatchEntity`
 * με `dxfSourceType`) εξάγεται πλέον ΠΙΣΩ στο **native** entity — όχι σε downgraded HATCH —
 * και το `emitQuadFill` un-bowties σωστά το draw-order boundary στα DXF slots 10/11/12/13
 * (inverse του import `parseQuadVertices`). Γνήσιο HATCH (χωρίς marker) μένει HATCH (zero regression).
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { convertSolid, convertTrace, convert3dFace } from '../../../utils/dxf-quad-fill-converter';
import type { Entity } from '../../../types/entities';

const LAYERS = { L: { name: 'FILL', colorAci: 2 } };

// draw-order square (A→B→C→D) = ό,τι αποθηκεύει ο import μετά το bowtie-correct.
const SQUARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
const TRI = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }];

function solidHatch(over: Record<string, unknown> = {}): Entity {
  return {
    id: 'h', type: 'hatch', layerId: 'L',
    boundaryPaths: [SQUARE], patternName: 'SOLID', patternType: 'solid', fillType: 'solid',
    dxfSourceType: 'solid', ...over,
  } as unknown as Entity;
}

/** Extract the first block named `name` as a flat `data` Record (these entities never repeat codes). */
function extractQuad(dxf: string, name: string): { data: Record<string, string>; layer: string } | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === name) { start = i + 2; break; }
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

type ParsedHatch = { type: string; boundaryPaths: Array<Array<{ x: number; y: number }>>; dxfSourceType?: string };

describe('writeDxfAscii — SOLID/TRACE/3DFACE native round-trip (D.3)', () => {
  it('SOLID: quad round-trips ΙΔΙΕΣ vertices (un-bowtie 1-2-4-3)', () => {
    const ext = extractQuad(writeDxfAscii([solidHatch()], { layersById: LAYERS }), 'SOLID')!;
    expect(ext).not.toBeNull();
    expect(ext.layer).toBe('FILL');
    const e = convertSolid(ext.data, ext.layer, 0) as unknown as ParsedHatch;
    expect(e.type).toBe('hatch');
    expect(e.dxfSourceType).toBe('solid');
    expect(e.boundaryPaths[0]).toEqual(SQUARE);
  });

  it('SOLID: τρίγωνο (3 vertices) round-trips (slot 13 = 3η κορυφή)', () => {
    const ext = extractQuad(writeDxfAscii([solidHatch({ boundaryPaths: [TRI] })], { layersById: LAYERS }), 'SOLID')!;
    expect(ext.data['12']).toBe(ext.data['13']); // slot 13 (4η κορυφή) == slot 12 (3η) → τρίγωνο
    expect(ext.data['22']).toBe(ext.data['23']);
    const e = convertSolid(ext.data, ext.layer, 0) as unknown as ParsedHatch;
    expect(e.boundaryPaths[0]).toEqual(TRI);
  });

  it('TRACE: εξάγεται ως TRACE και round-trips', () => {
    const ext = extractQuad(writeDxfAscii([solidHatch({ dxfSourceType: 'trace' })], { layersById: LAYERS }), 'TRACE')!;
    expect(ext).not.toBeNull();
    const e = convertTrace(ext.data, ext.layer, 0) as unknown as ParsedHatch;
    expect(e.boundaryPaths[0]).toEqual(SQUARE);
  });

  it('3DFACE: εξάγεται ως 3DFACE (Z=0, 2D projection) και round-trips', () => {
    const ext = extractQuad(writeDxfAscii([solidHatch({ dxfSourceType: '3dface' })], { layersById: LAYERS }), '3DFACE')!;
    expect(ext).not.toBeNull();
    expect(ext.data['30']).toBe('0');
    const e = convert3dFace(ext.data, ext.layer, 0) as unknown as ParsedHatch;
    expect(e.boundaryPaths[0]).toEqual(SQUARE);
  });

  it('scale: κλιμακώνει τις κορυφές', () => {
    const ext = extractQuad(writeDxfAscii([solidHatch()], { layersById: LAYERS, scale: 2 }), 'SOLID')!;
    const e = convertSolid(ext.data, ext.layer, 0) as unknown as ParsedHatch;
    expect(e.boundaryPaths[0]).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }]);
  });

  it('explode (Tekton): ΟΧΙ native SOLID — falls back σε exploded LINEs', () => {
    const dxf = writeDxfAscii([solidHatch()], { layersById: LAYERS, lineMode: 'lines' });
    expect(dxf).not.toContain('0\nSOLID\n'); // entity marker (ΟΧΙ το 2\nSOLID pattern-name)
    expect(dxf).toContain('0\nLINE\n');
  });

  it('γνήσιο HATCH (χωρίς dxfSourceType) → HATCH, ΟΧΙ SOLID (zero regression)', () => {
    const dxf = writeDxfAscii([solidHatch({ dxfSourceType: undefined })], { layersById: LAYERS });
    expect(dxf).not.toContain('0\nSOLID\n'); // entity marker· το 2\nSOLID (pattern name) επιτρέπεται
    expect(dxf).toContain('0\nHATCH\n');
  });
});
