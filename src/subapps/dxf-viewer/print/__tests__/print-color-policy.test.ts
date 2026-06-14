/**
 * ADR-454 — Print Plot Style policy tests.
 */
import {
  applyPlotColor,
  getPrintColorPolicy,
  setPrintColorPolicy,
  clearPrintColorPolicy,
  type PrintColorPolicy,
} from '../../config/print-color-policy';

const colour: PrintColorPolicy = { style: 'colour', dpi: 300 };
const monochrome: PrintColorPolicy = { style: 'monochrome', dpi: 300 };
const grayscale: PrintColorPolicy = { style: 'grayscale', dpi: 300 };
const byPen: PrintColorPolicy = { style: 'by-pen', dpi: 300 };

describe('applyPlotColor — colour (white-safe)', () => {
  it('remaps pure white → black', () => {
    expect(applyPlotColor('#FFFFFF', null, colour)).toBe('#000000');
    expect(applyPlotColor('#ffffff', null, colour)).toBe('#000000');
    expect(applyPlotColor('#FFF', null, colour)).toBe('#000000');
  });

  it('remaps near-white → black', () => {
    expect(applyPlotColor('#FAFAFA', null, colour)).toBe('#000000');
  });

  it('remaps ACI 7 (white pen) → black even when hex is non-white', () => {
    expect(applyPlotColor('#123456', 7, colour)).toBe('#000000');
  });

  it('remaps null (BIM neutral token) → black', () => {
    expect(applyPlotColor(null, null, colour)).toBe('#000000');
  });

  it('keeps non-white BIM category colours unchanged', () => {
    expect(applyPlotColor('#2f6690', null, colour)).toBe('#2f6690'); // column blue
    expect(applyPlotColor('#b07d1f', null, colour)).toBe('#b07d1f'); // beam amber
  });
});

describe('applyPlotColor — monochrome', () => {
  it('forces every colour to black', () => {
    expect(applyPlotColor('#2f6690', null, monochrome)).toBe('#000000');
    expect(applyPlotColor('#FFFFFF', null, monochrome)).toBe('#000000');
    expect(applyPlotColor(null, 42, monochrome)).toBe('#000000');
  });
});

describe('applyPlotColor — grayscale', () => {
  it('maps white / null → black (stay visible)', () => {
    expect(applyPlotColor('#FFFFFF', null, grayscale)).toBe('#000000');
    expect(applyPlotColor(null, null, grayscale)).toBe('#000000');
  });

  it('maps a colour to its luminance grey', () => {
    // pure red → 0.299 * 255 ≈ 76 → #4c4c4c
    expect(applyPlotColor('#FF0000', null, grayscale)).toBe('#4c4c4c');
    // pure green → 0.587 * 255 ≈ 150 → #969696
    expect(applyPlotColor('#00FF00', null, grayscale)).toBe('#969696');
  });

  it('produces an equal-channel grey', () => {
    const out = applyPlotColor('#2f6690', null, grayscale);
    const ch = out.slice(1).match(/.{2}/g)!;
    expect(ch[0]).toBe(ch[1]);
    expect(ch[1]).toBe(ch[2]);
  });
});

describe('applyPlotColor — by-pen (Slice 5 fallback === colour)', () => {
  it('behaves like colour until the CTB table lands', () => {
    expect(applyPlotColor('#FFFFFF', null, byPen)).toBe('#000000');
    expect(applyPlotColor('#2f6690', null, byPen)).toBe('#2f6690');
  });
});

describe('applyPlotColor — malformed input', () => {
  it('treats an unparseable hex as neutral → black', () => {
    expect(applyPlotColor('not-a-color', null, colour)).toBe('#000000');
  });
});

describe('print colour policy singleton', () => {
  afterEach(() => clearPrintColorPolicy());

  it('is null by default (interactive render untouched)', () => {
    expect(getPrintColorPolicy()).toBeNull();
  });

  it('set → get → clear round-trips', () => {
    setPrintColorPolicy(monochrome);
    expect(getPrintColorPolicy()).toEqual(monochrome);
    clearPrintColorPolicy();
    expect(getPrintColorPolicy()).toBeNull();
  });
});
