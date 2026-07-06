/**
 * ADR-375 Phase C.4 — Visibility/Graphics per-view override tests.
 *
 * Covers:
 *   1. resolveIsCategoryVisible helper
 *   2. resolveSubcategoryStyle with visibility = false
 *   3. resolveSubcategoryStyle with category-level color override
 *   4. resolveSubcategoryStyle with category-level pattern override
 *   5. Priority stack: subcategory > category V/G override > global
 *   6. Store V/G setters: setObjectStyleVisibility, setObjectStyleVgColor, setObjectStyleVgPattern
 */

import { act } from '@testing-library/react';
import {
  resolveIsCategoryVisible,
  resolveSubcategoryStyle,
} from '../../config/bim-line-weight-resolver';
import { DEFAULT_OBJECT_STYLES } from '../../config/bim-object-styles';
import { useBimRenderSettingsStore } from '../bim-render-settings-store';
import {
  DEFAULT_DRAWING_SCALE,
} from '../../config/bim-render-settings-types';
import { DEFAULT_VIEW_RANGE } from '../../config/bim-view-range';

jest.mock('../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

beforeEach(() => {
  act(() => {
    useBimRenderSettingsStore.setState({
      drawingScale: DEFAULT_DRAWING_SCALE,
      viewRange: DEFAULT_VIEW_RANGE,
      objectStyles: DEFAULT_OBJECT_STYLES as ReturnType<typeof useBimRenderSettingsStore.getState>['objectStyles'],
      rawSettings: null,
      currentLevelId: 'test-level',
    });
  });
});

const BASE_CTX = {
  category: 'wall' as const,
  cutState: 'cut' as const,
  scaleDenominator: 100,
};

// ── resolveIsCategoryVisible ────────────────────────────────────────────────

describe('resolveIsCategoryVisible', () => {
  it('returns true when no overrides provided', () => {
    expect(resolveIsCategoryVisible('wall')).toBe(true);
  });

  it('returns true when override is absent for category', () => {
    expect(resolveIsCategoryVisible('wall', { column: { projectionPen: 5, cutPen: 9 } })).toBe(true);
  });

  it('returns true when visible is explicitly true', () => {
    expect(resolveIsCategoryVisible('wall', {
      wall: { projectionPen: 5, cutPen: 7, visible: true },
    })).toBe(true);
  });

  it('returns false when visible is explicitly false', () => {
    expect(resolveIsCategoryVisible('wall', {
      wall: { projectionPen: 5, cutPen: 7, visible: false },
    })).toBe(false);
  });

  it('returns true when overrides object is empty', () => {
    expect(resolveIsCategoryVisible('stair', {})).toBe(true);
  });
});

// ── resolveSubcategoryStyle — visibility ───────────────────────────────────

describe('resolveSubcategoryStyle — visibility', () => {
  it('returns zero lineWidthPx when category is hidden via V/G override', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      objectStyles: {
        wall: { projectionPen: 5, cutPen: 7, visible: false },
      },
    });
    expect(result.lineWidthPx).toBe(0);
    expect(result.linePattern).toBe('solid');
    expect(result.color).toBeNull();
  });

  it('draws normally when visible is true (no hidden)', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      objectStyles: {
        wall: { projectionPen: 5, cutPen: 7, visible: true },
      },
    });
    expect(result.lineWidthPx).toBeGreaterThan(0);
  });

  it('draws normally when visible field is absent', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      objectStyles: {
        wall: { projectionPen: 5, cutPen: 7 },
      },
    });
    expect(result.lineWidthPx).toBeGreaterThan(0);
  });
});

// ── resolveSubcategoryStyle — color override ────────────────────────────────

describe('resolveSubcategoryStyle — color override', () => {
  it('applies category-level cutColor on cut state', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      cutState: 'cut',
      objectStyles: {
        wall: { projectionPen: 5, cutPen: 7, cutColor: '#ff0000' },
      },
    });
    expect(result.color).toBe('#ff0000');
  });

  it('applies category-level projectionColor on projection state', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      cutState: 'projection',
      objectStyles: {
        wall: { projectionPen: 5, cutPen: 7, projectionColor: '#00ff00' },
      },
    });
    expect(result.color).toBe('#00ff00');
  });

  it('returns null color when no override (category without a C.9 line color)', () => {
    // ADR-375 C.9 + ADR-445: wall/column/slab/opening/beam πλέον έχουν default χρώμα·
    // χρησιμοποιούμε `roof` (άχρωμη κατηγορία, μόνο pens) για να ελεγχθεί το
    // canvas-token fallback (null).
    const result = resolveSubcategoryStyle({ ...BASE_CTX, category: 'roof' });
    expect(result.color).toBeNull();
  });

  it('subcategory cutColor wins over category-level cutColor (priority stack)', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      cutState: 'cut',
      subcategoryKey: 'common-edges',
      objectStyles: {
        wall: {
          projectionPen: 5,
          cutPen: 7,
          cutColor: '#ff0000',
          subcategories: { 'common-edges': { cutColor: '#0000ff' } },
        },
      },
    });
    expect(result.color).toBe('#0000ff');
  });
});

