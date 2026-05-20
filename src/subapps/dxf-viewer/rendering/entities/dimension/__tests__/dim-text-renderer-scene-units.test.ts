/**
 * ADR-362 Round 5 — `dim-text-renderer` scene-units conversion.
 *
 * DIMSTYLE.dimtxt is paper-mm by convention. The renderer multiplies it by
 * `mmToSceneUnits(units)` to land in world units before applying the view
 * scale (px / world-unit). Without that step a 2.5 mm DIMTXT in a meters scene
 * would render as 2.5 m worth of pixels — the visible "ribbon dim text is
 * huge" bug this round fixes.
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

// ──────────────────────────────────────────────────────────────────────────────
// Cases
// ──────────────────────────────────────────────────────────────────────────────

// ADR-362 R7: formula is `dimtxt × dimscale × mmToSceneUnits(units) × viewScale`.
// makeStyle() uses dimscale=1.
// R13: 'm'-scene with dimscale=1 triggers rescue → effectiveDimscale=100.
// Formula: 2.5 × effectiveDimscale × unitFactor × viewScale
const CASES: ReadonlyArray<{ units: SceneUnits; transformScale: number; expectedPx: number }> = [
  // mm scene, view scale 1 px/mm → 2.5 × 1 × 1 × 1 = 2.5 px (no rescue, back-compat baseline).
  { units: 'mm', transformScale: 1, expectedPx: 2.5 },
  // cm scene, view scale 10 px/cm → 2.5 × 1 × 0.1 × 10 = 2.5 px (no rescue, unitFactor > 0.001).
  { units: 'cm', transformScale: 10, expectedPx: 2.5 },
  // m scene, view scale 1000 px/m → R13 rescue dimscale=1→100 → 2.5 × 100 × 0.001 × 1000 = 250 px.
  { units: 'm',  transformScale: 1000, expectedPx: 250 },
];

describe('renderDimensionText — paper-mm DIMTXT → world units (ADR-362 Round 5)', () => {
  it.each(CASES)('emits the same screen px under $units when view scale matches', ({ units, transformScale, expectedPx }) => {
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(),
      geometry: makeLinearGeometry(),
      style: makeStyle(),
      transform: { scale: transformScale, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 },
      layerColour: '#888',
      sceneUnits: units,
    });
    expect(calls.length).toBeGreaterThan(0);
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(expectedPx, 4);
  });

  it('defaults to mm when sceneUnits is omitted (back-compat)', () => {
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(),
      geometry: makeLinearGeometry(),
      style: makeStyle(),
      transform: { scale: 2, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 },
      layerColour: '#888',
      // no sceneUnits — must behave identically to legacy code path.
    });
    const px = extractFontHeight(calls[0].font);
    // 2.5 (mm) × 1 (mm factor) × 2 (scale) = 5 px.
    expect(px).toBeCloseTo(5, 4);
  });

  it('R6 regression: m-scene text is 10× smaller than mm-scene at same view scale (R13 rescue active)', () => {
    // Guards against useDxfSceneConversion forwarding raw scene.units (possibly
    // undefined) instead of resolveSceneUnits() — which would make DxfRenderer
    // fall back to 'mm', rendering 2.5 world-units of text in a meters scene.
    // R13: dimscale=1 in m-scene → rescued to 100. Ratio = (2.5×1×1×1) / (2.5×100×0.001×1) = 2.5/0.25 = 10.
    const shared = {
      entity: makeEntity(), geometry: makeLinearGeometry(), style: makeStyle(),
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 }, layerColour: '#888',
    };
    const { ctx: ctxMm, calls: callsMm } = makeCtxSpy();
    const { ctx: ctxM, calls: callsM } = makeCtxSpy();
    renderDimensionText(ctxMm, { ...shared, sceneUnits: 'mm' });
    renderDimensionText(ctxM,  { ...shared, sceneUnits: 'm' });
    const ratio = extractFontHeight(callsMm[0].font) / extractFontHeight(callsM[0].font);
    expect(ratio).toBeCloseTo(10, 2); // mm(no rescue)/m(rescued): 2.5 / 0.25 = 10
  });

  it('R13 rescue applies at unit transform scale (dimscale=1 m-scene → 0.25px)', () => {
    // m scene with view scale = 1 px/m, dimscale=1:
    // R13 rescue: dimscale=1 < 10 → effectiveDimscale=100
    // 2.5 mm × 100 × 0.001 m/mm × 1 px/m = 0.25 px.
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(),
      geometry: makeLinearGeometry(),
      style: makeStyle(), // dimscale=1
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 },
      layerColour: '#888',
      sceneUnits: 'm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(0.25, 6);
  });

  it('R7: dimscale=100 in m-scene scales text to model-space size matching native TEXT', () => {
    // A 1:100 annotation (dimscale=100) in a meters scene:
    //   dimtxt=2.5mm × 100 × 0.001 m/mm × 40 px/m = 10 px.
    // A native TEXT entity stored at height=0.25m renders identically:
    //   0.25m × 40 px/m = 10 px.
    // This verifies that DIMSCALE is applied to text (like it is to arrowheads).
    const style100 = { ...makeStyle(), dimscale: 100 };
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(),
      geometry: makeLinearGeometry(),
      style: style100,
      transform: { scale: 40, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 },
      layerColour: '#888',
      sceneUnits: 'm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(10, 4); // 2.5 × 100 × 0.001 × 40 = 10 px
  });
});

describe('renderDimensionText — R13 dimscale rescue for built-in styles (ADR-362 Round 13)', () => {
  // Rescue: unitFactor <= mmToSceneUnits('m') && dimscale < 10 → effectiveDimscale=100.
  // Built-in styles (ISO_129, Standard) ship with dimscale=1 → invisible in meters scenes.
  // Same result as imported styles rescued by R12 dim-style-importer.

  it('ISO_129-style dimscale=1 in m-scene → rescued to 100 (same as imported Standard)', () => {
    // 2.5 × 100 × 0.001 × 40 = 10 px — matches imported Standard with dimscale=100
    const { ctx: ctxBuiltIn, calls: callsBuiltIn } = makeCtxSpy();
    const { ctx: ctxImported, calls: callsImported } = makeCtxSpy();
    const shared = {
      entity: makeEntity(), geometry: makeLinearGeometry(),
      transform: { scale: 40, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 }, layerColour: '#888', sceneUnits: 'm' as SceneUnits,
    };
    renderDimensionText(ctxBuiltIn,  { ...shared, style: { ...makeStyle(), dimscale: 1 } });
    renderDimensionText(ctxImported, { ...shared, style: { ...makeStyle(), dimscale: 100 } });
    const pxBuiltIn  = extractFontHeight(callsBuiltIn[0].font);
    const pxImported = extractFontHeight(callsImported[0].font);
    expect(pxBuiltIn).toBeCloseTo(10, 4);   // 2.5 × 100(rescued) × 0.001 × 40
    expect(pxImported).toBeCloseTo(10, 4);  // 2.5 × 100(real) × 0.001 × 40
  });

  it('dimscale=9 in m-scene → rescued to 100 (boundary: 9 < 10)', () => {
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(), geometry: makeLinearGeometry(),
      style: { ...makeStyle(), dimscale: 9 },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 }, layerColour: '#888', sceneUnits: 'm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(0.25, 6); // 2.5 × 100(rescued) × 0.001 × 1
  });

  it('dimscale=10 in m-scene → NOT rescued (boundary: 10 is not < 10)', () => {
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(), geometry: makeLinearGeometry(),
      style: { ...makeStyle(), dimscale: 10 },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 }, layerColour: '#888', sceneUnits: 'm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(0.025, 6); // 2.5 × 10(kept) × 0.001 × 1
  });

  it('dimscale=100 in m-scene → NOT rescued (already scaled)', () => {
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(), geometry: makeLinearGeometry(),
      style: { ...makeStyle(), dimscale: 100 },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 }, layerColour: '#888', sceneUnits: 'm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(0.25, 6); // 2.5 × 100(kept) × 0.001 × 1
  });

  it('dimscale=1 in cm-scene → NOT rescued (unitFactor=0.1 > 0.001 threshold)', () => {
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(), geometry: makeLinearGeometry(),
      style: makeStyle(), // dimscale=1
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 }, layerColour: '#888', sceneUnits: 'cm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(0.25, 6); // 2.5 × 1(kept) × 0.1 × 1 = 0.25 px
  });

  it('dimscale=1 in mm-scene → NOT rescued (unitFactor=1 > 0.001 threshold)', () => {
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(), geometry: makeLinearGeometry(),
      style: makeStyle(), // dimscale=1
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 }, layerColour: '#888', sceneUnits: 'mm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(2.5, 6); // 2.5 × 1(kept) × 1 × 1 = 2.5 px
  });
});
