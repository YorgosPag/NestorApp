/**
 * ADR-375 v2.13 — UpdateDxfLevelSchema regression coverage.
 *
 * Originally added after the V/G silent-strip incident (2026-05-27): the
 * nested `objectStyles[category]` schema only validated `projectionPen` /
 * `cutPen`, and Zod's default `.strip()` mode deleted every other key —
 * including the entire ADR-375 Phase C.4 V/G surface (visible / *Color /
 * *Pattern) and ADR-377 subcategories. Server then persisted the stripped
 * payload, the Firestore snapshot listener delivered it back, and the
 * client store wiped its local V/G state as soon as the quiet-window guard
 * expired.
 *
 * These tests pin the full contract end-to-end so the regression cannot
 * silently return.
 */

import { UpdateDxfLevelSchema, __testing__ } from './dxf-levels.schemas';

const {
  PenIndexSchema,
  HexColorSchema,
  LinePatternSchema,
  SubcategoryStyleSchema,
  ObjectStyleSchema,
  BimRenderSettingsSchema,
} = __testing__;

describe('UpdateDxfLevelSchema — bimRenderSettings full contract (ADR-375 v2.13)', () => {
  const baseValidLevel = { levelId: 'lvl_test' };

  it('preserves V/G projectionColor + cutColor on a wall ObjectStyle', () => {
    const input = {
      ...baseValidLevel,
      bimRenderSettings: {
        drawingScale: 100,
        objectStyles: {
          wall: {
            projectionPen: 5,
            cutPen: 7,
            projectionColor: '#ff47ff',
            cutColor: '#000000',
          },
        },
      },
    };
    const parsed = UpdateDxfLevelSchema.parse(input);
    expect(parsed.bimRenderSettings?.objectStyles?.wall).toEqual({
      projectionPen: 5,
      cutPen: 7,
      projectionColor: '#ff47ff',
      cutColor: '#000000',
    });
  });

  it('preserves V/G visibility toggle', () => {
    const input = {
      ...baseValidLevel,
      bimRenderSettings: {
        drawingScale: 50,
        objectStyles: {
          column: { projectionPen: 5, cutPen: 9, visible: false },
          slab:   { projectionPen: 5, cutPen: 7, visible: true  },
        },
      },
    };
    const parsed = UpdateDxfLevelSchema.parse(input);
    expect(parsed.bimRenderSettings?.objectStyles?.column?.visible).toBe(false);
    expect(parsed.bimRenderSettings?.objectStyles?.slab?.visible).toBe(true);
  });

  it('preserves V/G line patterns (built-in + custom_)', () => {
    const input = {
      ...baseValidLevel,
      bimRenderSettings: {
        drawingScale: 100,
        objectStyles: {
          beam: {
            projectionPen: 4,
            cutPen: 6,
            projectionPattern: 'dashed' as const,
            cutPattern: 'custom_my-pattern' as const,
          },
        },
      },
    };
    const parsed = UpdateDxfLevelSchema.parse(input);
    expect(parsed.bimRenderSettings?.objectStyles?.beam?.projectionPattern).toBe('dashed');
    expect(parsed.bimRenderSettings?.objectStyles?.beam?.cutPattern).toBe('custom_my-pattern');
  });

  it('preserves ADR-377 subcategories block', () => {
    const input = {
      ...baseValidLevel,
      bimRenderSettings: {
        drawingScale: 100,
        objectStyles: {
          stair: {
            projectionPen: 3,
            cutPen: 5,
            subcategories: {
              walkline:  { linePattern: 'dashed' as const },
              handrails: { projectionColor: '#3366cc', cutPen: 5 as const },
            },
          },
        },
      },
    };
    const parsed = UpdateDxfLevelSchema.parse(input);
    expect(parsed.bimRenderSettings?.objectStyles?.stair?.subcategories).toEqual({
      walkline:  { linePattern: 'dashed' },
      handrails: { projectionColor: '#3366cc', cutPen: 5 },
    });
  });

  it('round-trips a complete multi-category V/G payload (real-world shape)', () => {
    const input = {
      ...baseValidLevel,
      bimRenderSettings: {
        drawingScale: 100,
        viewRange: { cutPlaneMm: 1200, topMm: 2500, bottomMm: 0 },
        objectStyles: {
          wall:   { projectionPen: 5, cutPen: 7, projectionColor: '#ff47ff', visible: true },
          column: { projectionPen: 5, cutPen: 9, cutColor: '#4ade80' },
          stair:  { projectionPen: 3, cutPen: 5, projectionColor: '#2563eb', visible: false },
        },
      },
    };
    const parsed = UpdateDxfLevelSchema.parse(input);
    expect(parsed.bimRenderSettings).toEqual(input.bimRenderSettings);
  });

  it('accepts null V/G colors (canvas-token fallback)', () => {
    const input = {
      ...baseValidLevel,
      bimRenderSettings: {
        drawingScale: 100,
        objectStyles: {
          wall: { projectionPen: 5, cutPen: 7, projectionColor: null, cutColor: null },
        },
      },
    };
    const parsed = UpdateDxfLevelSchema.parse(input);
    expect(parsed.bimRenderSettings?.objectStyles?.wall?.projectionColor).toBeNull();
    expect(parsed.bimRenderSettings?.objectStyles?.wall?.cutColor).toBeNull();
  });
});

