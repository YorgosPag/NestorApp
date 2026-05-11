/**
 * ADR-344 Phase 4 — DxfTextNode ↔ TipTap JSON roundtrip tests.
 *
 * Validates that dxfTextToTipTap + tipTapToDxfText is a lossless inverse
 * pair across a representative cross-section of MTEXT fixtures.
 */

import { dxfTextToTipTap } from '../dxf-to-tiptap';
import { tipTapToDxfText } from '../tiptap-to-dxf';
import type {
  DxfTextNode,
  TextParagraph,
  TextRun,
  TextRunStyle,
  TextStack,
} from '../../types/text-ast.types';
import type { DxfColor } from '../../types/text-toolbar.types';

// ── Fixture builders ──────────────────────────────────────────────────────────

const COLOR_BY_LAYER: DxfColor = { kind: 'ByLayer' };

function makeStyle(over: Partial<TextRunStyle> = {}): TextRunStyle {
  return {
    fontFamily: 'Arial',
    bold: false,
    italic: false,
    underline: false,
    overline: false,
    strikethrough: false,
    height: 2.5,
    widthFactor: 1,
    obliqueAngle: 0,
    tracking: 1,
    color: COLOR_BY_LAYER,
    ...over,
  };
}

function makeRun(text: string, styleOver: Partial<TextRunStyle> = {}): TextRun {
  return { text, style: makeStyle(styleOver) };
}

function makeParagraph(runs: Array<TextRun | TextStack>, over: Partial<TextParagraph> = {}): TextParagraph {
  return {
    runs,
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1,
    ...over,
  };
}

function makeNode(paragraphs: TextParagraph[], over: Partial<DxfTextNode> = {}): DxfTextNode {
  return {
    paragraphs,
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
    ...over,
  };
}

// ── Helper: roundtrip + structural deep-equality assertion ────────────────────

function roundtrip(node: DxfTextNode): DxfTextNode {
  return tipTapToDxfText(dxfTextToTipTap(node));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('roundtrip — plain text', () => {
  it('single paragraph with single run preserves text', () => {
    const node = makeNode([makeParagraph([makeRun('Hello world')])]);
    const result = roundtrip(node);
    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0]!.runs).toHaveLength(1);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.text).toBe('Hello world');
  });

  it('multiple paragraphs preserved with attrs', () => {
    const node = makeNode([
      makeParagraph([makeRun('first')], { indent: 5, leftMargin: 2 }),
      makeParagraph([makeRun('second')], { justification: 1 }),
    ]);
    const result = roundtrip(node);
    expect(result.paragraphs).toHaveLength(2);
    expect(result.paragraphs[0]!.indent).toBe(5);
    expect(result.paragraphs[0]!.leftMargin).toBe(2);
    expect(result.paragraphs[1]!.justification).toBe(1);
  });
});

describe('roundtrip — inline styles', () => {
  it('bold + italic preserved', () => {
    const node = makeNode([makeParagraph([makeRun('Bold!', { bold: true, italic: true })])]);
    const result = roundtrip(node);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.style.bold).toBe(true);
    expect(run.style.italic).toBe(true);
  });

  it('underline / overline / strikethrough preserved', () => {
    const node = makeNode([makeParagraph([
      makeRun('U', { underline: true }),
      makeRun('O', { overline: true }),
      makeRun('S', { strikethrough: true }),
    ])]);
    const result = roundtrip(node);
    const runs = result.paragraphs[0]!.runs as TextRun[];
    expect(runs.map(r => r.text)).toEqual(['U', 'O', 'S']);
    expect(runs[0]!.style.underline).toBe(true);
    expect(runs[1]!.style.overline).toBe(true);
    expect(runs[2]!.style.strikethrough).toBe(true);
  });

  it('numeric mark attrs (height, widthFactor, obliqueAngle, tracking) preserved', () => {
    const node = makeNode([makeParagraph([makeRun('X', {
      height: 5, widthFactor: 0.8, obliqueAngle: 15, tracking: 1.5,
    })])]);
    const result = roundtrip(node);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.style.height).toBe(5);
    expect(run.style.widthFactor).toBe(0.8);
    expect(run.style.obliqueAngle).toBe(15);
    expect(run.style.tracking).toBe(1.5);
  });

  it('font family preserved', () => {
    const node = makeNode([makeParagraph([makeRun('A', { fontFamily: 'romans.shx' })])]);
    const result = roundtrip(node);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.style.fontFamily).toBe('romans.shx');
  });
});

describe('roundtrip — colour', () => {
  it('ACI colour preserved', () => {
    const node = makeNode([makeParagraph([makeRun('R', { color: { kind: 'ACI', index: 1 } })])]);
    const result = roundtrip(node);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.style.color).toEqual({ kind: 'ACI', index: 1 });
  });

  it('TrueColor RGB preserved', () => {
    const color: DxfColor = { kind: 'TrueColor', r: 255, g: 128, b: 0 };
    const node = makeNode([makeParagraph([makeRun('rgb', { color })])]);
    const result = roundtrip(node);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.style.color).toEqual(color);
  });

  it('ByLayer / ByBlock preserved', () => {
    const node = makeNode([makeParagraph([
      makeRun('L', { color: { kind: 'ByLayer' } }),
      makeRun('B', { color: { kind: 'ByBlock' } }),
    ])]);
    const result = roundtrip(node);
    const runs = result.paragraphs[0]!.runs as TextRun[];
    expect(runs[0]!.style.color.kind).toBe('ByLayer');
    expect(runs[1]!.style.color.kind).toBe('ByBlock');
  });
});

