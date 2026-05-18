/**
 * ADR-362 Phase N1 — dim-text-field-parser unit tests.
 *
 * Coverage:
 *   parseFieldAST:
 *     - empty input → single Literal('')
 *     - '<>' → MeasurementPlaceholder
 *     - '<tokenName>' → FieldToken for all 12 known tokens
 *     - '<UNKNOWN>' → Literal (unknown token, not in FIELD_TOKEN_NAMES)
 *     - '$(op,a,b)' → DieselExpr with raw preserved
 *     - nested DIESEL: '$(if,$(+,1,2),a,b)' → single DieselExpr
 *     - mixed: 'PREFIX<>SUFFIX' → [Literal, Measurement, Literal]
 *     - mixed: '<length> mm' → [FieldToken, Literal]
 *     - multiple tokens: '<date> – <time>'
 *     - unclosed '<' → Literal (no valid token)
 *     - '<>' adjacent to text on both sides
 *   hasFieldSyntax:
 *     - plain text → false
 *     - '<>' → true
 *     - '<length>' → true
 *     - '$(+,1,2)' → true
 *   extractFieldNodes:
 *     - filters Literal nodes, keeps Field + Diesel + Measurement
 */

import {
  parseFieldAST,
  hasFieldSyntax,
  extractFieldNodes,
  FIELD_TOKEN_NAMES,
  type FieldNode,
  type FieldAST,
} from '../dim-text-field-parser';

// ── Helpers ───────────────────────────────────────────────────────────────────

function literal(text: string): FieldNode { return { kind: 'literal', text }; }
const measurement: FieldNode = { kind: 'measurement' };
function field(name: (typeof FIELD_TOKEN_NAMES)[number]): FieldNode {
  return { kind: 'field', name };
}
function diesel(raw: string): FieldNode { return { kind: 'diesel', raw }; }

// ── parseFieldAST ─────────────────────────────────────────────────────────────

describe('parseFieldAST', () => {
  it('empty string → single Literal("")', () => {
    expect(parseFieldAST('')).toEqual([literal('')]);
  });

  it('"<>" → MeasurementPlaceholder', () => {
    expect(parseFieldAST('<>')).toEqual([measurement]);
  });

  it('"<length>" → FieldToken length', () => {
    expect(parseFieldAST('<length>')).toEqual([field('length')]);
  });

  it('"<AREA>" → FieldToken area (case-insensitive)', () => {
    expect(parseFieldAST('<AREA>')).toEqual([field('area')]);
  });

  it('recognises all 12 known tokens', () => {
    for (const name of FIELD_TOKEN_NAMES) {
      const ast = parseFieldAST(`<${name}>`);
      expect(ast).toEqual([field(name)]);
    }
  });

  it('"<unknown>" → Literal (not in FIELD_TOKEN_NAMES)', () => {
    const ast = parseFieldAST('<unknown>');
    expect(ast).toEqual([literal('<unknown>')]);
  });

  it('"$(+,1,2)" → DieselExpr with full raw', () => {
    const ast = parseFieldAST('$(+,1,2)');
    expect(ast).toEqual([diesel('$(+,1,2)')]);
  });

  it('nested DIESEL "$(if,$(+,1,2),a,b)" → single DieselExpr', () => {
    const raw = '$(if,$(+,1,2),a,b)';
    const ast = parseFieldAST(raw);
    expect(ast).toEqual([diesel(raw)]);
  });

  it('"PREFIX<>SUFFIX" → [Literal, Measurement, Literal]', () => {
    expect(parseFieldAST('PREFIX<>SUFFIX')).toEqual([
      literal('PREFIX'),
      measurement,
      literal('SUFFIX'),
    ]);
  });

  it('"<length> mm" → [FieldToken, Literal]', () => {
    expect(parseFieldAST('<length> mm')).toEqual([
      field('length'),
      literal(' mm'),
    ]);
  });

  it('"= <area> m²" → [Literal, FieldToken, Literal]', () => {
    expect(parseFieldAST('= <area> m²')).toEqual([
      literal('= '),
      field('area'),
      literal(' m²'),
    ]);
  });

  it('"<date> – <time>" → [FieldToken, Literal, FieldToken]', () => {
    expect(parseFieldAST('<date> – <time>')).toEqual([
      field('date'),
      literal(' – '),
      field('time'),
    ]);
  });

  it('"<>" at start and end with text in middle', () => {
    expect(parseFieldAST('<>mm<>')).toEqual([
      measurement,
      literal('mm'),
      measurement,
    ]);
  });

  it('unclosed "<x" without ">" → treated as Literal', () => {
    const ast = parseFieldAST('hello <x');
    expect(ast).toEqual([literal('hello <x')]);
  });

  it('"<x>" where "x" is single char unknown → Literal', () => {
    const ast = parseFieldAST('<z>');
    expect(ast).toEqual([literal('<z>')]);
  });

  it('DIESEL expression mixed with text: "Area: $(+,2,3) sqm"', () => {
    expect(parseFieldAST('Area: $(+,2,3) sqm')).toEqual([
      literal('Area: '),
      diesel('$(+,2,3)'),
      literal(' sqm'),
    ]);
  });

  it('plain text with no tokens → single Literal', () => {
    expect(parseFieldAST('hello world')).toEqual([literal('hello world')]);
  });
});

// ── hasFieldSyntax ────────────────────────────────────────────────────────────

describe('hasFieldSyntax', () => {
  it('plain text → false', () => {
    expect(hasFieldSyntax('hello world')).toBe(false);
  });

  it('"<>" → true', () => {
    expect(hasFieldSyntax('<>')).toBe(true);
  });

  it('"<length>" → true', () => {
    expect(hasFieldSyntax('<length>')).toBe(true);
  });

  it('"$(+,1,2)" → true', () => {
    expect(hasFieldSyntax('$(+,1,2)')).toBe(true);
  });

  it('text with embedded field → true', () => {
    expect(hasFieldSyntax('Total: <area> m²')).toBe(true);
  });
});

// ── extractFieldNodes ─────────────────────────────────────────────────────────

describe('extractFieldNodes', () => {
  it('pure literal AST → empty array', () => {
    const ast: FieldAST = [literal('hello')];
    expect(extractFieldNodes(ast)).toEqual([]);
  });

  it('mixed AST → only non-literal nodes', () => {
    const ast: FieldAST = [
      literal('A'),
      measurement,
      literal('B'),
      field('length'),
      diesel('$(+,1,2)'),
    ];
    expect(extractFieldNodes(ast)).toEqual([
      measurement,
      field('length'),
      diesel('$(+,1,2)'),
    ]);
  });
});
