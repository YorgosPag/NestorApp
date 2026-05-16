/**
 * ADR-358 §G7 Phase 6.5 — sentinel-aware preview projection.
 *
 * Validates `applyPreviewSettingsToEntity()` branching:
 *   - colorMode='ByLayer'  → entity.colorMode='ByLayer', no entity.color
 *   - colorMode='Concrete' → entity.color = preview.color, entity.colorMode='Concrete'
 *   - lineweightMode='ByLayer'  → entity.lineweightMm=-2, no entity.lineweight
 *   - lineweightMode='Concrete' → entity.lineweight = preview.lineWidth
 *
 * Combined with the Phase 6 end-to-end test (useDxfSceneConversion sentinel
 * emission + resolveEntityStyle layer cascade), this nails down the LIVE
 * data path for new entities from LINE/CIRCLE/POLYLINE tools.
 */

import { describe, it, expect } from '@jest/globals';
import { applyPreviewSettingsToEntity } from '../apply-preview-settings';
import type { LineSettings } from '../../../settings-core/types';

function makePreview(overrides: Partial<LineSettings> = {}): LineSettings {
  return {
    enabled: true,
    lineType: 'solid',
    lineWidth: 1.5,
    color: '#00FF00',
    opacity: 0.9,
    dashScale: 1,
    dashOffset: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    breakAtCenter: false,
    hoverColor: '#FFFF00',
    hoverType: 'solid',
    hoverWidth: 1,
    hoverOpacity: 0.8,
    finalColor: '#0000FF',
    finalType: 'solid',
    finalWidth: 1,
    finalOpacity: 1,
    activeTemplate: null,
    colorMode: 'ByLayer',
    lineweightMode: 'ByLayer',
    ...overrides,
  };
}

describe('applyPreviewSettingsToEntity — Phase 6.5 sentinel projection', () => {
  it('colorMode=ByLayer → writes sentinel, OMITS entity.color', () => {
    const entity: Record<string, unknown> = {};
    applyPreviewSettingsToEntity(entity, makePreview({ colorMode: 'ByLayer' }));
    expect(entity.colorMode).toBe('ByLayer');
    expect(entity.color).toBeUndefined();
  });

  it('colorMode=Concrete → flattens entity.color from preview hex', () => {
    const entity: Record<string, unknown> = {};
    applyPreviewSettingsToEntity(entity, makePreview({ colorMode: 'Concrete', color: '#ABCDEF' }));
    expect(entity.colorMode).toBe('Concrete');
    expect(entity.color).toBe('#ABCDEF');
  });

  it('lineweightMode=ByLayer → writes lineweightMm=-2 sentinel, OMITS entity.lineweight', () => {
    const entity: Record<string, unknown> = {};
    applyPreviewSettingsToEntity(entity, makePreview({ lineweightMode: 'ByLayer' }));
    expect(entity.lineweightMm).toBe(-2);
    expect(entity.lineweight).toBeUndefined();
  });

  it('lineweightMode=Concrete → flattens entity.lineweight from preview lineWidth', () => {
    const entity: Record<string, unknown> = {};
    applyPreviewSettingsToEntity(entity, makePreview({ lineweightMode: 'Concrete', lineWidth: 2.5 }));
    expect(entity.lineweight).toBe(2.5);
    expect(entity.lineweightMm).toBeUndefined();
  });

  it('undefined colorMode treated as ByLayer (forward-compat for legacy stored settings)', () => {
    const preview = makePreview();
    delete preview.colorMode;
    const entity: Record<string, unknown> = {};
    applyPreviewSettingsToEntity(entity, preview);
    expect(entity.colorMode).toBe('ByLayer');
    expect(entity.color).toBeUndefined();
  });

  it('null/undefined preview → no-op (defensive)', () => {
    const entity: Record<string, unknown> = { color: '#KEEP' };
    applyPreviewSettingsToEntity(entity, null);
    applyPreviewSettingsToEntity(entity, undefined);
    expect(entity.color).toBe('#KEEP');
  });

  it('mixed: colorMode=ByLayer + lineweightMode=Concrete → both branches firing independently', () => {
    const entity: Record<string, unknown> = {};
    applyPreviewSettingsToEntity(
      entity,
      makePreview({ colorMode: 'ByLayer', lineweightMode: 'Concrete', lineWidth: 0.7 }),
    );
    expect(entity.colorMode).toBe('ByLayer');
    expect(entity.color).toBeUndefined();
    expect(entity.lineweight).toBe(0.7);
    expect(entity.lineweightMm).toBeUndefined();
  });

  it('flattens style fields regardless of branch (opacity, lineType, dashScale, etc.)', () => {
    const entity: Record<string, unknown> = {};
    applyPreviewSettingsToEntity(
      entity,
      makePreview({
        colorMode: 'ByLayer',
        opacity: 0.5,
        lineType: 'dashed',
        dashScale: 1.5,
        lineCap: 'round',
        lineJoin: 'bevel',
        dashOffset: 3,
        breakAtCenter: true,
      }),
    );
    expect(entity.opacity).toBe(0.5);
    expect(entity.lineType).toBe('dashed');
    expect(entity.dashScale).toBe(1.5);
    expect(entity.lineCap).toBe('round');
    expect(entity.lineJoin).toBe('bevel');
    expect(entity.dashOffset).toBe(3);
    expect(entity.breakAtCenter).toBe(true);
  });
});
