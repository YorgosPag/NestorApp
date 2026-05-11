/**
 * ADR-344 Phase 7.A — extract-placeholders unit tests.
 */

import { extractPlaceholders, extractPlaceholdersFromString } from '../extract-placeholders';
import { makeNode, makeParagraph, makeRun } from '../defaults/template-helpers';
import { DXF_COLOR_BY_LAYER } from '../../types/text-toolbar.types';
import type { TextRunStyle, TextStack } from '../../types/text-ast.types';

const STYLE: TextRunStyle = {
  fontFamily: 'Arial',
  bold: false,
  italic: false,
  underline: false,
  overline: false,
  strikethrough: false,
  height: 2.5,
  widthFactor: 1.0,
  obliqueAngle: 0,
  tracking: 1.0,
  color: DXF_COLOR_BY_LAYER,
};

describe('extractPlaceholdersFromString', () => {
  it('returns empty array when no placeholders', () => {
    expect(extractPlaceholdersFromString('plain text')).toEqual([]);
  });

  it('extracts a single placeholder', () => {
    expect(extractPlaceholdersFromString('Hello {{user.name}}')).toEqual(['user.name']);
  });

  it('extracts multiple placeholders in source order', () => {
    expect(extractPlaceholdersFromString('{{a.b}} and {{c.d}} and {{a.b}}')).toEqual(['a.b', 'c.d', 'a.b']);
  });

  it('tolerates whitespace inside braces', () => {
    expect(extractPlaceholdersFromString('{{  project.name  }}')).toEqual(['project.name']);
  });

  it('requires a dot-separated path (single-segment is rejected)', () => {
    expect(extractPlaceholdersFromString('{{single}}')).toEqual([]);
  });

  it('supports deep paths', () => {
    expect(extractPlaceholdersFromString('{{a.b.c.d}}')).toEqual(['a.b.c.d']);
  });

  it('rejects malformed brace forms', () => {
    expect(extractPlaceholdersFromString('{{a.b')).toEqual([]);
    expect(extractPlaceholdersFromString('a.b}}')).toEqual([]);
    expect(extractPlaceholdersFromString('{a.b}')).toEqual([]);
  });

  it('resets regex state between calls', () => {
    expect(extractPlaceholdersFromString('{{x.y}}')).toEqual(['x.y']);
    expect(extractPlaceholdersFromString('{{x.y}}')).toEqual(['x.y']);
  });
});

describe('extractPlaceholders (DxfTextNode)', () => {
  it('empty node → empty array', () => {
    const node = makeNode([makeParagraph([])]);
    expect(extractPlaceholders(node)).toEqual([]);
  });

  it('plain text node → empty array', () => {
    const node = makeNode([makeParagraph([makeRun('Hello world', STYLE)])]);
    expect(extractPlaceholders(node)).toEqual([]);
  });

  it('extracts unique placeholders across paragraphs and runs', () => {
    const node = makeNode([
      makeParagraph([makeRun('Hello {{user.name}}', STYLE)]),
      makeParagraph([
        makeRun('Project: {{project.name}}', STYLE),
        makeRun(' / {{user.name}}', STYLE),
      ]),
    ]);
    expect(extractPlaceholders(node)).toEqual(['project.name', 'user.name']);
  });

  it('returns sorted output', () => {
    const node = makeNode([
      makeParagraph([
        makeRun('{{z.a}} {{a.z}} {{m.m}}', STYLE),
      ]),
    ]);
    expect(extractPlaceholders(node)).toEqual(['a.z', 'm.m', 'z.a']);
  });

  it('scans TextStack top and bottom', () => {
    const stack: TextStack = {
      top: 'Rev {{revision.number}}',
      bottom: '{{revision.date}}',
      type: 'horizontal',
      style: { fontFamily: 'Arial', height: 2.5, color: DXF_COLOR_BY_LAYER },
    };
    const node = makeNode([makeParagraph([stack])]);
    expect(extractPlaceholders(node)).toEqual(['revision.date', 'revision.number']);
  });
});