describe('UpdateDxfLevelSchema — top-level BimRenderSettings fields (incident 2026-06-13 infinite loop)', () => {
  const baseValidLevel = { levelId: 'lvl_test' };

  // The runaway PATCH loop: the nested schema dropped `settingsVersion`, so the
  // server persisted an un-versioned doc → `loadForLevel` migration re-heals
  // (writes v2) → server strips it again → … (~800ms/write, _v past 42k). These
  // tests pin every field the client persists so it can never be stripped again.

  it('preserves settingsVersion (the loop trigger)', () => {
    const parsed = UpdateDxfLevelSchema.parse({
      ...baseValidLevel,
      bimRenderSettings: { settingsVersion: 2, drawingScale: 100 },
    });
    expect(parsed.bimRenderSettings?.settingsVersion).toBe(2);
  });

  it('preserves visualStyle preset (ADR-446)', () => {
    const parsed = UpdateDxfLevelSchema.parse({
      ...baseValidLevel,
      bimRenderSettings: { drawingScale: 100, visualStyle: 'realistic-edges' as const },
    });
    expect(parsed.bimRenderSettings?.visualStyle).toBe('realistic-edges');
  });

  it('rejects an unknown visualStyle preset', () => {
    const result = UpdateDxfLevelSchema.safeParse({
      ...baseValidLevel,
      bimRenderSettings: { drawingScale: 100, visualStyle: 'cartoon' },
    });
    expect(result.success).toBe(false);
  });

  it('preserves disciplineVisibility / colorBySystem and all master toggles', () => {
    const settings = {
      settingsVersion: 2,
      drawingScale: 100,
      disciplineVisibility: { structural: false, mechanical: true },
      colorBySystem: false,
      realisticMaterials: true,
      showHeatLoad: true,
      showFinishSkin: false,
      cutPlaneActive: true,
    };
    const parsed = UpdateDxfLevelSchema.parse({ ...baseValidLevel, bimRenderSettings: settings });
    expect(parsed.bimRenderSettings).toEqual(settings);
  });
});

describe('UpdateDxfLevelSchema — invalid payload rejection', () => {
  it('rejects non-hex projectionColor', () => {
    const result = UpdateDxfLevelSchema.safeParse({
      levelId: 'lvl_x',
      bimRenderSettings: {
        drawingScale: 100,
        objectStyles: { wall: { projectionPen: 5, cutPen: 7, projectionColor: 'red' } },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range PenIndex', () => {
    expect(PenIndexSchema.safeParse(0).success).toBe(false);
    expect(PenIndexSchema.safeParse(17).success).toBe(false);
    expect(PenIndexSchema.safeParse(1).success).toBe(true);
    expect(PenIndexSchema.safeParse(16).success).toBe(true);
  });

  it('rejects unknown line pattern that is not custom_ prefixed', () => {
    expect(LinePatternSchema.safeParse('squiggle').success).toBe(false);
    expect(LinePatternSchema.safeParse('custom_squiggle').success).toBe(true);
    expect(LinePatternSchema.safeParse('dashed').success).toBe(true);
  });
});

describe('Sub-schemas — direct unit coverage', () => {
  it('HexColorSchema accepts only 6-digit hex', () => {
    expect(HexColorSchema.safeParse('#ff47ff').success).toBe(true);
    expect(HexColorSchema.safeParse('#FFF').success).toBe(false);
    expect(HexColorSchema.safeParse('rgb(0,0,0)').success).toBe(false);
    expect(HexColorSchema.safeParse('').success).toBe(false);
  });

  it('SubcategoryStyleSchema allows partial overrides', () => {
    const r = SubcategoryStyleSchema.safeParse({ linePattern: 'dashed' });
    expect(r.success).toBe(true);
  });

  it('ObjectStyleSchema requires both pens', () => {
    const r1 = ObjectStyleSchema.safeParse({ projectionPen: 5 });
    expect(r1.success).toBe(false);
    const r2 = ObjectStyleSchema.safeParse({ projectionPen: 5, cutPen: 7 });
    expect(r2.success).toBe(true);
  });

  it('BimRenderSettingsSchema accepts minimal { drawingScale }', () => {
    const r = BimRenderSettingsSchema.safeParse({ drawingScale: 100 });
    expect(r.success).toBe(true);
  });
});
