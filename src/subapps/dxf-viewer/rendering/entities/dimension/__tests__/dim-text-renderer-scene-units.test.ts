/**
 * ADR-362 Round 5 + Round 14 — `dim-text-renderer` scene-units conversion.
 *
 * DIMSTYLE.dimtxt is paper-mm by convention. The renderer multiplies it by
 * `mmToSceneUnits(units)` to land in world units before applying the view scale
 * (px / world-unit). Round 14: the renderer is now a "dumb" leaf — it applies
 * `style.dimscale` VERBATIM. The annotation-scale rescue (built-in dimscale=1 →
 * `drawingScale` SSoT, imported DIMSCALE>1 wins) is resolved ONCE upstream in
 * `DimensionRenderer.resolveFromEntity` via `resolveEffectiveDimscale`, so it
 * applies uniformly to text + arrowheads + offsets + center mark. These tests
 * therefore pass the already-resolved dimscale and assert the pure formula:
 *   px = dimtxt × dimscale × mmToSceneUnits(units) × viewScale
 *
 * The test spies on `ctx.font` after `renderDimensionText` runs and parses the
 * pixel height back out. `buildUIFont` emits `${height}px ${family}`.
 */

import { renderDimensionText } from '../dim-text-renderer';
import type { DimensionEntity, DimStyle } from '../../../../types/dimension';
import type { DimGeometry } from '../../../../systems/dimensions/dim-geometry-builder';
import type { SceneUnits } from '../../../../utils/scene-units';

// ──────────────────────────────────────────────────────────────────────────────
// Fake canvas context — just enough surface for the renderer
// ──────────────────────────────────────────────────────────────────────────────

function makeCtxSpy() {
  const calls: Array<{ font: string; text?: string }> = [];
  let fontHeld = '';
  const ctx: Partial<CanvasRenderingContext2D> = {
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    set font(v: string) { fontHeld = v; },
    get font() { return fontHeld; },
    set textAlign(_v: CanvasTextAlign) {},
    get textAlign() { return 'center' as CanvasTextAlign; },
    set textBaseline(_v: CanvasTextBaseline) {},
    get textBaseline() { return 'middle' as CanvasTextBaseline; },
    set fillStyle(_v: string | CanvasGradient | CanvasPattern) {},
    get fillStyle() { return '#fff' as string | CanvasGradient | CanvasPattern; },
    fillText: jest.fn((text: string) => {
      calls.push({ font: fontHeld, text });
    }),
    measureText: jest.fn(() => ({ width: 50 } as TextMetrics)),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    set lineWidth(_v: number) {},
    set strokeStyle(_v: string | CanvasGradient | CanvasPattern) {},
    setLineDash: jest.fn(),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

// ──────────────────────────────────────────────────────────────────────────────
// Builders
// ──────────────────────────────────────────────────────────────────────────────

function makeLinearGeometry(): DimGeometry {
  return {
    kind: 'linear',
    extLine1: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
    extLine2: { start: { x: 1, y: 0 }, end: { x: 1, y: 1 } },
    dimLine: { start: { x: 0, y: 1 }, end: { x: 1, y: 1 } },
    arrowAnchor1: { x: 0, y: 1 },
    arrowAnchor2: { x: 1, y: 1 },
    arrowDirection1: { x: 1, y: 0 },
    arrowDirection2: { x: -1, y: 0 },
    textAnchor: { x: 0.5, y: 1 },
    textRotation: 0,
    measurementValue: 1,
  } as DimGeometry;
}

function makeStyle(): DimStyle {
  return {
    id: 'test-style',
    name: 'test',
    isBuiltIn: false,
    dimclrd: 256, dimclre: 256, dimclrt: 256,
    dimexe: 1.25, dimexo: 0.625, dimdli: 3.75,
    suppressDimLine1: false, suppressDimLine2: false,
    suppressExtLine1: false, suppressExtLine2: false,
    dimasz: 2.5, dimblk: 'closedFilled', dimblk1: '', dimblk2: '',
    dimcen: 2.5, breakGap: 3.75,
    dimtxt: 2.5, dimgap: 0.625,
    dimtad: 'above', dimtih: false, dimtoh: false,
    dimtfill: 'none', dimtfillclr: 0, textFontFamily: 'Arial',
    dimtix: false, dimtofl: false, dimatfit: 3, dimtmove: 0,
    dimscale: 1, paperTextHeight: 2.5,
    dimlunit: 'decimal', dimaunit: 'decimalDegrees',
    dimdec: 2, dimadec: 0, dimdsep: ',', dimpost: '',
    dimrnd: 0, dimlfac: 1, dimzin: 0,
    dimalt: false, dimaltu: 'decimal', dimaltf: 25.4,
    dimaltd: 2, dimaltrnd: 0, dimapost: '',
    dimtol: false, dimlim: false, dimtm: 0, dimtp: 0,
    dimtdec: 2, dimtfac: 1, dimtolj: 'middle',
    dimInspect: 'off', dimInspectRate: 100,
    dimassoc: 2, targetLayer: 'Dimensions', annotative: false,
  };
}

function makeEntity(): DimensionEntity {
  return {
    id: 'dim-1', type: 'dimension',
    dimensionType: 'linear',
    styleId: 'test-style',
    defPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }],
    userText: undefined,
    layer: '0', visible: true,
  } as unknown as DimensionEntity;
}

