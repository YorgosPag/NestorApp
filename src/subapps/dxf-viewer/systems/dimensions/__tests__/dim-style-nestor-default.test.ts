/**
 * Phase 1 (Giorgio 2026-07-07) — «ΔΙΑΣΤΑΣΕΙΣ Nestor» is the out-of-the-box default
 * active DIMSTYLE, with an explicit unified green identity that every NEW dimension
 * inherits WITHOUT per-entity overrides.
 */

import {
  NESTOR_DEFAULT_TEMPLATE,
  DEFAULT_ACTIVE_DIM_STYLE_ID,
  BUILTIN_DIM_STYLE_IDS,
  BUILTIN_DIM_STYLES,
} from '../dim-style-templates';
import { DimStyleRegistry } from '../dim-style-registry';
import { resolveDimStyle } from '../dim-style-resolver';
import type { LinearDimensionEntity } from '../../../types/dimension';

const GREEN = 0x008000;

describe('ΔΙΑΣΤΑΣΕΙΣ Nestor — enterprise default DIMSTYLE', () => {
  it('is the default active style id', () => {
    expect(DEFAULT_ACTIVE_DIM_STYLE_ID).toBe(BUILTIN_DIM_STYLE_IDS.NESTOR_DEFAULT);
  });

  it('is registered as a built-in and is what a fresh registry activates', () => {
    expect(BUILTIN_DIM_STYLES.some((s) => s.id === BUILTIN_DIM_STYLE_IDS.NESTOR_DEFAULT)).toBe(true);
    const registry = new DimStyleRegistry();
    expect(registry.getActiveStyle().id).toBe(BUILTIN_DIM_STYLE_IDS.NESTOR_DEFAULT);
    expect(registry.getActiveStyle().name).toBe('ΔΙΑΣΤΑΣΕΙΣ Nestor');
  });

  it('carries explicit green on dim line, extension lines & text (TrueColor wins at render)', () => {
    expect(NESTOR_DEFAULT_TEMPLATE.dimclrdTrueColor).toBe(GREEN);
    expect(NESTOR_DEFAULT_TEMPLATE.dimclreTrueColor).toBe(GREEN);
    expect(NESTOR_DEFAULT_TEMPLATE.dimclrtTrueColor).toBe(GREEN);
    expect(NESTOR_DEFAULT_TEMPLATE.targetLayer).toBe('ΔΙΑΣΤΑΣΕΙΣ');
    expect(NESTOR_DEFAULT_TEMPLATE.dimexo).toBe(0);
  });

  it('keeps linetype ByLayer (renders continuous) and arrows inherit the green dim color', () => {
    expect(NESTOR_DEFAULT_TEMPLATE.dimltype).toBe('ByLayer');
    expect(NESTOR_DEFAULT_TEMPLATE.dimltex1).toBe('ByLayer');
    expect(NESTOR_DEFAULT_TEMPLATE.dimltex2).toBe('ByLayer');
    expect(NESTOR_DEFAULT_TEMPLATE.arrowColor).toBeUndefined();
  });

  it('a new dimension with no overrides resolves to green', () => {
    const registry = new DimStyleRegistry();
    const dim = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'linear',
      layerId: '0',
      styleId: BUILTIN_DIM_STYLE_IDS.NESTOR_DEFAULT,
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 20 }],
      rotation: 0,
    } as LinearDimensionEntity;

    const resolved = resolveDimStyle(dim, registry);
    expect(resolved.dimclrdTrueColor).toBe(GREEN);
    expect(resolved.dimclrtTrueColor).toBe(GREEN);
  });
});
