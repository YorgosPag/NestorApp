/**
 * Tests — ADR-642 Φ3: the builtin linetype-symbol catalog.
 *
 * Asserts the seed Giorgio requested is present, ids are stable, geometry is valid
 * unit-space (within the [-0.5, 0.5] envelope), and unknown ids fall back to `cross`.
 */

import { describe, it, expect } from '@jest/globals';
import {
  LINETYPE_SYMBOL_CATALOG,
  DEFAULT_LINETYPE_SYMBOL_ID,
  getLinetypeSymbol,
  listLinetypeSymbols,
  listLinetypeSymbolIds,
} from '../linetype-symbol-catalog';

const SEED = ['cross', 'plus', 'asterisk', 'circle', 'square', 'tick', 'arrow', 'insulation', 'tree'];

describe('linetype-symbol-catalog — seed', () => {
  it('ships every requested builtin glyph', () => {
    for (const id of SEED) expect(LINETYPE_SYMBOL_CATALOG[id]).toBeDefined();
  });

  it('id matches its catalog key (stable references)', () => {
    for (const def of listLinetypeSymbols()) {
      expect(def.origin).toBe('builtin');
      expect(LINETYPE_SYMBOL_CATALOG[def.id]).toBe(def);
    }
  });

  it('lists ids in insertion order', () => {
    expect(listLinetypeSymbolIds()).toEqual(Object.keys(LINETYPE_SYMBOL_CATALOG));
  });

  it('every glyph carries at least one primitive', () => {
    for (const def of listLinetypeSymbols()) expect(def.geometry.length).toBeGreaterThan(0);
  });
});

describe('linetype-symbol-catalog — lookup', () => {
  it('resolves a known id', () => {
    expect(getLinetypeSymbol('arrow').id).toBe('arrow');
  });

  it('falls back to the default for an unknown id', () => {
    expect(getLinetypeSymbol('nope-shx-1234').id).toBe(DEFAULT_LINETYPE_SYMBOL_ID);
    expect(DEFAULT_LINETYPE_SYMBOL_ID).toBe('cross');
  });
});

describe('linetype-symbol-catalog — geometry envelope', () => {
  it('keeps all points within the unit [-0.6, 0.6] envelope (centred glyphs)', () => {
    const within = (v: number) => expect(Math.abs(v)).toBeLessThanOrEqual(0.6);
    for (const def of listLinetypeSymbols()) {
      for (const prim of def.geometry) {
        if (prim.kind === 'line') {
          within(prim.from[0]); within(prim.from[1]); within(prim.to[0]); within(prim.to[1]);
        } else if (prim.kind === 'polyline') {
          for (const [x, y] of prim.points) { within(x); within(y); }
        } else if (prim.kind === 'circle' || prim.kind === 'arc') {
          within(prim.center[0]); within(prim.center[1]); expect(prim.radius).toBeLessThanOrEqual(0.6);
        }
      }
    }
  });
});
