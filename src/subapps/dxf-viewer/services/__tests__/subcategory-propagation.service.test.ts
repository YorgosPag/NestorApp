/**
 * ADR-377 Phase D — Apply-to-All-Levels propagation tests.
 *
 * `mergeSubcategoriesInto` is pure (no mocks). `applySubcategoriesToLevels`
 * fans out via the mocked level-mutation gateway.
 */

import {
  mergeSubcategoriesInto,
  applySubcategoriesToLevels,
} from '../subcategory-propagation.service';
import { DEFAULT_OBJECT_STYLES, type BimCategory, type ObjectStyle } from '../../config/bim-object-styles';
import type { BimRenderSettings } from '../../config/bim-render-settings-types';
import type { Level } from '../../systems/levels/config';

const updateMock = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/dxf-level-mutation-gateway', () => ({
  updateDxfLevelWithPolicy: (...args: unknown[]) => updateMock(...args),
}));

function sourceWithWallOverride(): Record<BimCategory, ObjectStyle> {
  const src = JSON.parse(JSON.stringify(DEFAULT_OBJECT_STYLES)) as Record<BimCategory, ObjectStyle>;
  src.wall = { ...src.wall, subcategories: { 'common-edges': { cutColor: '#ff0000' } } };
  return src;
}

function makeLevel(id: string, bimRenderSettings?: BimRenderSettings): Level {
  return { id, bimRenderSettings } as unknown as Level;
}

beforeEach(() => updateMock.mockClear());

describe('mergeSubcategoriesInto', () => {
  it('copies source subcategories onto a null target', () => {
    const merged = mergeSubcategoriesInto(null, sourceWithWallOverride());
    expect(merged.objectStyles).toBeDefined();
    expect(merged.objectStyles!.wall).toBeDefined();
    expect(merged.objectStyles!.wall!.subcategories?.['common-edges']?.cutColor).toBe('#ff0000');
  });

  it('drops subcategories for categories the source has none', () => {
    // ADR-375 C.9: `column` πλέον ships default `shear-wall` subcategory, οπότε δεν είναι
    // πια κατάλληλη «κατηγορία χωρίς subcategories». Χρησιμοποιούμε `roof` (γνήσια χωρίς
    // subcategories στο DEFAULT_OBJECT_STYLES) για να ελεγχθεί το drop.
    const merged = mergeSubcategoriesInto(null, sourceWithWallOverride());
    expect(merged.objectStyles).toBeDefined();
    expect(merged.objectStyles!.roof?.subcategories).toBeUndefined();
  });

  it('preserves the target level\'s own drawingScale', () => {
    const merged = mergeSubcategoriesInto({ drawingScale: 50 }, sourceWithWallOverride());
    expect(merged.drawingScale).toBe(50);
  });
});

describe('applySubcategoriesToLevels', () => {
  it('fans out to every target level and reports updated count', async () => {
    const levels = [makeLevel('L1', { drawingScale: 50 }), makeLevel('L2')];
    const res = await applySubcategoriesToLevels(sourceWithWallOverride(), levels);
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ updated: 2, failures: [] });
  });

  it('preserves each target level\'s scale while copying subcategories', async () => {
    await applySubcategoriesToLevels(sourceWithWallOverride(), [makeLevel('L1', { drawingScale: 50 })]);
    const payload = updateMock.mock.calls[0][0].payload;
    expect(payload.levelId).toBe('L1');
    expect(payload.bimRenderSettings.drawingScale).toBe(50);
    expect(payload.bimRenderSettings.objectStyles.wall.subcategories['common-edges'].cutColor).toBe('#ff0000');
  });

  it('no-ops on empty level list', async () => {
    const res = await applySubcategoriesToLevels(sourceWithWallOverride(), []);
    expect(updateMock).not.toHaveBeenCalled();
    expect(res).toEqual({ updated: 0, failures: [] });
  });
});