function extractFontHeight(font: string): number {
  // `buildUIFont` output is `"<weight> <px>px <family>"` — extract the px number.
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : NaN;
}

function renderWith(style: DimStyle, units: SceneUnits | undefined, transformScale: number) {
  const { ctx, calls } = makeCtxSpy();
  renderDimensionText(ctx, {
    entity: makeEntity(),
    geometry: makeLinearGeometry(),
    style,
    transform: { scale: transformScale, offsetX: 0, offsetY: 0 },
    viewport: { width: 800, height: 600 },
    layerColour: '#888',
    ...(units ? { sceneUnits: units } : {}),
  });
  return calls;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cases
// ──────────────────────────────────────────────────────────────────────────────

describe('renderDimensionText — paper-mm DIMTXT → world units (ADR-362 Round 5)', () => {
  // Pure formula: dimtxt(2.5) × dimscale × mmToSceneUnits(units) × viewScale.
  // dimscale arrives already resolved; makeStyle() carries the effective 100 here
  // (the value DimensionRenderer would heal a built-in 1 to at 1:100).
  const style100 = { ...makeStyle(), dimscale: 100 };

  // View scale chosen to cancel the unit factor → every unit prints the same px.
  const CASES: ReadonlyArray<{ units: SceneUnits; transformScale: number; expectedPx: number }> = [
    { units: 'mm', transformScale: 1,    expectedPx: 250 }, // 2.5×100×1×1     = 250
    { units: 'cm', transformScale: 10,   expectedPx: 250 }, // 2.5×100×0.1×10  = 250
    { units: 'm',  transformScale: 1000, expectedPx: 250 }, // 2.5×100×0.001×1000 = 250
  ];

  it.each(CASES)('applies the unit factor under $units', ({ units, transformScale, expectedPx }) => {
    const calls = renderWith(style100, units, transformScale);
    expect(calls.length).toBeGreaterThan(0);
    expect(extractFontHeight(calls[0].font)).toBeCloseTo(expectedPx, 3);
  });

  it('defaults to mm when sceneUnits is omitted (back-compat)', () => {
    // dimscale=1 (verbatim) × 1 (mm) × 2 (scale) = 5 px.
    const calls = renderWith(makeStyle(), undefined, 2);
    expect(extractFontHeight(calls[0].font)).toBeCloseTo(5, 4);
  });
});

describe('renderDimensionText — applies dimscale VERBATIM (rescue is upstream, Round 14)', () => {
  // The renderer no longer rescues. DimensionRenderer.resolveFromEntity heals
  // dimscale once (resolveEffectiveDimscale). These tests prove the leaf passes
  // whatever dimscale it is given straight through the formula.

  it('dimscale=1 in mm-scene → 2.5 px (verbatim, NOT rescued here)', () => {
    const calls = renderWith(makeStyle(), 'mm', 1); // 2.5 × 1 × 1 × 1
    expect(extractFontHeight(calls[0].font)).toBeCloseTo(2.5, 6);
  });

  it('dimscale=1 in m-scene → 0.0025 px (verbatim — proves no metre rescue)', () => {
    const calls = renderWith(makeStyle(), 'm', 1); // 2.5 × 1 × 0.001 × 1
    expect(extractFontHeight(calls[0].font)).toBeCloseTo(0.0025, 6);
  });

  it('effective dimscale=100 (as healed upstream) → model-space size', () => {
    // m scene: 2.5 × 100 × 0.001 × 40 = 10 px — matches a native TEXT at 0.25m.
    const calls = renderWith({ ...makeStyle(), dimscale: 100 }, 'm', 40);
    expect(extractFontHeight(calls[0].font)).toBeCloseTo(10, 4);
  });

  it('explicit imported dimscale=50 passes through unchanged', () => {
    const calls = renderWith({ ...makeStyle(), dimscale: 50 }, 'mm', 1); // 2.5 × 50 × 1 × 1
    expect(extractFontHeight(calls[0].font)).toBeCloseTo(125, 4);
  });
});
