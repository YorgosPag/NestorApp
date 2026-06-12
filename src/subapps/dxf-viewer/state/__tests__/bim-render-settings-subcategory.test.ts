/**
 * ADR-377 Phase D — per-subcategory style store setters.
 *
 * Covers the four new actions on `useBimRenderSettingsStore`:
 *   setSubcategoryStyleField / clearSubcategoryStyle /
 *   resetCategorySubcategories / resetAllSubcategories
 * plus the debounced Firestore persistence path.
 */

import { act } from '@testing-library/react';
import { DEFAULT_OBJECT_STYLES } from '../../config/bim-object-styles';
import { useBimRenderSettingsStore } from '../bim-render-settings-store';
import { DEFAULT_DRAWING_SCALE } from '../../config/bim-render-settings-types';
import { DEFAULT_VIEW_RANGE } from '../../config/bim-view-range';
import { saveBimRenderSettings } from '../../services/bim-render-settings.service';

jest.mock('../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

const mockSave = saveBimRenderSettings as jest.Mock;

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

beforeEach(() => {
  jest.clearAllTimers(); // drop any debounce timer left pending by a prior test
  mockSave.mockClear();
  act(() => {
    useBimRenderSettingsStore.setState({
      drawingScale: DEFAULT_DRAWING_SCALE,
      viewRange: DEFAULT_VIEW_RANGE,
      objectStyles: JSON.parse(JSON.stringify(DEFAULT_OBJECT_STYLES)),
      rawSettings: null,
      currentLevelId: 'test-level',
    });
  });
});

const get = () => useBimRenderSettingsStore.getState();

describe('setSubcategoryStyleField', () => {
  it('sets one field under objectStyles[cat].subcategories[key]', () => {
    act(() => get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000'));
    expect(get().objectStyles.wall.subcategories?.['common-edges']?.cutColor).toBe('#ff0000');
  });

  it('merges a second field without clobbering the first', () => {
    act(() => {
      get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000');
      get().setSubcategoryStyleField('wall', 'common-edges', 'linePattern', 'dashed');
    });
    const sub = get().objectStyles.wall.subcategories?.['common-edges'];
    expect(sub?.cutColor).toBe('#ff0000');
    expect(sub?.linePattern).toBe('dashed');
  });

  it('sets a pen field (numeric union narrowed)', () => {
    act(() => get().setSubcategoryStyleField('beam', 'section-profile', 'cutPen', 9));
    expect(get().objectStyles.beam.subcategories?.['section-profile']?.cutPen).toBe(9);
  });

  it('does not disturb other categories', () => {
    act(() => get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000'));
    expect(get().objectStyles.column.subcategories?.['common-edges']).toBeUndefined();
  });

  it('persists via debounced save', () => {
    act(() => get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000'));
    act(() => { jest.advanceTimersByTime(600); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const [levelId, settings] = mockSave.mock.calls[0];
    expect(levelId).toBe('test-level');
    expect(settings.objectStyles.wall.subcategories['common-edges'].cutColor).toBe('#ff0000');
  });
});

describe('clearSubcategoryStyle', () => {
  it('removes the subcategory key entirely', () => {
    act(() => {
      get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000');
      get().clearSubcategoryStyle('wall', 'common-edges');
    });
    expect(get().objectStyles.wall.subcategories?.['common-edges']).toBeUndefined();
  });

  it('is idempotent when the key is absent (no throw, no extra save)', () => {
    act(() => get().clearSubcategoryStyle('wall', 'common-edges'));
    act(() => { jest.advanceTimersByTime(600); });
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('resetCategorySubcategories', () => {
  it('restores a category WITH defaults (stair: walkline + handrails)', () => {
    act(() => {
      get().setSubcategoryStyleField('stair', 'walkline', 'linePattern', 'solid');
      get().resetCategorySubcategories('stair');
    });
    const subs = get().objectStyles.stair.subcategories;
    expect(subs?.['walkline']?.linePattern).toBe('dashed');
    expect(subs?.['handrails']?.linePattern).toBe('dashed2');
  });

  it('drops subcategories for a category WITHOUT defaults (slab)', () => {
    act(() => {
      get().setSubcategoryStyleField('slab', 'common-edges', 'cutColor', '#ff0000');
      get().resetCategorySubcategories('slab');
    });
    expect(get().objectStyles.slab.subcategories).toBeUndefined();
  });

  // ADR-375 C.9 — ο τοίχος ΕΧΕΙ default `interior` subcategory (εσωτ./εξωτ. τοίχος
  // διαφορετικό χρώμα). Reset → επαναφορά στο default interface, ΟΧΙ undefined (SSoT).
  it('restores default subcategories for a category WITH defaults (wall: interior)', () => {
    act(() => {
      get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000');
      get().setSubcategoryStyleField('wall', 'interior', 'cutColor', '#ff0000');
      get().resetCategorySubcategories('wall');
    });
    // Η σβησμένη ad-hoc subcategory φεύγει· το default `interior` επανέρχεται από το SSoT.
    expect(get().objectStyles.wall.subcategories?.['common-edges']).toBeUndefined();
    expect(get().objectStyles.wall.subcategories).toEqual(DEFAULT_OBJECT_STYLES.wall.subcategories);
  });
});

describe('resetAllSubcategories', () => {
  it('restores every category to defaults', () => {
    act(() => {
      get().setSubcategoryStyleField('slab', 'common-edges', 'cutColor', '#ff0000');
      get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000');
      get().setSubcategoryStyleField('stair', 'walkline', 'linePattern', 'solid');
      get().resetAllSubcategories();
    });
    // slab: χωρίς defaults → undefined· wall: με default `interior` → επανέρχεται (ΟΧΙ undefined).
    expect(get().objectStyles.slab.subcategories).toBeUndefined();
    expect(get().objectStyles.wall.subcategories).toEqual(DEFAULT_OBJECT_STYLES.wall.subcategories);
    expect(get().objectStyles.stair.subcategories?.['walkline']?.linePattern).toBe('dashed');
  });
});
