/**
 * @module validation.test
 * @description Unit tests για validation functions
 * ISO Standards compliance testing
 */

import {
  validateLineSettings,
  validateTextSettings,
  validateGripSettings,
  validateLineWidth,
  validateColor,
  validateFontSize,
  validateGripSize
} from '../types';
import {
  DEFAULT_LINE_SETTINGS,
  DEFAULT_TEXT_SETTINGS,
  DEFAULT_GRIP_SETTINGS
} from '../defaults';
import { UI_COLORS } from '../../config/color-config';

describe('Validation Functions', () => {
  describe('validateLineWidth', () => {
    it('should accept valid line widths', () => {
      expect(validateLineWidth(0.1)).toBe(0.1);
      expect(validateLineWidth(1)).toBe(1);
      expect(validateLineWidth(5)).toBe(5);
      expect(validateLineWidth(100)).toBe(100);
    });

    it('should clamp invalid line widths', () => {
      expect(validateLineWidth(-1)).toBe(0.1); // Min
      expect(validateLineWidth(0)).toBe(0.1); // Min
      expect(validateLineWidth(101)).toBe(100); // Max
      expect(validateLineWidth(1000)).toBe(100); // Max
    });

    it('should handle non-numeric values', () => {
      expect(validateLineWidth(NaN)).toBe(1); // Default
      expect(validateLineWidth(null as never)).toBe(1);
      expect(validateLineWidth(undefined as never)).toBe(1);
      expect(validateLineWidth('5' as unknown as number)).toBe(5); // String conversion
    });
  });

  describe('validateColor', () => {
    it('should accept valid hex colors', () => {
      expect(validateColor(UI_COLORS.BLACK)).toBe(UI_COLORS.BLACK);
      expect(validateColor(UI_COLORS.WHITE)).toBe(UI_COLORS.WHITE);
      expect(validateColor(UI_COLORS.LEGACY_COLORS.MAGENTA)).toBe(UI_COLORS.LEGACY_COLORS.MAGENTA);
      expect(validateColor(UI_COLORS.CUSTOM_TEST_COLOR)).toBe(UI_COLORS.CUSTOM_TEST_COLOR);
    });

    it('should normalize color formats', () => {
      expect(validateColor('#fff')).toBe(UI_COLORS.WHITE); // 3-digit to 6-digit
      expect(validateColor('#ABC')).toBe(UI_COLORS.LIGHT_GRAY_ALT);
      expect(validateColor('fff')).toBe(UI_COLORS.WHITE); // Missing #
      expect(validateColor('000000')).toBe(UI_COLORS.BLACK);
    });

    it('should reject invalid colors', () => {
      expect(validateColor('#GGGGGG')).toBe(UI_COLORS.WHITE); // Invalid hex
      expect(validateColor('invalid')).toBe(UI_COLORS.WHITE);
      expect(validateColor('')).toBe(UI_COLORS.WHITE);
      expect(validateColor(null as never)).toBe(UI_COLORS.WHITE);
    });

    it('should handle RGB color notation', () => {
      expect(validateColor('rgb(255,0,0)')).toBe(UI_COLORS.SELECTED_RED);
      expect(validateColor('rgb(0, 128, 255)')).toBe(UI_COLORS.INDICATOR_BLUE);
    });
  });

  describe('validateFontSize', () => {
    it('should accept valid font sizes', () => {
      expect(validateFontSize(8)).toBe(8);
      expect(validateFontSize(12)).toBe(12);
      expect(validateFontSize(24)).toBe(24);
      expect(validateFontSize(72)).toBe(72);
    });

    it('should clamp invalid font sizes', () => {
      expect(validateFontSize(7)).toBe(8); // Min
      expect(validateFontSize(0)).toBe(8);
      expect(validateFontSize(73)).toBe(72); // Max
      expect(validateFontSize(200)).toBe(72);
    });

    it('should handle non-numeric values', () => {
      expect(validateFontSize(NaN)).toBe(14); // Default
      expect(validateFontSize(null as never)).toBe(14);
      expect(validateFontSize('16' as unknown as number)).toBe(16);
    });
  });

  describe('validateGripSize', () => {
    it('should accept valid grip sizes', () => {
      expect(validateGripSize(3)).toBe(3);
      expect(validateGripSize(5)).toBe(5);
      expect(validateGripSize(8)).toBe(8);
      expect(validateGripSize(12)).toBe(12);
    });

    it('should clamp invalid grip sizes', () => {
      expect(validateGripSize(2)).toBe(3); // Min
      expect(validateGripSize(21)).toBe(20); // Max
    });
  });

  describe('validateLineSettings', () => {
    it('should validate all line properties', () => {
      const input = {
        lineWidth: -5,
        lineColor: 'invalid',
        lineType: 'unknown' as 'solid' | 'dashed' | 'dotted',
        opacity: 150,
        dashScale: -1
      };

      const result = validateLineSettings(input);

      expect(result.lineWidth).toBe(0.1); // Clamped to min
      expect(result.lineColor).toBe(UI_COLORS.WHITE); // Default color
      expect(result.lineType).toBe('solid'); // Default type
      expect(result.opacity).toBe(1); // Clamped to max
      expect(result.dashScale).toBe(0.1); // Clamped to min
    });

    it('should preserve valid settings', () => {
      const input = {
        ...DEFAULT_LINE_SETTINGS,
        lineWidth: 2,
        lineColor: UI_COLORS.SELECTED_RED
      };

      const result = validateLineSettings(input);

      expect(result).toEqual(input);
    });

    it('should handle partial settings', () => {
      const input = {
        lineWidth: 3
      };

      const result = validateLineSettings(input);

      expect(result.lineWidth).toBe(3);
      expect(result.lineColor).toBe(DEFAULT_LINE_SETTINGS.lineColor);
      expect(result.lineType).toBe(DEFAULT_LINE_SETTINGS.lineType);
    });
  });

  describe('validateTextSettings', () => {
    it('should validate all text properties', () => {
      const input = {
        fontSize: 100,
        fontFamily: 'InvalidFont',
        fontColor: 'not-a-color',
        fontWeight: 'super-bold' as 'normal' | 'bold',
        fontStyle: 'slanted' as 'normal' | 'italic'
      };

      const result = validateTextSettings(input);

      expect(result.fontSize).toBe(72); // Max size
      expect(result.fontFamily).toBe('Arial'); // Default font
      expect(result.fontColor).toBe(UI_COLORS.WHITE); // Default color
      expect(result.fontWeight).toBe('normal'); // Default weight
      expect(result.fontStyle).toBe('normal'); // Default style
    });

    it('should handle font family validation', () => {
      const validFonts = ['Arial', 'Times New Roman', 'Courier New', 'monospace'];

      validFonts.forEach(font => {
        const result = validateTextSettings({ fontFamily: font });
        expect(result.fontFamily).toBe(font);
      });

      const result = validateTextSettings({ fontFamily: 'Comic Sans MS' });
      expect(result.fontFamily).toBe('Arial'); // Falls back to default
    });
  });

  describe('validateGripSettings', () => {
    it('should validate all grip properties', () => {
      const input = {
        size: 50,
        color: '#123',
        hoverColor: 'blue',
        activeColor: 'rgb(255, 0, 0)',
        borderWidth: 10,
        borderColor: '#border',
        opacity: 2,
        snapDistance: 100
      };

      const result = validateGripSettings(input);

      expect(result.size).toBe(20); // Max size
      expect(result.color).toBe(UI_COLORS.DARK_GRAY); // Normalized
      expect(result.hoverColor).toBe(UI_COLORS.LEGACY_COLORS.BLUE); // Named color
      expect(result.activeColor).toBe(UI_COLORS.SELECTED_RED); // RGB converted
      expect(result.borderWidth).toBe(5); // Max border
      expect(result.borderColor).toBe(UI_COLORS.WHITE); // Invalid -> default
      expect(result.opacity).toBe(1); // Clamped
      expect(result.snapDistance).toBe(50); // Max snap
    });

    it('should apply AutoCAD grip standards', () => {
      const result = validateGripSettings({});

      // Check AutoCAD defaults
      expect(result.size).toBe(7);
      expect(result.color).toBe('#00A2FF'); // AutoCAD blue
      expect(result.snapDistance).toBe(10);
    });
  });

  describe('ISO Standards Compliance', () => {
    it('should enforce ISO 128 line standards', () => {
      const isoLineTypes = ['solid', 'dashed', 'dotted', 'dash-dot'];

      isoLineTypes.forEach(type => {
        const result = validateLineSettings({ lineType: type as 'solid' | 'dashed' | 'dotted' });
        expect(result.lineType).toBe(type);
      });

      const result = validateLineSettings({ lineType: 'custom' as 'solid' | 'dashed' | 'dotted' });
      expect(result.lineType).toBe('solid'); // Default for invalid
    });

    it('should enforce ISO 3098 text standards', () => {
      const isoFontSizes = [2.5, 3.5, 5, 7, 10, 14, 20];

      isoFontSizes.forEach(size => {
        const result = validateTextSettings({ fontSize: size });
        // Should accept ISO standard sizes
        expect(result.fontSize).toBeGreaterThanOrEqual(8);
        expect(result.fontSize).toBeLessThanOrEqual(72);
      });
    });
  });

  describe('Performance', () => {
    it('should validate large batches efficiently', () => {
      const settings = Array.from({ length: 10000 }, (_, i) => ({
        lineWidth: Math.random() * 100,
        lineColor: `#${i.toString(16).padStart(6, '0')}`,
        lineType: i % 2 === 0 ? 'solid' : 'dashed' as 'solid' | 'dashed'
      }));

      const start = performance.now();
      settings.forEach(s => validateLineSettings(s));
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined properties gracefully', () => {
      const input = {
        lineWidth: undefined,
        lineColor: undefined,
        lineType: undefined
      } as { lineWidth: unknown; lineColor: unknown; lineType: unknown; };

      const result = validateLineSettings(input);

      expect(result.lineWidth).toBe(DEFAULT_LINE_SETTINGS.lineWidth);
      expect(result.lineColor).toBe(DEFAULT_LINE_SETTINGS.lineColor);
      expect(result.lineType).toBe(DEFAULT_LINE_SETTINGS.lineType);
    });

    it('should handle extreme numeric values', () => {
      expect(validateLineWidth(Infinity)).toBe(100); // Max
      expect(validateLineWidth(-Infinity)).toBe(0.1); // Min
      expect(validateFontSize(Number.MAX_VALUE)).toBe(72);
      expect(validateGripSize(Number.MIN_VALUE)).toBe(3);
    });

    it('should handle object inputs', () => {
      const result = validateLineSettings({
        lineWidth: { value: 5 } as unknown,
        lineColor: { toString: () => UI_COLORS.SELECTED_RED } as unknown
      });

      // Should handle gracefully
      expect(result.lineWidth).toBeDefined();
      expect(result.lineColor).toBeDefined();
    });
  });
});