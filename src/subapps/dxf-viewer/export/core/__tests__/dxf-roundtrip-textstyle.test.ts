/**
 * DXF TEXTSTYLE Roundtrip — ADR-636 Φ2.4 (D.5).
 *
 * Αποδεικνύει ότι ο writer παράγει STYLE table + real group 7 από το font των TEXT/MTEXT,
 * ΑΝΤΙΣΤΡΟΦΟ της C.5 import: ο ίδιος import reader (`parseStyleTable`/`buildStyleFontMap`)
 * ανακτά `{ styleName → fontFamily }` — άρα re-import `resolveStyleFont(group7)` = το αρχικό font.
 * Καλύπτει: TEXT/MTEXT emit, dedup ανά font, STANDARD gating (χωρίς font → χωρίς STYLE entry),
 * και το Tekton `explode` byte-identical (STANDARD, table-less).
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { parseStyleTable, buildStyleFontMap } from '../../../text-engine/parser/style-table-reader';
import type { Entity } from '../../../types/entities';

const LAYERS = { L: { name: 'TXT' } };

/** A single-run paragraph carrying `font` as its family (mirror του render base style). */
function para(text: string, font: string): unknown {
  return {
    runs: [{
      text,
      style: {
        fontFamily: font, bold: false, italic: false, underline: false,
        overline: false, strikethrough: false, height: 2.5, widthFactor: 1,
        obliqueAngle: 0, tracking: 1, color: { kind: 'ByLayer' },
      },
    }],
    indent: 0, leftMargin: 0, rightMargin: 0, tabs: [], justification: 0,
    lineSpacingMode: 'multiple', lineSpacingFactor: 1,
  };
}
function node(font: string): unknown {
  return {
    paragraphs: [para('Hi', font)], attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 }, rotation: 0,
    isAnnotative: false, annotationScales: [], currentScale: '',
  };
}
function textEnt(font: string, id = 't'): Entity {
  return {
    id, type: 'text', layerId: 'L', position: { x: 5, y: 5 }, text: 'Hi', height: 2,
    alignment: 'left', textNode: node(font),
  } as unknown as Entity;
}
function mtextEnt(font: string, id = 'm'): Entity {
  return {
    id, type: 'mtext', layerId: 'L', position: { x: 1, y: 2 }, width: 100,
    text: 'Hi', textNode: node(font),
  } as unknown as Entity;
}

/** Flat `data` Record of the first `<TYPE>` entity block (header codes to the next `0`). */
function extractEntity(dxf: string, type: string): Record<string, string> | null {
  const t = dxf.split('\n');
  let start = -1;
  for (let i = 0; i < t.length - 1; i += 2) {
    if (t[i] === '0' && t[i + 1] === type) { start = i + 2; break; }
  }
  if (start < 0) return null;
  const data: Record<string, string> = {};
  for (let i = start; i < t.length - 1; i += 2) {
    if (t[i] === '0') break;
    data[t[i]] = t[i + 1];
  }
  return data;
}

describe('writeDxfAscii — STYLE table + group 7 (D.5)', () => {
  it('TEXT με font → group 7 = font name + STYLE entry + reverse-symmetry', () => {
    const dxf = writeDxfAscii([textEnt('romans')], { layersById: LAYERS });
    expect(extractEntity(dxf, 'TEXT')!['7']).toBe('romans');
    // STYLE table μέσω του ΙΔΙΟΥ import reader
    const entries = parseStyleTable(dxf);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('romans');
    expect(entries[0].fontFile).toBe('romans');
    // round-trip: re-import styleName → fontFamily
    expect(buildStyleFontMap(dxf)['romans']).toBe('romans');
  });

  it('MTEXT με font → group 7 = font name + STYLE entry', () => {
    const dxf = writeDxfAscii([mtextEnt('isocpeur')], { layersById: LAYERS });
    expect(extractEntity(dxf, 'MTEXT')!['7']).toBe('isocpeur');
    expect(buildStyleFontMap(dxf)['isocpeur']).toBe('isocpeur');
  });

  it('STYLE table μπαίνει ΠΡΙΝ τα ENTITIES (σωστή DXF σειρά)', () => {
    const dxf = writeDxfAscii([textEnt('romans')], { layersById: LAYERS });
    expect(dxf.indexOf('2\nSTYLE')).toBeLessThan(dxf.indexOf('2\nENTITIES'));
  });

  it('dedup: δύο TEXT ίδιο font → 1 STYLE entry· διαφορετικά fonts → 2', () => {
    const same = writeDxfAscii([textEnt('romans', 'a'), textEnt('romans', 'b')], { layersById: LAYERS });
    expect(parseStyleTable(same)).toHaveLength(1);
    const diff = writeDxfAscii([textEnt('romans', 'a'), textEnt('txt', 'b')], { layersById: LAYERS });
    expect(parseStyleTable(diff).map((e) => e.name).sort()).toEqual(['romans', 'txt']);
  });
});

describe('writeDxfAscii — STYLE gating (D.5, zero regression)', () => {
  it('TEXT χωρίς font (Standard) → group 7 STANDARD + καμία STYLE table', () => {
    const dxf = writeDxfAscii([textEnt('Standard')], { layersById: LAYERS });
    expect(extractEntity(dxf, 'TEXT')!['7']).toBe('STANDARD');
    expect(parseStyleTable(dxf)).toHaveLength(0);
  });

  it('TEXT χωρίς textNode → group 7 STANDARD (default), καμία STYLE table', () => {
    const bare = { id: 't', type: 'text', layerId: 'L', position: { x: 0, y: 0 }, text: 'Hi', height: 2 } as unknown as Entity;
    const dxf = writeDxfAscii([bare], { layersById: LAYERS });
    expect(extractEntity(dxf, 'TEXT')!['7']).toBe('STANDARD');
    expect(parseStyleTable(dxf)).toHaveLength(0);
  });

  it('Tekton explode → group 7 STANDARD + table-less (byte-identical legacy)', () => {
    const dxf = writeDxfAscii([textEnt('romans')], { layersById: LAYERS, lineMode: 'lines' });
    expect(extractEntity(dxf, 'TEXT')!['7']).toBe('STANDARD');
    expect(parseStyleTable(dxf)).toHaveLength(0);
    expect(dxf.startsWith('0\nSECTION\n2\nENTITIES\n')).toBe(true);
  });
});
