/**
 * canvas-pill.ts — contrastTextColor unit tests.
 *
 * Verifies WCAG 1.4.3 switching: dark text on light backgrounds,
 * white text on dark backgrounds, and fallback on unparseable input.
 */

import { contrastTextColor, PILL_TEXT_COLOR } from '../canvas-pill';

describe('contrastTextColor', () => {
  describe('rgba inputs', () => {
    it('white background → dark text (PILL_TEXT_COLOR)', () => {
      expect(contrastTextColor('rgba(255,255,255,0.88)')).toBe(PILL_TEXT_COLOR);
    });
    it('black background → white text', () => {
      expect(contrastTextColor('rgba(0,0,0,1)')).toBe('#ffffff');
    });
    it('dark navy → white text', () => {
      expect(contrastTextColor('rgba(0,51,102,1)')).toBe('#ffffff');
    });
    it('light gray → dark text', () => {
      expect(contrastTextColor('rgba(240,240,240,1)')).toBe(PILL_TEXT_COLOR);
    });
    it('mid-gray (L≈0.216) → dark text', () => {
      // rgb(128,128,128) → L ≈ 0.216 > 0.179 → dark text
      expect(contrastTextColor('rgba(128,128,128,1)')).toBe(PILL_TEXT_COLOR);
    });
    it('dark gray (rgb 60,60,60) → white text', () => {
      // L ≈ 0.049 < 0.179 → white text
      expect(contrastTextColor('rgba(60,60,60,1)')).toBe('#ffffff');
    });
  });

  describe('hex inputs', () => {
    it('#ffffff → dark text', () => {
      expect(contrastTextColor('#ffffff')).toBe(PILL_TEXT_COLOR);
    });
    it('#000000 → white text', () => {
      expect(contrastTextColor('#000000')).toBe('#ffffff');
    });
    it('#fff (short) → dark text', () => {
      expect(contrastTextColor('#fff')).toBe(PILL_TEXT_COLOR);
    });
    it('#000 (short) → white text', () => {
      expect(contrastTextColor('#000')).toBe('#ffffff');
    });
    it('#1a2b3c (dark) → white text', () => {
      expect(contrastTextColor('#1a2b3c')).toBe('#ffffff');
    });
    it('#e8f4f8 (very light blue) → dark text', () => {
      expect(contrastTextColor('#e8f4f8')).toBe(PILL_TEXT_COLOR);
    });
  });

  describe('fallback', () => {
    it('unparseable string → PILL_TEXT_COLOR fallback', () => {
      expect(contrastTextColor('not-a-color')).toBe(PILL_TEXT_COLOR);
    });
    it('empty string → PILL_TEXT_COLOR fallback', () => {
      expect(contrastTextColor('')).toBe(PILL_TEXT_COLOR);
    });
  });
});
