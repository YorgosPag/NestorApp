import { act } from '@testing-library/react';
import { useBimRenderSettingsStore } from '../bim-render-settings-store';
import {
  DEFAULT_DRAWING_SCALE,
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
} from '../../config/bim-render-settings-types';
import { DEFAULT_VIEW_RANGE } from '../../config/bim-view-range';
import {
  DEFAULT_OBJECT_STYLES,
  STRUCTURAL_BIM_CATEGORIES,
} from '../../config/bim-object-styles';

// Mock saveBimRenderSettings to avoid real Firestore calls
jest.mock('../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

// Suppress debounce side effects by using fake timers
beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

beforeEach(() => {
  act(() => {
    useBimRenderSettingsStore.setState({
      drawingScale: DEFAULT_DRAWING_SCALE,
      viewRange: DEFAULT_VIEW_RANGE,
      objectStyles: DEFAULT_OBJECT_STYLES as ReturnType<typeof useBimRenderSettingsStore.getState>['objectStyles'],
      rawSettings: null,
      currentLevelId: null,
      bimVisibilitySnapshot: null,
    });
  });
});

describe('useBimRenderSettingsStore', () => {
  describe('initial state', () => {
    it('defaults drawingScale to 100', () => {
      expect(useBimRenderSettingsStore.getState().drawingScale).toBe(DEFAULT_DRAWING_SCALE);
    });

    it('defaults viewRange to DEFAULT_VIEW_RANGE', () => {
      expect(useBimRenderSettingsStore.getState().viewRange).toEqual(DEFAULT_VIEW_RANGE);
    });

    it('defaults objectStyles to DEFAULT_OBJECT_STYLES', () => {
      expect(useBimRenderSettingsStore.getState().objectStyles).toEqual(DEFAULT_OBJECT_STYLES);
    });

    it('currentLevelId starts null', () => {
      expect(useBimRenderSettingsStore.getState().currentLevelId).toBeNull();
    });
  });

  describe('loadForLevel', () => {
    it('merges partial settings with defaults', () => {
      act(() => {
        useBimRenderSettingsStore.getState().loadForLevel('level-1', {
          drawingScale: 50,
          viewRange: { cutPlaneMm: 900 },
        });
      });
      const s = useBimRenderSettingsStore.getState();
      expect(s.currentLevelId).toBe('level-1');
      expect(s.drawingScale).toBe(50);
      expect(s.viewRange.cutPlaneMm).toBe(900);
      expect(s.viewRange.topMm).toBe(DEFAULT_VIEW_RANGE.topMm);
    });

    it('falls back to defaults when settings is null', () => {
      act(() => {
        useBimRenderSettingsStore.getState().loadForLevel('level-2', null);
      });
      const s = useBimRenderSettingsStore.getState();
      expect(s.drawingScale).toBe(DEFAULT_DRAWING_SCALE);
      expect(s.viewRange).toEqual(DEFAULT_VIEW_RANGE);
    });

    it('sets currentLevelId', () => {
      act(() => {
        useBimRenderSettingsStore.getState().loadForLevel('lvl-99');
      });
      expect(useBimRenderSettingsStore.getState().currentLevelId).toBe('lvl-99');
    });
  });

  describe('setDrawingScale', () => {
    it('clamps below DRAWING_SCALE_MIN', () => {
      act(() => useBimRenderSettingsStore.getState().setDrawingScale(0));
      expect(useBimRenderSettingsStore.getState().drawingScale).toBe(DRAWING_SCALE_MIN);
    });

    it('clamps above DRAWING_SCALE_MAX', () => {
      act(() => useBimRenderSettingsStore.getState().setDrawingScale(99999));
      expect(useBimRenderSettingsStore.getState().drawingScale).toBe(DRAWING_SCALE_MAX);
    });

    it('rounds fractional input', () => {
      act(() => useBimRenderSettingsStore.getState().setDrawingScale(33.7));
      expect(useBimRenderSettingsStore.getState().drawingScale).toBe(34);
    });
  });

  describe('resetDrawingScale', () => {
    it('resets to DEFAULT_DRAWING_SCALE', () => {
      act(() => useBimRenderSettingsStore.getState().setDrawingScale(500));
      act(() => useBimRenderSettingsStore.getState().resetDrawingScale());
      expect(useBimRenderSettingsStore.getState().drawingScale).toBe(DEFAULT_DRAWING_SCALE);
    });
  });

  describe('setViewRangeField', () => {
    it('patches a single ViewRange field', () => {
      act(() =>
        useBimRenderSettingsStore.getState().setViewRangeField('cutPlaneMm', 800),
      );
      const vr = useBimRenderSettingsStore.getState().viewRange;
      expect(vr.cutPlaneMm).toBe(800);
      expect(vr.topMm).toBe(DEFAULT_VIEW_RANGE.topMm);
    });

    it('handles negative viewDepthMm', () => {
      act(() =>
        useBimRenderSettingsStore.getState().setViewRangeField('viewDepthMm', -500),
      );
      expect(useBimRenderSettingsStore.getState().viewRange.viewDepthMm).toBe(-500);
    });
  });

  describe('setObjectStyleField', () => {
    it('patches pen for a category', () => {
      act(() =>
        useBimRenderSettingsStore.getState().setObjectStyleField('wall', 'cutPen', 9),
      );
      expect(useBimRenderSettingsStore.getState().objectStyles.wall.cutPen).toBe(9);
      expect(useBimRenderSettingsStore.getState().objectStyles.column.cutPen).toBe(
        DEFAULT_OBJECT_STYLES.column.cutPen,
      );
    });
  });

  describe('resetToDefaults', () => {
    it('restores drawingScale and viewRange to defaults', () => {
      act(() => {
        useBimRenderSettingsStore.getState().setDrawingScale(200);
        useBimRenderSettingsStore.getState().setViewRangeField('cutPlaneMm', 500);
        useBimRenderSettingsStore.getState().resetToDefaults();
      });
      const s = useBimRenderSettingsStore.getState();
      expect(s.drawingScale).toBe(DEFAULT_DRAWING_SCALE);
      expect(s.viewRange).toEqual(DEFAULT_VIEW_RANGE);
      expect(s.objectStyles).toEqual(DEFAULT_OBJECT_STYLES);
    });
  });

  describe('setBimObjectsVisibility (Hide BIM / Show only DXF isolate)', () => {
    const isHidden = (cat: (typeof STRUCTURAL_BIM_CATEGORIES)[number]) =>
      useBimRenderSettingsStore.getState().objectStyles[cat].visible === false;

    it('hides every structural BIM category in one call', () => {
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(false));
      for (const cat of STRUCTURAL_BIM_CATEGORIES) {
        expect(isHidden(cat)).toBe(true);
      }
    });

    it('leaves annotation/helper categories (dimension/hatch/grip) untouched', () => {
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(false));
      const styles = useBimRenderSettingsStore.getState().objectStyles;
      expect(styles.dimension.visible).not.toBe(false);
      expect(styles.hatch.visible).not.toBe(false);
      expect(styles.grip.visible).not.toBe(false);
    });

    it('restores all categories to visible when toggled back on', () => {
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(false));
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(true));
      for (const cat of STRUCTURAL_BIM_CATEGORIES) {
        expect(isHidden(cat)).toBe(false);
      }
      expect(useBimRenderSettingsStore.getState().bimVisibilitySnapshot).toBeNull();
    });

    it('preserves a manual per-category hide across an isolate cycle', () => {
      // User manually hides only 'column' via the V/G panel.
      act(() => useBimRenderSettingsStore.getState().setObjectStyleVisibility('column', false));
      // Engage + release the BIM isolate.
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(false));
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(true));
      // 'column' stays hidden, the rest are visible again.
      expect(isHidden('column')).toBe(true);
      expect(isHidden('wall')).toBe(false);
    });

    it('is idempotent — hiding twice keeps a single snapshot of the original state', () => {
      act(() => useBimRenderSettingsStore.getState().setObjectStyleVisibility('beam', false));
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(false));
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(false));
      act(() => useBimRenderSettingsStore.getState().setBimObjectsVisibility(true));
      // The double-hide must not have overwritten the snapshot with all-false.
      expect(isHidden('beam')).toBe(true);
      expect(isHidden('wall')).toBe(false);
    });
  });

  describe('getState() non-React access (renderer pattern)', () => {
    it('objectStyles accessible outside React', () => {
      const styles = useBimRenderSettingsStore.getState().objectStyles;
      expect(styles.wall).toBeDefined();
      expect(typeof styles.wall.cutPen).toBe('number');
    });
  });
});
