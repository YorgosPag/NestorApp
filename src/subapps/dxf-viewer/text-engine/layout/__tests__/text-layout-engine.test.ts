/**
 * ADR-344 Phase 3 — text-layout-engine unit tests.
 *
 * Tests focus on getBoundingBox output: correct dimensions, correct
 * world-space position based on insertion point + justification.
 */

import { layoutTextNode, getBoundingBox } from '../text-layout-engine';
import type { TextLayoutOptions } from '../text-layout-engine';
import type { DxfTextNode, TextParagraph, TextRun } from '../../types/text-ast.types';
import { DxfDocumentVersion } from '../../types/text-toolbar.types';
import type { Font } from 'opentype.js';

// ── Mock font (same predictable width as line-breaker tests) ──────────────────

function makeMockFont(): Font {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    charToGlyph: jest.fn(),
    getPath: jest.fn().mockReturnValue({ commands: [] }),
    getAdvanceWidth: jest.fn().mockImplementation((text: string, size: number) => text.length * size),
  } as unknown as Font;
}

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeTextRun(text: string, height = 10): TextRun {
  return {
    text,
    style: {
      fontFamily: 'Test',
      bold: false,
      italic: false,
      underline: false,
      overline: false,
      strikethrough: false,
      height,
      widthFactor: 1,
      obliqueAngle: 0,
      tracking: 1,
      color: { kind: 'ByLayer' },
    },
  };
}

function makeParagraph(runs: TextRun[]): TextParagraph {
  return {
    runs,
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple',
    lineSpacingFactor: 1,
  };
}

function makeNode(paragraphs: TextParagraph[], attachment: DxfTextNode['attachment'] = 'TL'): DxfTextNode {
  return {
    paragraphs,
    attachment,
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

function makeOpts(
  insertionPoint = { x: 0, y: 0 },
  maxWidth = 1000,
  font?: Font,
): TextLayoutOptions {
  return {
    insertionPoint,
    maxWidth,
    fontSize: 10,
    font: font ?? makeMockFont(),
    version: DxfDocumentVersion.R2018,
  };
}

// ── getBoundingBox — dimensions ───────────────────────────────────────────────

describe('getBoundingBox — dimensions', () => {
  it('returns positive width equal to maxWidth', () => {
    const node = makeNode([makeParagraph([makeTextRun('Hello')])]);
    const bb = getBoundingBox(node, makeOpts({ x: 0, y: 0 }, 500));
    expect(bb.width).toBe(500);
  });

  it('returns positive height for a single-line paragraph', () => {
    const node = makeNode([makeParagraph([makeTextRun('A', 10)])]);
    const bb = getBoundingBox(node, makeOpts());
    expect(bb.height).toBeGreaterThan(0);
  });

  it('height grows with more paragraphs', () => {
    const para = makeParagraph([makeTextRun('line', 10)]);
    const nodeOne = makeNode([para]);
    const nodeTwo = makeNode([para, para]);
    const h1 = getBoundingBox(nodeOne, makeOpts()).height;
    const h2 = getBoundingBox(nodeTwo, makeOpts()).height;
    expect(h2).toBeGreaterThan(h1);
  });

  it('returns zero-height bounding box when node has no paragraphs', () => {
    const node = makeNode([]);
    const bb = getBoundingBox(node, makeOpts());
    expect(bb.height).toBe(0);
  });
});

// ── getBoundingBox — TL justification ────────────────────────────────────────

describe('getBoundingBox — TL justification', () => {
  it('bounding-box top-left equals the insertion point', () => {
    const node = makeNode([makeParagraph([makeTextRun('Hi')])], 'TL');
    const ins = { x: 30, y: 40 };
    const bb = getBoundingBox(node, makeOpts(ins));
    expect(bb.x).toBeCloseTo(ins.x);
    expect(bb.y).toBeCloseTo(ins.y);
  });
});

// ── getBoundingBox — MC justification ────────────────────────────────────────

describe('getBoundingBox — MC justification', () => {
  it('bounding-box center equals the insertion point', () => {
    const node = makeNode([makeParagraph([makeTextRun('center')])], 'MC');
    const ins = { x: 100, y: 200 };
    const opts = makeOpts(ins, 80);
    const bb = getBoundingBox(node, opts);
    const cx = bb.x + bb.width / 2;
    const cy = bb.y + bb.height / 2;
    expect(cx).toBeCloseTo(ins.x);
    expect(cy).toBeCloseTo(ins.y);
  });
});

// ── getBoundingBox — BR justification ────────────────────────────────────────

describe('getBoundingBox — BR justification', () => {
  it('bounding-box bottom-right equals the insertion point', () => {
    const node = makeNode([makeParagraph([makeTextRun('br')])], 'BR');
    const ins = { x: 50, y: 60 };
    const opts = makeOpts(ins, 100);
    const bb = getBoundingBox(node, opts);
    expect(bb.x + bb.width).toBeCloseTo(ins.x);
    expect(bb.y + bb.height).toBeCloseTo(ins.y);
  });
});

// ── layoutTextNode — full result ──────────────────────────────────────────────

describe('layoutTextNode', () => {
  it('returns paragraphs array with same length as node.paragraphs', () => {
    const para = makeParagraph([makeTextRun('p')]);
    const node = makeNode([para, para, para]);
    const result = layoutTextNode(node, makeOpts());
    expect(result.paragraphs).toHaveLength(3);
  });

  it('does not include columns when node has no column config', () => {
    const node = makeNode([makeParagraph([makeTextRun('text')])]);
    const result = layoutTextNode(node, makeOpts());
    expect(result.columns).toBeUndefined();
  });

  it('includes columns when node has column config and version >= R2007', () => {
    const node: DxfTextNode = {
      ...makeNode([makeParagraph([makeTextRun('col')]), makeParagraph([makeTextRun('umn')])]),
      columns: { type: 'static', count: 2, width: 100, gutter: 10 },
    };
    const opts = { ...makeOpts(), version: DxfDocumentVersion.R2007 };
    const result = layoutTextNode(node, opts);
    expect(result.columns).toBeDefined();
    expect(result.columns?.columns).toHaveLength(2);
  });

  it('omits columns for R12 documents even when column config present', () => {
    const node: DxfTextNode = {
      ...makeNode([makeParagraph([makeTextRun('r12')])]),
      columns: { type: 'static', count: 2, width: 100, gutter: 10 },
    };
    const opts = { ...makeOpts(), version: DxfDocumentVersion.R12 };
    const result = layoutTextNode(node, opts);
    expect(result.columns).toBeUndefined();
  });
});
