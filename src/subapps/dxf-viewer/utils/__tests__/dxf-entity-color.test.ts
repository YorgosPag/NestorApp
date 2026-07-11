/**
 * ADR-635 Φ C.2 — entity color extraction: true-color (420) precedence + BYBLOCK detection.
 *
 * Proves the AutoCAD color cascade at import time:
 *   - group code 420 (24-bit RGB) WINS over the ACI index (code 62)
 *   - BYBLOCK (62=0) is told apart from ByLayer/no-color for INSERT inheritance
 */

import { describe, it, expect } from '@jest/globals';
import { extractEntityColor, isByBlockColor } from '../dxf-converter-helpers';
import { getAciColor } from '../../settings/standards/aci';

describe('extractEntityColor — true-color (420)', () => {
  it('reads 24-bit RGB from code 420 → #RRGGBB', () => {
    expect(extractEntityColor({ '420': String(0xff0000) })).toBe('#FF0000');
    expect(extractEntityColor({ '420': String(0x00ff00) })).toBe('#00FF00');
    expect(extractEntityColor({ '420': String(0x0000ff) })).toBe('#0000FF');
    expect(extractEntityColor({ '420': String(0x1a2b3c) })).toBe('#1A2B3C');
  });

  it('420 WINS over ACI 62 when both present (AutoCAD rule)', () => {
    // 62=5 is ACI blue, but the explicit true-color red must win.
    expect(extractEntityColor({ '420': String(0xff0000), '62': '5' })).toBe('#FF0000');
  });

  it('masks a method-byte-prefixed 420 value to its low 24 bits', () => {
    // Some writers emit 0xC2000000 | RGB — the RGB must still be recovered.
    expect(extractEntityColor({ '420': String(0xc20000ff) })).toBe('#0000FF');
  });

  it('falls back to ACI 62 when 420 is not a finite number', () => {
    expect(extractEntityColor({ '420': 'not-a-number', '62': '1' })).toBe(getAciColor(1));
  });
});

describe('extractEntityColor — ACI (62)', () => {
  it('resolves a valid ACI index via the palette SSoT', () => {
    expect(extractEntityColor({ '62': '1' })).toBe(getAciColor(1));
    expect(extractEntityColor({ '62': '255' })).toBe(getAciColor(255));
  });

  it('returns undefined for BYBLOCK (0), BYLAYER (256) and no color', () => {
    expect(extractEntityColor({ '62': '0' })).toBeUndefined();
    expect(extractEntityColor({ '62': '256' })).toBeUndefined();
    expect(extractEntityColor({})).toBeUndefined();
  });

  it('returns undefined for a non-numeric / out-of-range index', () => {
    expect(extractEntityColor({ '62': 'xx' })).toBeUndefined();
    expect(extractEntityColor({ '62': '999' })).toBeUndefined();
  });
});

describe('isByBlockColor', () => {
  it('true only for an explicit BYBLOCK (62=0)', () => {
    expect(isByBlockColor({ '62': '0' })).toBe(true);
  });

  it('false for ByLayer, no color, and an explicit ACI index', () => {
    expect(isByBlockColor({ '62': '256' })).toBe(false);
    expect(isByBlockColor({})).toBe(false);
    expect(isByBlockColor({ '62': '1' })).toBe(false);
  });

  it('false when an explicit true-color (420) overrides BYBLOCK', () => {
    expect(isByBlockColor({ '62': '0', '420': String(0x0000ff) })).toBe(false);
  });
});
