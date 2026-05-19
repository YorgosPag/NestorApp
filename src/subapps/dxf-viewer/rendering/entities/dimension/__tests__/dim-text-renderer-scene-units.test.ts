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

import { describe, expect, it, vi } from 'vitest';
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
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    set font(v: string) { fontHeld = v; },
    get font() { return fontHeld; },
    set textAlign(_v: CanvasTextAlign) {},
    get textAlign() { return 'center' as CanvasTextAlign; },
    set textBaseline(_v: CanvasTextBaseline) {},
    get textBaseline() { return 'middle' as CanvasTextBaseline; },
    set fillStyle(_v: string | CanvasGradient | CanvasPattern) {},
    get fillStyle() { return '#fff' as string | CanvasGradient | CanvasPattern; },
    fillText: vi.fn((text: string) => {
      calls.push({ font: fontHeld, text });
    }),
    measureText: vi.fn(() => ({ width: 50 } as TextMetrics)),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    set lineWidth(_v: number) {},
    set strokeStyle(_v: string | CanvasGradient | CanvasPattern) {},
    setLineDash: vi.fn(),
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

const CASES: ReadonlyArray<{ units: SceneUnits; transformScale: number; expectedPx: number }> = [
  // mm scene, view scale 1 px/mm → 2.5 × 1 × 1 = 2.5 px (back-compat baseline).
  { units: 'mm', transformScale: 1, expectedPx: 2.5 },
  // cm scene, view scale 10 px/cm → 2.5 × 0.1 × 10 = 2.5 px.
  { units: 'cm', transformScale: 10, expectedPx: 2.5 },
  // m scene, view scale 1000 px/m → 2.5 × 0.001 × 1000 = 2.5 px.
  { units: 'm',  transformScale: 1000, expectedPx: 2.5 },
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

  it('does NOT double-apply the multiplier when transform scale is unit', () => {
    // m scene with view scale = 1 px/m means a 2.5 mm text should render at
    // 2.5 mm × 0.001 m/mm × 1 px/m = 0.0025 px (microscopic — but math correct).
    const { ctx, calls } = makeCtxSpy();
    renderDimensionText(ctx, {
      entity: makeEntity(),
      geometry: makeLinearGeometry(),
      style: makeStyle(),
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      viewport: { width: 800, height: 600 },
      layerColour: '#888',
      sceneUnits: 'm',
    });
    const px = extractFontHeight(calls[0].font);
    expect(px).toBeCloseTo(0.0025, 6);
  });
});
