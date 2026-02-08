/**
 * @module DxfSettingsStore.test
 * @description Unit tests για το DxfSettingsStore
 * Tests για conference presentation - ZERO DUPLICATES
 */

import { renderHook, act } from '@testing-library/react';
import { useDxfSettingsStore } from '../DxfSettingsStore';
import { UI_COLORS } from '../../config/color-config';
import {
  DEFAULT_LINE_SETTINGS,
  DEFAULT_TEXT_SETTINGS,
  DEFAULT_GRIP_SETTINGS,
  DEFAULT_CURSOR_SETTINGS,
  DEFAULT_GRID_SETTINGS,
  DEFAULT_RULER_SETTINGS
} from '../../settings-core/defaults';

describe('DxfSettingsStore', () => {
  beforeEach(() => {
    // Reset store πριν από κάθε test
    const { result } = renderHook(() => useDxfSettingsStore.getState());
    act(() => {
      result.current.resetGeneralToDefaults();
      result.current.clearAllOverrides();
      result.current.clearSelection();
    });
  });

  describe('General Settings Management', () => {
    it('should initialize with default settings', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      expect(result.current.general.line).toEqual(DEFAULT_LINE_SETTINGS);
      expect(result.current.general.text).toEqual(DEFAULT_TEXT_SETTINGS);
      expect(result.current.general.grip).toEqual(DEFAULT_GRIP_SETTINGS);
    });

    it('should update general line settings', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      act(() => {
        result.current.setGeneralLine({
          lineWidth: 3,
          color: UI_COLORS.SELECTED_RED
        });
      });

      expect(result.current.general.line.lineWidth).toBe(3);
      expect(result.current.general.line.color).toBe(UI_COLORS.SELECTED_RED);
      // Άλλες τιμές παραμένουν default
      expect(result.current.general.line.lineType).toBe(DEFAULT_LINE_SETTINGS.lineType);
    });

    it('should validate settings on update', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      act(() => {
        // Προσπάθεια να βάλουμε invalid τιμή
        result.current.setGeneralLine({
          lineWidth: -5 // Invalid: θα γίνει 0.1 (minimum)
        });
      });

      expect(result.current.general.line.lineWidth).toBe(0.1);
    });

    it('should reset to defaults', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      act(() => {
        // Αλλαγή settings
        result.current.setGeneralLine({ color: UI_COLORS.CUSTOM_TEST_COLOR });
        result.current.setGeneralText({ fontSize: 20 });

        // Reset
        result.current.resetGeneralToDefaults();
      });

      // 🔧 FIX: DxfSettings now includes cursor, grid, and ruler settings
      expect(result.current.general).toEqual({
        line: DEFAULT_LINE_SETTINGS,
        text: DEFAULT_TEXT_SETTINGS,
        grip: DEFAULT_GRIP_SETTINGS,
        cursor: DEFAULT_CURSOR_SETTINGS,
        grid: DEFAULT_GRID_SETTINGS,
        ruler: DEFAULT_RULER_SETTINGS
      });
    });
  });

  describe('Override Management', () => {
    it('should set entity override', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const entityId = 'entity-123';

      act(() => {
        result.current.setOverride(entityId, {
          line: { color: UI_COLORS.LEGACY_COLORS.GREEN }
        });
      });

      expect(result.current.overrides[entityId]).toEqual({
        line: { color: UI_COLORS.LEGACY_COLORS.GREEN }
      });
    });

    it('should merge overrides correctly', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const entityId = 'entity-456';

      act(() => {
        // Πρώτο override
        result.current.setOverride(entityId, {
          line: { lineWidth: 2 }
        });

        // Δεύτερο override (merge)
        result.current.setOverride(entityId, {
          line: { color: UI_COLORS.LEGACY_COLORS.BLUE }
        });
      });

      expect(result.current.overrides[entityId]).toEqual({
        line: {
          lineWidth: 2,
          color: UI_COLORS.LEGACY_COLORS.BLUE
        }
      });
    });

    it('should clear empty overrides', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const entityId = 'entity-789';

      act(() => {
        result.current.setOverride(entityId, {
          line: { color: UI_COLORS.SELECTED_RED }
        });

        // Clear the override
        result.current.clearOverride(entityId);
      });

      expect(result.current.overrides[entityId]).toBeUndefined();
    });

    it('should apply overrides to selection', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const selection = ['entity-1', 'entity-2', 'entity-3'];

      act(() => {
        result.current.setSelection(selection);
        result.current.applyToSelection({
          line: { lineWidth: 5 }
        });
      });

      selection.forEach(entityId => {
        expect(result.current.overrides[entityId]).toEqual({
          line: { lineWidth: 5 }
        });
      });
    });
  });

  describe('Effective Settings Computation', () => {
    it('should compute effective settings without overrides', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const entityId = 'entity-no-override';

      const effective = result.current.getEffective(entityId);

      // 🔧 FIX: DxfSettings now includes cursor, grid, and ruler settings
      expect(effective).toEqual({
        line: DEFAULT_LINE_SETTINGS,
        text: DEFAULT_TEXT_SETTINGS,
        grip: DEFAULT_GRIP_SETTINGS,
        cursor: DEFAULT_CURSOR_SETTINGS,
        grid: DEFAULT_GRID_SETTINGS,
        ruler: DEFAULT_RULER_SETTINGS
      });
    });

    it('should merge general and override settings', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const entityId = 'entity-with-override';

      act(() => {
        // Set general
        result.current.setGeneralLine({ lineWidth: 2 });

        // Set override
        result.current.setOverride(entityId, {
          line: { color: UI_COLORS.LEGACY_COLORS.MAGENTA }
        });
      });

      const effectiveLine = result.current.getEffectiveLine(entityId);

      expect(effectiveLine.lineWidth).toBe(2); // From general
      expect(effectiveLine.color).toBe(UI_COLORS.LEGACY_COLORS.MAGENTA); // From override
      expect(effectiveLine.lineType).toBe(DEFAULT_LINE_SETTINGS.lineType); // Default
    });

    it('should detect entity overrides', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const entityWithOverride = 'entity-yes';
      const entityWithoutOverride = 'entity-no';

      act(() => {
        result.current.setOverride(entityWithOverride, {
          text: { fontSize: 18 }
        });
      });

      expect(result.current.hasEntityOverrides(entityWithOverride)).toBe(true);
      expect(result.current.hasEntityOverrides(entityWithoutOverride)).toBe(false);
    });
  });

  describe('Selection Management', () => {
    it('should manage selection state', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      act(() => {
        result.current.addToSelection('entity-1');
        result.current.addToSelection('entity-2');
      });

      expect(result.current.selection).toEqual(['entity-1', 'entity-2']);

      act(() => {
        result.current.removeFromSelection('entity-1');
      });

      expect(result.current.selection).toEqual(['entity-2']);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selection).toEqual([]);
    });

    it('should not add duplicate selections', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      act(() => {
        result.current.addToSelection('entity-1');
        result.current.addToSelection('entity-1'); // Duplicate
      });

      expect(result.current.selection).toEqual(['entity-1']);
    });
  });

  describe('Persistence', () => {
    it('should save to localStorage', () => {
      const { result } = renderHook(() => useDxfSettingsStore());
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

      act(() => {
        result.current.setGeneralLine({ lineWidth: 3 });
        result.current.saveToLocalStorage();
      });

      expect(setItemSpy).toHaveBeenCalledWith(
        'dxf-settings-v2',
        expect.stringContaining('"lineWidth":3')
      );

      setItemSpy.mockRestore();
    });

    it('should load from localStorage', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      const savedData = {
        general: {
          line: { ...DEFAULT_LINE_SETTINGS, lineWidth: 7 },
          text: DEFAULT_TEXT_SETTINGS,
          grip: DEFAULT_GRIP_SETTINGS
        },
        overrides: {
          'entity-saved': { line: { lineColor: '#SAVED' } }
        },
        savedAt: new Date().toISOString()
      };

      localStorage.setItem('dxf-settings-v2', JSON.stringify(savedData));

      act(() => {
        result.current.loadFromLocalStorage();
      });

      expect(result.current.general.line.lineWidth).toBe(7);
      expect(result.current.overrides['entity-saved']).toEqual({
        line: { lineColor: '#SAVED' }
      });
      expect(result.current.isLoaded).toBe(true);
    });

    it('should handle corrupted localStorage data', () => {
      const { result } = renderHook(() => useDxfSettingsStore());

      localStorage.setItem('dxf-settings-v2', 'invalid-json');

      act(() => {
        result.current.loadFromLocalStorage();
      });

      // Should use defaults on error
      // 🔧 FIX: DxfSettings now includes cursor, grid, and ruler settings
      expect(result.current.general).toEqual({
        line: DEFAULT_LINE_SETTINGS,
        text: DEFAULT_TEXT_SETTINGS,
        grip: DEFAULT_GRIP_SETTINGS,
        cursor: DEFAULT_CURSOR_SETTINGS,
        grid: DEFAULT_GRID_SETTINGS,
        ruler: DEFAULT_RULER_SETTINGS
      });
      expect(result.current.isLoaded).toBe(true);
    });
  });
});
