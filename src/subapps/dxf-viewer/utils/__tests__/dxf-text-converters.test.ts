/**
 * ADR-635 Φ4 — rich MTEXT import round-trip tests.
 *
 * Verifies `convertMText` now feeds the ADR-344 parser SSoT so the raw inline-code
 * string becomes a real multi-paragraph/run AST — closing the ADR-636 Φ2.3 double-escape
 * limitation (raw `\P` → single run → `serializeDxfTextNode` escaped it to `\\P`).
 *
 * Focus: (1) `\P` paragraph split, (2) flat `.text` is plain (no codes), (3) clean
 * re-export round-trip (no double-escape), (4) attachment/rotation, (5) inline height/
 * color runs, (6) Greek + `\U+XXXX` decode, (7) empty-content guard.
 */

import { convertMText } from '../dxf-text-converters';
import { serializeDxfTextNode } from '../../text-engine/serializer';
import { DxfDocumentVersion } from '../../text-engine/types/text-toolbar.types';
import type { DxfTextNode, TextRun } from '../../text-engine/types';

type TextScene = {
  type: string;
  text: string;
  textNode: DxfTextNode;
  position: { x: number; y: number };
  rotation: number;
  alignment: string;
};

/** Minimal MTEXT `data` map (flat Record, as the parser produces). */
function mtextData(content: string, extra: Record<string, string> = {}): Record<string, string> {
  return { '10': '100', '20': '50', '40': '2.5', '1': content, ...extra };
}

function firstRun(node: DxfTextNode): TextRun {
  return node.paragraphs[0].runs[0] as TextRun;
}

describe('convertMText — rich MTEXT import (ADR-635 Φ4)', () => {
  it('splits `\\P` into separate paragraphs and flattens `.text` with `\\n`', () => {
    const e = convertMText(mtextData('Γραμμή1\\PΓραμμή2'), 'L1', 0) as TextScene;
    expect(e).not.toBeNull();
    expect(e.textNode.paragraphs).toHaveLength(2);
    expect(firstRun(e.textNode).text).toBe('Γραμμή1');
    // Flat `.text` is PLAIN (the render/hit-test/snap pipeline reads it first).
    expect(e.text).toBe('Γραμμή1\nΓραμμή2');
    expect(e.text).not.toContain('\\P');
  });

  it('round-trips `\\P` WITHOUT double-escaping (closes ADR-636 Φ2.3 limitation)', () => {
    const e = convertMText(mtextData('Line1\\PLine2'), 'L1', 0) as TextScene;
    const { content } = serializeDxfTextNode(e.textNode, { version: DxfDocumentVersion.R2000 });
    expect(content).toContain('\\P');       // real paragraph break preserved
    expect(content).not.toContain('\\\\P'); // NOT double-escaped
    expect(content).toBe('Line1\\PLine2');
  });

  it('maps code 71 attachment (5 → MC) and code 50 rotation onto the node', () => {
    const e = convertMText(mtextData('X', { '71': '5', '50': '90' }), 'L1', 0) as TextScene;
    expect(e.textNode.attachment).toBe('MC');
    expect(e.textNode.rotation).toBe(90);
  });

  it('parses inline height (`\\H`) and color (`\\C`) into separate runs', () => {
    const e = convertMText(mtextData('small\\H5;big'), 'L1', 0) as TextScene;
    const runs = e.textNode.paragraphs[0].runs as TextRun[];
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs[0].text).toBe('small');
    expect(runs[0].style.height).toBe(2.5); // seeded from code 40
    expect(runs[1].text).toBe('big');
    expect(runs[1].style.height).toBe(5);
  });

  it('decodes `%%d`/`%%c`/`%%p` and `\\U+XXXX` into real glyphs', () => {
    const e = convertMText(mtextData('45%%d \\U+0391'), 'L1', 0) as TextScene;
    expect(e.text).toContain('°');
    expect(e.text).toContain('Α');
    expect(e.text).not.toContain('%%d');
    expect(e.text).not.toContain('\\U+');
  });

  it('falls back to group-3 when group-1 is absent', () => {
    const data = { '10': '0', '20': '0', '40': '2.5', '3': 'ChunkOnly' };
    const e = convertMText(data, 'L1', 0) as TextScene;
    expect(e.text).toBe('ChunkOnly');
  });

  it('returns null for empty content or missing position', () => {
    expect(convertMText(mtextData('   '), 'L1', 0)).toBeNull();
    expect(convertMText({ '10': 'x', '20': '0', '1': 'A' }, 'L1', 0)).toBeNull();
  });
});
