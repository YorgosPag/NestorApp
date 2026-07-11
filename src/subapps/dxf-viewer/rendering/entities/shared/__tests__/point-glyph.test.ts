/**
 * ADR-635 Φάση C — $PDMODE / $PDSIZE decode SSoT.
 */
import { decodePdMode, resolvePointGlyphSize } from '../point-glyph';

describe('decodePdMode (ADR-635 Φάση C)', () => {
  it('χαρτογραφεί τα base figures (low 3 bits)', () => {
    expect(decodePdMode(0).figure).toBe('dot');
    expect(decodePdMode(1).figure).toBe('none');
    expect(decodePdMode(2).figure).toBe('plus');
    expect(decodePdMode(3).figure).toBe('cross');
    expect(decodePdMode(4).figure).toBe('tick');
  });

  it('bit 32 → circle, bit 64 → square (χωρίς να αλλάζει το figure)', () => {
    expect(decodePdMode(32)).toEqual({ figure: 'dot', circle: true, square: false });
    expect(decodePdMode(64)).toEqual({ figure: 'dot', circle: false, square: true });
    // 35 = 3 (X) + 32 (circle) → X-in-circle
    expect(decodePdMode(35)).toEqual({ figure: 'cross', circle: true, square: false });
    // 98 = 2 (plus) + 32 (circle) + 64 (square)
    expect(decodePdMode(98)).toEqual({ figure: 'plus', circle: true, square: true });
    // 96 = dot + circle + square
    expect(decodePdMode(96)).toEqual({ figure: 'dot', circle: true, square: true });
  });

  it('άγνωστα low bits (5-7) → dot fallback', () => {
    expect(decodePdMode(5).figure).toBe('dot');
    expect(decodePdMode(7).figure).toBe('dot');
  });
});

describe('resolvePointGlyphSize (ADR-635 Φάση C)', () => {
  it('pdSize > 0 → drawing units × pxPerWorld', () => {
    expect(resolvePointGlyphSize(10, 3, 800)).toBe(30);
  });

  it('pdSize = 0 → 5% του viewport height', () => {
    expect(resolvePointGlyphSize(0, 3, 800)).toBe(40);
  });

  it('pdSize < 0 → |pdSize|% του viewport height', () => {
    expect(resolvePointGlyphSize(-10, 3, 800)).toBe(80);
  });
});
