/**
 * ADR-635 Φ C.5 — per-entity FONT import (DXF group 7 → STYLE table → fontFamily).
 *
 * Proves the AutoCAD text-style→font wiring at IMPORT time:
 *   - `buildStyleFontMap` composes the ADR-344 STYLE parser SSoT (parseStyleTable +
 *     styleEntryDefaults) into a { styleName → fontFamily } map (fontFile ext stripped;
 *     empty fontFile → 'Standard'). NOT a second parser, NOT pre-substituted.
 *   - `convertText` reads group 7 → the map → the run-style fontFamily.
 *   - `convertMText` seeds the parser base run style with the STYLE font (inline `\f`
 *     overrides still win).
 *   - Gate: no group 7 / unknown style → '' (TEXT) or the parser 'Standard' default (MTEXT) —
 *     native/Tekton/bare text unchanged (zero regression).
 *   - `DxfSceneBuilder` end-to-end: a STYLE table + a TEXT with group 7 → the entity's
 *     textNode carries the resolved font family.
 *
 * The SHX→web-font substitution (romans → Liberation Sans) is the render font-resolver's job
 * (`resolveEntityFont`, tested under text-engine) — here we only assert the imported style name
 * reaches the entity's run style as the raw stripped family.
 */

import { describe, it, expect } from '@jest/globals';
import type { AnySceneEntity } from '../../types/scene';
import type { DxfTextNode } from '../../text-engine/types';
import { convertEntityToScene, type EntityData } from '../dxf-entity-converters';
import { buildStyleFontMap } from '../../text-engine/parser';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import type { StyleFontMap } from '../dxf-parser-types';

/** Extract the first run's fontFamily from a converted text entity's textNode. */
function fontOf(entity: AnySceneEntity | AnySceneEntity[] | null): string | undefined {
  const e = Array.isArray(entity) ? entity[0] : entity;
  const node = (e as { textNode?: DxfTextNode } | null)?.textNode;
  return node?.paragraphs[0]?.runs[0]?.style.fontFamily;
}

/** Minimal well-formed TEXT entity data (pos 10/20, height 40, content 1). */
function textData(extra: Record<string, string>): EntityData {
  return { type: 'TEXT', layer: '0', data: { '10': '0', '20': '0', '40': '2.5', '1': 'Hello', ...extra } };
}

/** Minimal well-formed MTEXT entity data (adds attachment 71). */
function mtextData(extra: Record<string, string>): EntityData {
  return { type: 'MTEXT', layer: '0', data: { '10': '0', '20': '0', '40': '2.5', '1': 'Hello', '71': '1', ...extra } };
}

const STYLE_FONTS: StyleFontMap = { MyStyle: 'romans', Titles: 'txt', Standard: 'Standard' };

describe('buildStyleFontMap — STYLE table → { name → fontFamily }', () => {
  const dxf = [
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'STYLE',
    '70', '2',
    '0', 'STYLE',
    '2', 'MyStyle',
    '3', 'romans.shx',
    '40', '0',
    '41', '1',
    '50', '0',
    '70', '0',
    '71', '0',
    '0', 'STYLE',
    '2', 'Empty',
    '3', '',
    '40', '0',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'EOF',
  ].join('\n');

  it('maps a style name to its font file with the extension stripped', () => {
    const map = buildStyleFontMap(dxf);
    expect(map['MyStyle']).toBe('romans');
  });

  it('maps an empty fontFile to the AutoCAD Standard default (never left blank)', () => {
    const map = buildStyleFontMap(dxf);
    expect(map['Empty']).toBe('Standard');
  });

  it('returns an empty map when no STYLE table is present', () => {
    expect(buildStyleFontMap('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF')).toEqual({});
  });
});

describe('convertText — group 7 → STYLE font (router SSoT)', () => {
  it('sets the run fontFamily from a known text-style name (group 7)', () => {
    const entity = convertEntityToScene(textData({ '7': 'MyStyle' }), 0, undefined, undefined, STYLE_FONTS);
    expect(fontOf(entity)).toBe('romans');
  });

  it('leaves fontFamily empty when group 7 is absent (native/Tekton gate)', () => {
    const entity = convertEntityToScene(textData({}), 0, undefined, undefined, STYLE_FONTS);
    expect(fontOf(entity)).toBe('');
  });

  it('leaves fontFamily empty for an unknown style name (not in the map)', () => {
    const entity = convertEntityToScene(textData({ '7': 'Ghost' }), 0, undefined, undefined, STYLE_FONTS);
    expect(fontOf(entity)).toBe('');
  });

  it('leaves fontFamily empty when no styleFonts map is threaded at all', () => {
    const entity = convertEntityToScene(textData({ '7': 'MyStyle' }), 0);
    expect(fontOf(entity)).toBe('');
  });
});

describe('convertMText — group 7 seeds the base run font', () => {
  it('seeds the base run style with the STYLE font for a known style', () => {
    const entity = convertEntityToScene(mtextData({ '7': 'Titles' }), 0, undefined, undefined, STYLE_FONTS);
    expect(fontOf(entity)).toBe('txt');
  });

  it('keeps the parser Standard default when group 7 is absent (unchanged behaviour)', () => {
    const entity = convertEntityToScene(mtextData({}), 0, undefined, undefined, STYLE_FONTS);
    expect(fontOf(entity)).toBe('Standard');
  });

  it('keeps the Standard default for an unknown style name (gate → no seed)', () => {
    const entity = convertEntityToScene(mtextData({ '7': 'Ghost' }), 0, undefined, undefined, STYLE_FONTS);
    expect(fontOf(entity)).toBe('Standard');
  });
});

describe('DxfSceneBuilder — STYLE pre-pass wires font to imported TEXT end-to-end', () => {
  it('resolves a TEXT entity group 7 to the drawing STYLE font family', () => {
    const dxf = [
      '0', 'SECTION',
      '2', 'TABLES',
      '0', 'TABLE',
      '2', 'STYLE',
      '70', '1',
      '0', 'STYLE',
      '2', 'ArchText',
      '3', 'simplex.shx',
      '40', '0',
      '0', 'ENDTAB',
      '0', 'ENDSEC',
      '0', 'SECTION',
      '2', 'ENTITIES',
      '0', 'TEXT',
      '8', '0',
      '7', 'ArchText',
      '10', '0',
      '20', '0',
      '40', '2.5',
      '1', 'Hello',
      '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n');

    const scene = DxfSceneBuilder.buildScene(dxf, 'mm');
    const text = scene.entities.find((e) => e.type === 'text');
    expect(text).toBeDefined();
    expect(fontOf(text ?? null)).toBe('simplex');
  });
});
