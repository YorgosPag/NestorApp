/**
 * DXF MTEXT import↔export round-trip — ADR-635 Φ4 (closes ADR-636 Φ2.3 double-escape).
 *
 * The Φ4 fix made `convertMText` feed the ADR-344 parser SSoT so the imported `textNode`
 * is a real multi-paragraph/run AST with NO raw inline codes in its runs. This suite pins the
 * FULL loop through the production export writer (`writeDxfAscii` → `emitMText` →
 * `serializeDxfTextNode`), not just the serializer in isolation: a well-formed MTEXT node emits
 * `\P` cleanly (never `\\P`) and re-imports identically.
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { convertMText } from '../../../utils/dxf-text-converters';
import type { Entity } from '../../../types/entities';
import type { AnySceneEntity } from '../../../types/scene';
import type { DxfTextNode } from '../../../text-engine/types';

const LAYERS = { L: { name: 'TXT' } };

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

/** Minimal MTEXT `data` map (flat Record, as the parser produces). */
function mtextData(content: string, extra: Record<string, string> = {}): Record<string, string> {
  return { '10': '100', '20': '50', '40': '2.5', '1': content, ...extra };
}

/** Re-tag an imported MTEXT (convertMText → `type:'text'`) as a native MTEXT for the AutoCAD emitMText path. */
function asMText(imported: AnySceneEntity): Entity {
  return { ...imported, type: 'mtext', layerId: 'L' } as unknown as Entity;
}

function nodeOf(e: AnySceneEntity): DxfTextNode {
  return (e as unknown as { textNode: DxfTextNode }).textNode;
}

describe('MTEXT round-trip through emitMText (ADR-635 Φ4)', () => {
  it('emits `\\P` cleanly (no `\\\\P`) and re-imports the two paragraphs identically', () => {
    const imported = convertMText(mtextData('Line1\\PLine2'), 'L', 0)!;
    const dxf = writeDxfAscii([asMText(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    expect(data['1']).toContain('\\P');       // real paragraph break survived the writer
    expect(data['1']).not.toContain('\\\\P'); // NOT double-escaped

    const reimported = convertMText(data, 'L', 1)!;
    expect(nodeOf(reimported).paragraphs).toHaveLength(2);
    expect((reimported as unknown as { text: string }).text).toBe('Line1\nLine2');
  });

  it('re-exports an inline-height MTEXT with NO double-escaped backslash (no residual literal codes)', () => {
    // If the parser had left `\H5;` as literal run text, serializeDxfTextNode would escape its
    // backslash → `\\` in group-1. A clean AST re-emits a single-backslash `\H` code.
    const imported = convertMText(mtextData('small\\H5;big'), 'L', 0)!;
    const dxf = writeDxfAscii([asMText(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    expect(data['1']).not.toContain('\\\\'); // no double-escape anywhere in the content
  });

  it('preserves attachment (code 71) and rotation (code 50) across the writer', () => {
    const imported = convertMText(mtextData('X', { '71': '5', '50': '90' }), 'L', 0)!;
    const dxf = writeDxfAscii([asMText(imported)], { layersById: LAYERS });

    const data = extractEntity(dxf, 'MTEXT')!;
    expect(data['71']).toBe('5'); // MC attachment round-trips
    expect(parseFloat(data['50'])).toBe(90);
  });
});
