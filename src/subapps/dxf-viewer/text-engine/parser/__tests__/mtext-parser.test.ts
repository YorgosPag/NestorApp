/**
 * ADR-344 Phase 1 — mtext-parser unit tests.
 *
 * Tests round-trip correctness of the token → AST conversion.
 * Fixtures are built by composing tokenizeMtext + parseMtext.
 */

import { tokenizeMtext } from '../mtext-tokenizer';
import { parseMtext, parseText } from '../mtext-parser';
import type { DxfTextNode, TextRun, TextStack } from '../../types/text-ast.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parse(raw: string, baseStyle?: Parameters<typeof parseMtext>[1]): DxfTextNode {
  return parseMtext(tokenizeMtext(raw), baseStyle);
}

function firstRun(node: DxfTextNode): TextRun {
  return node.paragraphs[0].runs[0] as TextRun;
}

// ── Basic node structure ──────────────────────────────────────────────────────

describe('mtext-parser — basic structure', () => {
  it('empty string → one empty paragraph', () => {
    const node = parse('');
    expect(node.paragraphs).toHaveLength(1);
    expect(node.paragraphs[0].runs).toHaveLength(0);
  });

  it('plain text → single paragraph, single run', () => {
    const node = parse('Hello World');
    expect(node.paragraphs).toHaveLength(1);
    expect(node.paragraphs[0].runs).toHaveLength(1);
    expect(firstRun(node).text).toBe('Hello World');
  });

  it('default attachment is TL for MTEXT', () => {
    expect(parse('Text').attachment).toBe('TL');
  });

  it('default rotation is 0', () => {
    expect(parse('Text').rotation).toBe(0);
  });

  it('isAnnotative defaults false', () => {
    expect(parse('Text').isAnnotative).toBe(false);
  });
});

// ── Paragraph breaks ──────────────────────────────────────────────────────────

describe('mtext-parser — paragraph breaks', () => {
  it('\\P creates two paragraphs', () => {
    const node = parse('Para1\\PPara2');
    expect(node.paragraphs).toHaveLength(2);
    expect((node.paragraphs[0].runs[0] as TextRun).text).toBe('Para1');
    expect((node.paragraphs[1].runs[0] as TextRun).text).toBe('Para2');
  });

  it('multiple \\P create multiple paragraphs', () => {
    const node = parse('A\\PB\\PC');
    expect(node.paragraphs).toHaveLength(3);
  });
});

// ── Style groups ──────────────────────────────────────────────────────────────

describe('mtext-parser — style groups', () => {
  it('group resets style after close', () => {
    const node = parse('{\\fArial|b1|i0|c0|p0;Bold}Normal');
    const runs = node.paragraphs[0].runs as TextRun[];
    expect(runs).toHaveLength(2);
    expect(runs[0].style.bold).toBe(true);
    expect(runs[1].style.bold).toBe(false);
  });

  it('nested groups scope style correctly', () => {
    const node = parse('{\\fArial|b1|i0|c0|p0;{\\H5;BigBold}StillBold}Normal');
    const runs = node.paragraphs[0].runs as TextRun[];
    expect(runs[0].style.bold).toBe(true);
    expect(runs[0].style.height).toBe(5);
    expect(runs[1].style.bold).toBe(true);
    expect(runs[1].style.height).toBe(2.5); // restored to outer group
    expect(runs[2].style.bold).toBe(false);
  });
});

// ── Style attribute propagation ───────────────────────────────────────────────

describe('mtext-parser — style attributes', () => {
  it('\\H sets absolute height on run', () => {
    const node = parse('\\H5;Text');
    expect(firstRun(node).style.height).toBe(5);
  });

  it('\\H with x suffix sets relative height', () => {
    const node = parse('\\H2x;Text', { height: 3 });
    expect(firstRun(node).style.height).toBeCloseTo(6);
  });

  it('\\C sets ACI color', () => {
    const node = parse('\\C1;Text');
    const color = firstRun(node).style.color;
    expect(color.kind).toBe('ACI');
    if (color.kind === 'ACI') expect(color.index).toBe(1);
  });

  it('\\c sets true color', () => {
    const node = parse('\\c16711680;Text');
    const color = firstRun(node).style.color;
    expect(color.kind).toBe('TrueColor');
    if (color.kind === 'TrueColor') {
      expect(color.r).toBe(255);
      expect(color.g).toBe(0);
      expect(color.b).toBe(0);
    }
  });

  it('\\L sets underline; \\l clears it', () => {
    const node = parse('\\LOn\\lOff');
    const runs = node.paragraphs[0].runs as TextRun[];
    expect(runs[0].style.underline).toBe(true);
    expect(runs[1].style.underline).toBe(false);
  });

  it('\\O sets overline', () => {
    const node = parse('\\OText');
    expect(firstRun(node).style.overline).toBe(true);
  });

  it('\\K sets strikethrough', () => {
    const node = parse('\\KText');
    expect(firstRun(node).style.strikethrough).toBe(true);
  });
});

// ── Special inline characters ─────────────────────────────────────────────────

describe('mtext-parser — inline characters', () => {
  it('%%c inlines diameter symbol Ø', () => {
    const node = parse('%%c25');
    expect(firstRun(node).text).toContain('Ø');
  });

  it('%%d inlines degree symbol °', () => {
    const node = parse('45%%d');
    expect(firstRun(node).text).toContain('°');
  });

  it('%%p inlines ± symbol', () => {
    const node = parse('%%p0.1');
    expect(firstRun(node).text).toContain('±');
  });

  it('\\U+03B1 inlines α', () => {
    const node = parse('\\U+03B1');
    expect(firstRun(node).text).toBe('α');
  });

  it('\\~ inlines non-breaking space (U+00A0)', () => {
    const node = parse('A\\~B');
    expect(firstRun(node).text).toContain(' ');
  });
});

// ── Stack (\S) ────────────────────────────────────────────────────────────────

describe('mtext-parser — \\S stack', () => {
  it('produces a TextStack run for diagonal fraction', () => {
    const node = parse('\\S1/2;');
    const run = node.paragraphs[0].runs[0] as TextStack;
    expect(run.top).toBe('1');
    expect(run.bottom).toBe('2');
    expect(run.type).toBe('diagonal');
  });
});

// ── parseText() ───────────────────────────────────────────────────────────────

describe('parseText', () => {
  it('wraps plain string in single-paragraph node', () => {
    const node = parseText('Room A');
    expect(node.paragraphs).toHaveLength(1);
    expect((node.paragraphs[0].runs[0] as TextRun).text).toBe('Room A');
  });

  it('attachment is BL for TEXT entities', () => {
    expect(parseText('x').attachment).toBe('BL');
  });

  it('empty string produces paragraph with no runs', () => {
    expect(parseText('').paragraphs[0].runs).toHaveLength(0);
  });

  it('applies baseStyle overrides', () => {
    const node = parseText('Text', { bold: true, height: 5 });
    const run = node.paragraphs[0].runs[0] as TextRun;
    expect(run.style.bold).toBe(true);
    expect(run.style.height).toBe(5);
  });
});
