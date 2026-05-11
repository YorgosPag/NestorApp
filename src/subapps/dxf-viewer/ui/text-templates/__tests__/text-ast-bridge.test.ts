/**
 * ADR-344 Phase 7.D — Plain-text ↔ AST bridge tests.
 */
import {
  astToPlainText,
  plainTextToAst,
} from '../editor/text-ast-bridge';
import type {
  DxfTextNode,
  TextRunStyle,
} from '@/subapps/dxf-viewer/text-engine/types/text-ast.types';

const STYLE: TextRunStyle = {
  fontFamily: 'Arial',
  bold: false,
  italic: false,
  underline: false,
  overline: false,
  strikethrough: false,
  height: 12,
  widthFactor: 1,
  obliqueAngle: 0,
  tracking: 1,
  color: { kind: 'ByLayer' },
};

function makeAst(paragraphs: ReadonlyArray<ReadonlyArray<string>>): DxfTextNode {
  return {
    paragraphs: paragraphs.map((runs) => ({
      runs: runs.map((text) => ({ text, style: STYLE })),
      indent: 0,
      leftMargin: 0,
      rightMargin: 0,
      tabs: [],
      justification: 0,
      lineSpacingMode: 'multiple',
      lineSpacingFactor: 1,
    })),
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

describe('astToPlainText', () => {
  it('joins runs within a paragraph and lines with \\n', () => {
    const ast = makeAst([['Hello ', 'World'], ['Line two']]);
    expect(astToPlainText(ast)).toBe('Hello World\nLine two');
  });

  it('returns empty string for empty paragraphs list', () => {
    const ast = makeAst([]);
    expect(astToPlainText(ast)).toBe('');
  });
});

describe('plainTextToAst', () => {
  it('splits multiline text into paragraphs each with one default run', () => {
    const ast = plainTextToAst('first\nsecond');
    expect(ast.paragraphs).toHaveLength(2);
    expect(ast.paragraphs[0].runs).toHaveLength(1);
    expect(ast.paragraphs[1].runs).toHaveLength(1);
    const firstRun = ast.paragraphs[0].runs[0];
    if (!('text' in firstRun)) throw new Error('expected text run');
    expect(firstRun.text).toBe('first');
  });

  it('preserves placeholder tokens verbatim', () => {
    const ast = plainTextToAst('Project: {{project.name}}');
    const run = ast.paragraphs[0].runs[0];
    if (!('text' in run)) throw new Error('expected text run');
    expect(run.text).toBe('Project: {{project.name}}');
  });

  it('keeps base node attributes when seeded with an existing AST', () => {
    const seed = makeAst([['ignored']]);
    const base: DxfTextNode = { ...seed, rotation: 30, attachment: 'MC' };
    const ast = plainTextToAst('new content', base);
    expect(ast.rotation).toBe(30);
    expect(ast.attachment).toBe('MC');
  });
});

describe('roundtrip', () => {
  it('astToPlainText → plainTextToAst preserves text content', () => {
    const original = makeAst([['Hello World'], ['Second line']]);
    const text = astToPlainText(original);
    const rebuilt = plainTextToAst(text);
    expect(astToPlainText(rebuilt)).toBe(text);
  });
});