describe('roundtrip — soft newlines (\\N)', () => {
  it('newline within run text preserved', () => {
    const node = makeNode([makeParagraph([makeRun('line1\nline2')])]);
    const result = roundtrip(node);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.text).toBe('line1\nline2');
  });

  it('multiple newlines preserved', () => {
    const node = makeNode([makeParagraph([makeRun('a\nb\nc')])]);
    const result = roundtrip(node);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.text).toBe('a\nb\nc');
  });
});

describe('roundtrip — adjacent runs with identical style merge', () => {
  it('two identical-style runs are merged into one on the way back', () => {
    // Source has two separate runs with the same style
    const style = { bold: true };
    const node = makeNode([makeParagraph([
      makeRun('Hel', style),
      makeRun('lo', style),
    ])]);
    const result = roundtrip(node);
    expect(result.paragraphs[0]!.runs).toHaveLength(1);
    const run = result.paragraphs[0]!.runs[0] as TextRun;
    expect(run.text).toBe('Hello');
  });

  it('two distinct-style runs stay separate', () => {
    const node = makeNode([makeParagraph([
      makeRun('A', { bold: true }),
      makeRun('B', { italic: true }),
    ])]);
    const result = roundtrip(node);
    expect(result.paragraphs[0]!.runs).toHaveLength(2);
  });
});

describe('roundtrip — TextStack (\\S)', () => {
  it('tolerance stack preserved', () => {
    const stack: TextStack = {
      top: '1', bottom: '2', type: 'tolerance',
      style: { fontFamily: 'Arial', height: 2.5, color: COLOR_BY_LAYER },
    };
    const node = makeNode([makeParagraph([stack])]);
    const result = roundtrip(node);
    const out = result.paragraphs[0]!.runs[0] as TextStack;
    expect(out.top).toBe('1');
    expect(out.bottom).toBe('2');
    expect(out.type).toBe('tolerance');
  });

  it('diagonal & horizontal types preserved', () => {
    const baseStyle = { fontFamily: 'Arial', height: 2.5, color: COLOR_BY_LAYER };
    const node = makeNode([makeParagraph([
      { top: '1', bottom: '2', type: 'diagonal',   style: baseStyle } as TextStack,
      { top: '3', bottom: '4', type: 'horizontal', style: baseStyle } as TextStack,
    ])]);
    const result = roundtrip(node);
    const r = result.paragraphs[0]!.runs;
    expect((r[0] as TextStack).type).toBe('diagonal');
    expect((r[1] as TextStack).type).toBe('horizontal');
  });

  it('stack mixed with text runs preserved in order', () => {
    const stack: TextStack = {
      top: 'a', bottom: 'b', type: 'horizontal',
      style: { fontFamily: 'Arial', height: 2.5, color: COLOR_BY_LAYER },
    };
    const node = makeNode([makeParagraph([
      makeRun('before '),
      stack,
      makeRun(' after'),
    ])]);
    const result = roundtrip(node);
    const r = result.paragraphs[0]!.runs;
    expect(r).toHaveLength(3);
    expect((r[0] as TextRun).text).toBe('before ');
    expect((r[1] as TextStack).top).toBe('a');
    expect((r[2] as TextRun).text).toBe(' after');
  });
});

describe('roundtrip — node-level attrs', () => {
  it('attachment + rotation + line-spacing preserved', () => {
    const node = makeNode([makeParagraph([makeRun('T')])], {
      attachment: 'MC',
      rotation: 45,
      lineSpacing: { mode: 'exact', factor: 5 },
    });
    const result = roundtrip(node);
    expect(result.attachment).toBe('MC');
    expect(result.rotation).toBe(45);
    expect(result.lineSpacing.mode).toBe('exact');
    expect(result.lineSpacing.factor).toBe(5);
  });

  it('isAnnotative + currentScale + annotationScales preserved', () => {
    const node = makeNode([makeParagraph([makeRun('T')])], {
      isAnnotative: true,
      currentScale: '1:100',
      annotationScales: [{ name: '1:100', paperHeight: 2.5, modelHeight: 250 }],
    });
    const result = roundtrip(node);
    expect(result.isAnnotative).toBe(true);
    expect(result.currentScale).toBe('1:100');
    expect(result.annotationScales).toHaveLength(1);
    expect(result.annotationScales[0]!.name).toBe('1:100');
  });

  it('columns preserved when present', () => {
    const node = makeNode([makeParagraph([makeRun('T')])], {
      columns: { type: 'static', count: 2, width: 100, gutter: 10 },
    });
    const result = roundtrip(node);
    expect(result.columns).toBeDefined();
    expect(result.columns?.count).toBe(2);
  });

  it('columns absent when not provided', () => {
    const node = makeNode([makeParagraph([makeRun('T')])]);
    const result = roundtrip(node);
    expect(result.columns).toBeUndefined();
  });

  it('bgMask preserved when present', () => {
    const node = makeNode([makeParagraph([makeRun('T')])], {
      bgMask: { color: { kind: 'ACI', index: 2 }, offsetFactor: 1.5 },
    });
    const result = roundtrip(node);
    expect(result.bgMask).toBeDefined();
    expect(result.bgMask?.offsetFactor).toBe(1.5);
  });
});