// ── resolveSubcategoryStyle — pattern override ──────────────────────────────

describe('resolveSubcategoryStyle — pattern override', () => {
  it('applies category-level cutPattern on cut state', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      cutState: 'cut',
      objectStyles: {
        wall: { projectionPen: 5, cutPen: 7, cutPattern: 'dashed' },
      },
    });
    expect(result.linePattern).toBe('dashed');
  });

  it('applies category-level projectionPattern on projection state', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      cutState: 'projection',
      objectStyles: {
        wall: { projectionPen: 5, cutPen: 7, projectionPattern: 'dotted' },
      },
    });
    expect(result.linePattern).toBe('dotted');
  });

  it('defaults to solid when no pattern override', () => {
    const result = resolveSubcategoryStyle(BASE_CTX);
    expect(result.linePattern).toBe('solid');
  });

  it('subcategory linePattern wins over category-level pattern (priority stack)', () => {
    const result = resolveSubcategoryStyle({
      ...BASE_CTX,
      cutState: 'projection',
      subcategoryKey: 'walkline',
      objectStyles: {
        wall: {
          projectionPen: 5,
          cutPen: 7,
          projectionPattern: 'center',
          subcategories: { 'walkline': { linePattern: 'phantom' } },
        },
      },
    });
    expect(result.linePattern).toBe('phantom');
  });
});

// ── Store V/G setters ───────────────────────────────────────────────────────

describe('bim-render-settings-store V/G setters', () => {
  it('setObjectStyleVisibility hides a category', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVisibility('wall', false);
    });
    expect(useBimRenderSettingsStore.getState().objectStyles.wall.visible).toBe(false);
  });

  it('setObjectStyleVisibility restores a category', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVisibility('wall', false);
      useBimRenderSettingsStore.getState().setObjectStyleVisibility('wall', true);
    });
    expect(useBimRenderSettingsStore.getState().objectStyles.wall.visible).toBe(true);
  });

  it('setObjectStyleVgColor sets cutColor', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVgColor('slab', 'cutColor', '#123456');
    });
    expect(useBimRenderSettingsStore.getState().objectStyles.slab.cutColor).toBe('#123456');
  });

  it('setObjectStyleVgColor sets projectionColor to null', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVgColor('column', 'projectionColor', null);
    });
    expect(useBimRenderSettingsStore.getState().objectStyles.column.projectionColor).toBeNull();
  });

  it('setObjectStyleVgPattern sets cutPattern', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVgPattern('beam', 'cutPattern', 'dashed');
    });
    expect(useBimRenderSettingsStore.getState().objectStyles.beam.cutPattern).toBe('dashed');
  });

  it('setObjectStyleVgPattern sets projectionPattern', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVgPattern('stair', 'projectionPattern', 'center');
    });
    expect(useBimRenderSettingsStore.getState().objectStyles.stair.projectionPattern).toBe('center');
  });

  it('V/G setter does not disturb other categories', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVisibility('wall', false);
    });
    const state = useBimRenderSettingsStore.getState();
    expect(state.objectStyles.column.visible).toBeUndefined();
    expect(state.objectStyles.slab.visible).toBeUndefined();
  });

  it('resetToDefaults clears V/G overrides', () => {
    act(() => {
      useBimRenderSettingsStore.getState().setObjectStyleVisibility('wall', false);
      useBimRenderSettingsStore.getState().setObjectStyleVgColor('slab', 'cutColor', '#ff0000');
      useBimRenderSettingsStore.getState().resetToDefaults();
    });
    const state = useBimRenderSettingsStore.getState();
    expect(state.objectStyles.wall.visible).toBeUndefined();
    // ADR-375 C.9: reset επαναφέρει τα defaults — το user override #ff0000 φεύγει·
    // το slab επιστρέφει στο default line color (#6e6358), όχι σε undefined.
    expect(state.objectStyles.slab.cutColor).not.toBe('#ff0000');
    expect(state.objectStyles.slab.cutColor).toBe('#6e6358');
  });
});
