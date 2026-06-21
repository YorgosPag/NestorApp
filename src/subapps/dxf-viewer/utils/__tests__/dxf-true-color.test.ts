/**
 * DXF True-Color ↔ hex SSoT — ADR-507 Φ5.
 */

import { describe, it, expect } from '@jest/globals';
import { trueColorToHex, hexToTrueColor } from '../dxf-true-color';

describe('dxf-true-color', () => {
  it('trueColorToHex — RGB int → #RRGGBB uppercase', () => {
    expect(trueColorToHex(0xff0000)).toBe('#FF0000');
    expect(trueColorToHex(0x00ff00)).toBe('#00FF00');
    expect(trueColorToHex(0x0000ff)).toBe('#0000FF');
    expect(trueColorToHex(0x000000)).toBe('#000000');
    expect(trueColorToHex(0x1a2b3c)).toBe('#1A2B3C');
  });

  it('hexToTrueColor — #RRGGBB → RGB int', () => {
    expect(hexToTrueColor('#FF0000')).toBe(0xff0000);
    expect(hexToTrueColor('00ff00')).toBe(0x00ff00);
    expect(hexToTrueColor('#1a2b3c')).toBe(0x1a2b3c);
  });

  it('hexToTrueColor — shorthand #RGB → expanded', () => {
    expect(hexToTrueColor('#f00')).toBe(0xff0000);
    expect(hexToTrueColor('#abc')).toBe(0xaabbcc);
  });

  it('hexToTrueColor — invalid → 0', () => {
    expect(hexToTrueColor('not-a-color')).toBe(0);
    expect(hexToTrueColor('')).toBe(0);
  });

  it('roundtrip int → hex → int', () => {
    for (const n of [0x000000, 0xffffff, 0x123456, 0xabcdef, 0x808080]) {
      expect(hexToTrueColor(trueColorToHex(n))).toBe(n);
    }
  });
});
