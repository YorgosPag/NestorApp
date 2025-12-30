/**
 * @module override.test
 * @description Unit tests για το Override Engine
 * Critical για conference - ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ
 */

import { describe, it, expect } from '@jest/globals';
import {
  mergeSettings,
  mergeDxfSettings,
  diffSettings,
  extractOverrides,
  hasOverrides,
  cleanEmptyOverrides,
  applyOverridesToBase
} from '../override';
import {
  DEFAULT_LINE_SETTINGS,
  DEFAULT_TEXT_SETTINGS,
  DEFAULT_GRIP_SETTINGS,
  DEFAULT_DXF_SETTINGS
} from '../defaults';
import { UI_COLORS } from '../../config/color-config';
import type { PartialDxfSettings } from '../types';

describe('Override Engine', () => {
  describe('mergeSettings', () => {
    it('should return base when no override', () => {
      const base = DEFAULT_LINE_SETTINGS;
      const result = mergeSettings(base, undefined);

      expect(result).toBe(base); // Same reference
    });

    it('should merge override into base', () => {
      const base = DEFAULT_LINE_SETTINGS;
      const override = { color: UI_COLORS.SELECTED_RED, lineWidth: 3 }; // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'

      const result = mergeSettings(base, override);

      expect(result.color).toBe(UI_COLORS.SELECTED_RED); // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
      expect(result.lineWidth).toBe(3);
      expect(result.lineType).toBe(base.lineType); // Unchanged
    });

    it('should handle empty override', () => {
      const base = DEFAULT_LINE_SETTINGS;
      const override = {};

      const result = mergeSettings(base, override);

      expect(result).toBe(base); // Same reference when no changes
    });
  });

  describe('mergeDxfSettings', () => {
    it('should merge all setting categories', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const override = {
        line: { color: UI_COLORS.LEGACY_COLORS.GREEN }, // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
        text: { fontSize: 16 },
        grip: { gripSize: 10 } // ✅ ENTERPRISE FIX: GripSettings uses 'gripSize', not 'size'
      };

      const result = mergeDxfSettings(base, override);

      expect(result.line.color).toBe(UI_COLORS.LEGACY_COLORS.GREEN); // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
      expect(result.text.fontSize).toBe(16);
      expect(result.grip.gripSize).toBe(10); // ✅ ENTERPRISE FIX: GripSettings uses 'gripSize', not 'size'
    });

    it('should handle partial overrides', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const override = {
        line: { lineWidth: 2 }
        // text και grip δεν έχουν override
      };

      const result = mergeDxfSettings(base, override);

      expect(result.line.lineWidth).toBe(2);
      expect(result.text).toBe(base.text); // Same reference
      expect(result.grip).toBe(base.grip); // Same reference
    });

    it('should handle null/undefined override', () => {
      const base = DEFAULT_DXF_SETTINGS;

      const result1 = mergeDxfSettings(base, null);
      const result2 = mergeDxfSettings(base, null as never);

      expect(result1).toBe(base);
      expect(result2).toBe(base);
    });
  });

  describe('diffSettings', () => {
    it('should detect no differences', () => {
      const base = DEFAULT_LINE_SETTINGS;
      const compare = { ...DEFAULT_LINE_SETTINGS };

      const diff = diffSettings(base, compare);

      expect(diff).toBeNull();
    });

    it('should detect differences', () => {
      const base = DEFAULT_LINE_SETTINGS;
      const compare = {
        ...DEFAULT_LINE_SETTINGS,
        color: '#DIFFERENT', // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
        lineWidth: 99
      };

      const diff = diffSettings(base, compare);

      expect(diff).toEqual({
        color: '#DIFFERENT', // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
        lineWidth: 99
      });
    });

    it('should ignore unchanged properties', () => {
      const base = {
        color: UI_COLORS.BLACK,
        lineWidth: 1,
        lineType: 'solid'
      };
      const compare = {
        color: UI_COLORS.SELECTED_RED, // Changed
        lineWidth: 1,         // Same
        lineType: 'solid'     // Same
      };

      const diff = diffSettings(base, compare as any);

      expect(diff).toEqual({
        color: UI_COLORS.SELECTED_RED
      });
    });
  });

  describe('extractOverrides', () => {
    it('should extract all overrides from entity settings', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const entity = {
        line: { ...DEFAULT_LINE_SETTINGS, color: UI_COLORS.CUSTOM_TEST_COLOR || '#123456' },
        text: { ...DEFAULT_TEXT_SETTINGS, fontSize: 20 },
        grip: DEFAULT_GRIP_SETTINGS // No change
      };

      const overrides = extractOverrides(base, entity);

      expect(overrides).toEqual({
        line: { color: UI_COLORS.CUSTOM_TEST_COLOR || '#123456' },
        text: { fontSize: 20 }
        // grip not included (no differences)
      });
    });

    it('should return null when no overrides', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const entity = DEFAULT_DXF_SETTINGS;

      const overrides = extractOverrides(base as unknown as Record<string, unknown>, entity as unknown as Record<string, unknown>);

      expect(overrides).toBeNull();
    });
  });

  describe('hasOverrides', () => {
    it('should detect when overrides exist', () => {
      expect(hasOverrides({ line: { color: UI_COLORS.SELECTED_RED } })).toBe(true);
      expect(hasOverrides({ text: {} })).toBe(false);
      expect(hasOverrides({})).toBe(false);
      expect(hasOverrides(null)).toBe(false);
      expect(hasOverrides(undefined)).toBe(false);
    });

    it('should check all categories', () => {
      expect(hasOverrides({
        line: {},
        text: { fontSize: 14 }
      })).toBe(true);

      expect(hasOverrides({
        line: {},
        text: {},
        grip: {}
      })).toBe(false);
    });
  });

  describe('cleanEmptyOverrides', () => {
    it('should remove empty override objects', () => {
      const overrides = {
        line: { color: UI_COLORS.SELECTED_RED },
        text: {}, // Empty
        grip: undefined
      };

      const cleaned = cleanEmptyOverrides(overrides);

      expect(cleaned).toEqual({
        line: { color: UI_COLORS.SELECTED_RED }
      });
    });

    it('should return null when all empty', () => {
      const overrides = {
        line: {},
        text: {},
        grip: {}
      };

      const cleaned = cleanEmptyOverrides(overrides);

      expect(cleaned).toBeNull();
    });

    it('should handle null/undefined', () => {
      expect(cleanEmptyOverrides(null as never)).toBeNull();
      expect(cleanEmptyOverrides(undefined as never)).toBeNull();
    });
  });

  describe('applyOverridesToBase', () => {
    it('should apply multiple overrides in sequence', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const overrides = [
        { line: { color: UI_COLORS.SELECTED_RED } },
        { line: { lineWidth: 2 }, text: { fontSize: 16 } },
        { grip: { gripSize: 8 } }
      ];

      const result = applyOverridesToBase(base, overrides);

      expect(result.line.color).toBe(UI_COLORS.SELECTED_RED); // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
      expect(result.line.lineWidth).toBe(2);
      expect(result.text.fontSize).toBe(16);
      expect(result.grip.gripSize).toBe(8);
    });

    it('should handle empty overrides array', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const result = applyOverridesToBase(base, []);

      expect(result).toBe(base);
    });

    it('should skip null/undefined overrides', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const overrides = [
        null,
        { line: { color: UI_COLORS.LEGACY_COLORS.BLUE } },
        undefined,
        { text: { fontSize: 18 } }
      ];

      const result = applyOverridesToBase(base, overrides);

      expect(result.line.color).toBe(UI_COLORS.LEGACY_COLORS.BLUE);
      expect(result.text.fontSize).toBe(18);
    });
  });

  describe('Performance', () => {
    it('should handle large override sets efficiently', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const overrides = Array.from({ length: 1000 }, (_, i) => ({
        line: { color: `#${i.toString(16).padStart(6, '0')}` }
      }));

      const start = performance.now();
      const result = applyOverridesToBase(base, overrides);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should complete within 100ms
      expect(result.line.color).toBe('#0003e7'); // Last override
    });

    it('should use reference equality for unchanged objects', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const override = { line: { color: UI_COLORS.SELECTED_RED } };

      const result = mergeDxfSettings(base, override);

      // Unchanged categories should keep same reference
      expect(result.text).toBe(base.text);
      expect(result.grip).toBe(base.grip);
      // Changed category should be new object
      expect(result.line).not.toBe(base.line);
    });
  });

  describe('Edge Cases', () => {
    it('should handle recursive overrides', () => {
      const base = {
        line: DEFAULT_LINE_SETTINGS,
        text: DEFAULT_TEXT_SETTINGS,
        grip: DEFAULT_GRIP_SETTINGS
      };

      const override = {
        line: {
          color: UI_COLORS.SELECTED_RED, // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
          // Nested object that shouldn't exist but testing robustness
          nested: { value: 'test' }
        } as unknown
      };

      const result = mergeDxfSettings(base, override as PartialDxfSettings);

      expect(result.line.color).toBe(UI_COLORS.SELECTED_RED); // ✅ ENTERPRISE FIX: LineSettings uses 'color', not 'color'
      expect((result.line as any).nested).toEqual({ value: 'test' });
    });

    it('should handle circular references gracefully', () => {
      const base = DEFAULT_DXF_SETTINGS;
      const override: Record<string, any> = { line: {} };
      (override.line as any).circular = override; // Create circular reference

      // Should not throw or infinite loop
      const result = mergeDxfSettings(base, override);

      expect(result).toBeDefined();
      expect(result.line).toBeDefined();
    });
  });
});