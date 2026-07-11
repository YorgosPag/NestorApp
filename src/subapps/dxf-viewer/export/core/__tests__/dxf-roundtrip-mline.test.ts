/**
 * DXF MLINE Roundtrip — ADR-636 Φ2.4 (D.4) / ADR-635 Φ C.7 parity.
 *
 * Αποδεικνύει ότι ένα imported MLINE (που το import εκρήγνυσι σε N element `polyline` + κρατά τα
 * αυθεντικά params στο `dxfMlineSource` του πρώτου element) εξάγεται ΠΙΣΩ σε **native** MLINE +
 * MLINESTYLE (OBJECTS section) — και ξανα-διαβάζεται ΙΔΙΟ μέσω των ΠΡΑΓΜΑΤΙΚΩΝ import readers
 * (`buildMlineStyleMap` + `convertMline`). Τα sibling element polylines suppress-άρονται (το MLINE
 * τα ξανα-ζωγραφίζει). `explode` (Τέκτων) κρατά exploded LINEs — zero regression.
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { convertMline } from '../../../utils/dxf-mline-converter';
import { buildMlineStyleMap } from '../../../utils/dxf-mline-style-parser';
import type { DxfMlineSource, Entity, PolylineEntity } from '../../../types/entities';

const LAYERS = { L: { name: 'WALL', colorAci: 1 } };

// Μη-STANDARD offsets (0.6 / -0.4) ώστε το STANDARD fallback (±0.5) να ΑΠΟΤΥΓΧΑΝΕΙ αν το
// MLINESTYLE δεν κάνει round-trip — δηλαδή το test αποδεικνύει την OBJECTS-section εξαγωγή.
const SOURCE: DxfMlineSource = {
  refPath: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  scale: 1,
  justification: 1, // zero → no justification shift
  isClosed: false,
  styleName: 'MYWALL',
  style: { name: 'MYWALL', elements: [{ offset: 0.6 }, { offset: -0.4 }] },
};

/** Ο carrier (element 0) κουβαλά το marker· το sibling (element 1) απλώς το groupId. */
function mlineGroup(over: Partial<DxfMlineSource> = {}): Entity[] {
  const source = { ...SOURCE, ...over, style: over.style ?? SOURCE.style };
  const carrier = {
    id: 'mline_0_e0', type: 'polyline', layerId: 'L', groupId: 'mline_0',
    vertices: [{ x: 0, y: 0.6 }, { x: 10, y: 0.6 }], dxfMlineSource: source,
  } as unknown as PolylineEntity;
  const sibling = {
    id: 'mline_0_e1', type: 'polyline', layerId: 'L', groupId: 'mline_0',
    vertices: [{ x: 0, y: -0.4 }, { x: 10, y: -0.4 }],
  } as unknown as PolylineEntity;
  return [carrier, sibling];
}

/** Extract the ordered `[code,value]` pairs of the first `entityName` block (until the next `0`). */
function extractPairs(dxf: string, entityName: string): Array<readonly [string, string]> {
  const t = dxf.split('\n');
  let i = 0;
  for (; i < t.length - 1; i += 2) { if (t[i] === '0' && t[i + 1] === entityName) break; }
  const pairs: Array<readonly [string, string]> = [];
  for (i += 2; i < t.length - 1; i += 2) {
    if (t[i] === '0') break;
    pairs.push([t[i], t[i + 1]]);
  }
  return pairs;
}

function countOccurrences(dxf: string, entityName: string): number {
  const t = dxf.split('\n');
  let n = 0;
  for (let i = 0; i < t.length - 1; i += 2) { if (t[i] === '0' && t[i + 1] === entityName) n += 1; }
  return n;
}

describe('writeDxfAscii — native MLINE round-trip (D.4)', () => {
  it('εξάγει ΕΝΑ MLINE (carrier) + suppress-άρει το sibling polyline', () => {
    const dxf = writeDxfAscii(mlineGroup(), { layersById: LAYERS });
    expect(countOccurrences(dxf, 'MLINE')).toBe(1);
    expect(countOccurrences(dxf, 'POLYLINE')).toBe(0); // κανένα element polyline δεν διαρρέει
  });

  it('εκπέμπει OBJECTS section με MLINESTYLE που round-trips μέσω buildMlineStyleMap', () => {
    const dxf = writeDxfAscii(mlineGroup(), { layersById: LAYERS });
    const styles = buildMlineStyleMap(dxf.split('\n'));
    const def = styles.get('MYWALL');
    expect(def).toBeDefined();
    expect(def!.elements.map((e) => e.offset)).toEqual([0.6, -0.4]); // ΟΧΙ STANDARD ±0.5
  });

  it('το MLINE + MLINESTYLE ανασυντίθενται σε 2 element polylines μέσω convertMline', () => {
    const dxf = writeDxfAscii(mlineGroup(), { layersById: LAYERS });
    const styles = buildMlineStyleMap(dxf.split('\n'));
    const pairs = extractPairs(dxf, 'MLINE');
    const out = convertMline(pairs, 'WALL', 0, styles) as unknown as PolylineEntity[];
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.groupId === 'mline_0')).toBe(true);
    // element offsets ανακτώνται από το MLINESTYLE (0.6 / -0.4), ΟΧΙ από STANDARD fallback
    const ys = out.map((e) => e.vertices[0].y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-0.4, 6);
    expect(ys[1]).toBeCloseTo(0.6, 6);
  });

  it('round-trips scale (40) + justification (70)', () => {
    const dxf = writeDxfAscii(mlineGroup(), { layersById: LAYERS });
    const pairs = extractPairs(dxf, 'MLINE');
    const map = Object.fromEntries(pairs);
    expect(map['40']).toBe('1');
    expect(map['70']).toBe('1');
    expect(map['2']).toBe('MYWALL');
  });

  it('scale: κλιμακώνει τις κορυφές του MLINE (11/21)', () => {
    const dxf = writeDxfAscii(mlineGroup(), { layersById: LAYERS, scale: 2 });
    const pairs = extractPairs(dxf, 'MLINE');
    const xs = pairs.filter(([c]) => c === '11').map(([, v]) => Number(v));
    expect(xs).toEqual([0, 20]); // 0×2, 10×2
  });

  it('explode (Τέκτων): ΟΧΙ MLINE — τα element polylines γίνονται exploded LINEs', () => {
    const dxf = writeDxfAscii(mlineGroup(), { layersById: LAYERS, lineMode: 'lines' });
    expect(countOccurrences(dxf, 'MLINE')).toBe(0);
    expect(dxf).not.toContain('OBJECTS'); // καμία OBJECTS section στον Τέκτονα path
    expect(dxf).toContain('0\nLINE\n');
  });

  it('γνήσιο polyline (χωρίς dxfMlineSource) μένει POLYLINE (zero regression)', () => {
    const plain = {
      id: 'p1', type: 'polyline', layerId: 'L',
      vertices: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
    } as unknown as Entity;
    const dxf = writeDxfAscii([plain], { layersById: LAYERS });
    expect(countOccurrences(dxf, 'MLINE')).toBe(0);
    expect(countOccurrences(dxf, 'POLYLINE')).toBe(1);
  });
});
