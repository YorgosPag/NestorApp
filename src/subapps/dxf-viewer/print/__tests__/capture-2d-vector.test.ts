/**
 * ADR-608 — captureCurrent2dViewVector unit tests.
 *
 * The heavy collaborators (scene hydration, flatten, colour stamp, transform,
 * annotation decomposition, emitter) are mocked so the test isolates THIS
 * adapter's contract:
 *   - returns a `kind:'vector'` result with the right appliedScaleDenominator,
 *   - defers emission into a `draw(pdf, area)` closure,
 *   - folds world → paper mm correctly (worldToScreen → pxToMm → +area offset),
 *   - explodes annotation symbols/scale-bars (ADR-583/608) then feeds the emitter.
 */

import { captureCurrent2dViewVector } from '../capture/capture-2d-vector';
import type { Capture2dInput } from '../capture/capture-2d';
import { resolvePrintTransform, prepareScene2dCapture } from '../capture/capture-2d';
import { flattenSceneEntitiesForDxf } from '../../export/core/bim-to-dxf-primitives';
import { expandAnnotationsToPrimitives } from '../../export/core/annotation-to-primitives';
import { stampRenderedColors } from '../../export/formats/dxf-export-adapter';
import { emitSceneToPdf } from '../vector/scene-vector-emitter';
import { resolveSceneImages } from '../vector/scene-image-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { PrintableAreaMm } from '../config/paper-types';

jest.mock('../capture/capture-2d', () => ({
  resolvePrintTransform: jest.fn(),
  prepareScene2dCapture: jest.fn(),
}));
jest.mock('../../export/core/bim-to-dxf-primitives', () => ({
  flattenSceneEntitiesForDxf: jest.fn(),
}));
jest.mock('../../export/core/annotation-to-primitives', () => ({
  expandAnnotationsToPrimitives: jest.fn(),
}));
jest.mock('../../export/formats/dxf-export-adapter', () => ({
  stampRenderedColors: jest.fn(),
}));
jest.mock('../vector/scene-vector-emitter', () => ({ emitSceneToPdf: jest.fn() }));
jest.mock('../vector/scene-image-resolver', () => ({ resolveSceneImages: jest.fn() }));
jest.mock('../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));
jest.mock('../../rendering/core/CoordinateTransforms', () => ({
  CoordinateTransforms: { worldToScreen: jest.fn() },
}));

const FLAT_ENTITIES = [{ type: 'line' }];
const EXPANDED_ENTITIES = [{ type: 'line' }, { type: 'lwpolyline' }];
const IMAGE_RESOLUTION = {
  images: new Map(), patternCells: new Map(), solidFallbacks: new Map(), warnings: [],
};
// effectiveDpi = 25.4 makes pxToMm(px) === px (px / 25.4 * 25.4) → identity, so the
// coordinate assertions read directly.
const RASTER = { widthPx: 100, heightPx: 100, effectiveDpi: 25.4 };
const AREA: PrintableAreaMm = { xMm: 5, yMm: 7, widthMm: 90, heightMm: 90 };

function input(overrides: Partial<Capture2dInput> = {}): Capture2dInput {
  return {
    scene: { entities: [{ id: 'e1' }], layersById: { L: {} } } as never,
    raster: RASTER,
    fitMode: 'fit-to-page',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (prepareScene2dCapture as jest.Mock).mockReturnValue({
    dxfScene: { units: 'mm', layersById: { L: {} } },
    viewport: { width: 100, height: 100 },
  });
  (resolvePrintTransform as jest.Mock).mockReturnValue({ scale: 2, offsetX: 0, offsetY: 0 });
  (stampRenderedColors as jest.Mock).mockImplementation((e: unknown) => e);
  (flattenSceneEntitiesForDxf as jest.Mock).mockReturnValue({ entities: FLAT_ENTITIES, warnings: [] });
  (expandAnnotationsToPrimitives as jest.Mock).mockReturnValue(EXPANDED_ENTITIES);
  (useDrawingScaleStore.getState as jest.Mock).mockReturnValue({ drawingScale: 100 });
  (resolveSceneImages as jest.Mock).mockResolvedValue(IMAGE_RESOLUTION);
  // Identity screen transform so toPaper reduces to +area offset.
  (CoordinateTransforms.worldToScreen as jest.Mock).mockImplementation(
    (p: { x: number; y: number }) => ({ x: p.x, y: p.y }),
  );
});

describe('captureCurrent2dViewVector', () => {
  it('returns a vector capture and hydrates the scene once', async () => {
    const result = await captureCurrent2dViewVector(input());
    expect(result.kind).toBe('vector');
    expect(prepareScene2dCapture).toHaveBeenCalledTimes(1);
    // Emission is deferred — nothing drawn until the assembler calls draw().
    expect(emitSceneToPdf).not.toHaveBeenCalled();
  });

  it('reports appliedScaleDenominator only in drawing-scale mode', async () => {
    expect((await captureCurrent2dViewVector(input())).appliedScaleDenominator).toBeNull();
    const scaled = await captureCurrent2dViewVector(
      input({ fitMode: 'drawing-scale', scaleDenominator: 50 }),
    );
    expect(scaled.appliedScaleDenominator).toBe(50);
  });

  it('explodes annotations (flat entities + drawing scale + scene units) before emit', async () => {
    await captureCurrent2dViewVector(input());
    expect(expandAnnotationsToPrimitives).toHaveBeenCalledTimes(1);
    const [entities, ctx] = (expandAnnotationsToPrimitives as jest.Mock).mock.calls[0];
    expect(entities).toBe(FLAT_ENTITIES);
    expect(ctx).toEqual({ drawingScale: 100, sceneUnits: 'mm' });
  });

  it('pre-resolves scene images (async) and passes them to the emitter', async () => {
    const result = await captureCurrent2dViewVector(input());
    if (result.kind !== 'vector') throw new Error('expected vector capture');
    expect(resolveSceneImages).toHaveBeenCalledTimes(1);
    // The resolver runs over the EXPANDED entities (final draw-order array).
    expect((resolveSceneImages as jest.Mock).mock.calls[0][0]).toBe(EXPANDED_ENTITIES);
    result.draw({} as never, AREA);
    expect((emitSceneToPdf as jest.Mock).mock.calls[0][1].images).toBe(IMAGE_RESOLUTION);
  });

  it('draw() folds world→paper and feeds the EXPANDED entities to the emitter', async () => {
    const result = await captureCurrent2dViewVector(input());
    if (result.kind !== 'vector') throw new Error('expected vector capture');

    const pdf = {} as never;
    result.draw(pdf, AREA);

    expect(emitSceneToPdf).toHaveBeenCalledTimes(1);
    const [passedPdf, params] = (emitSceneToPdf as jest.Mock).mock.calls[0];
    expect(passedPdf).toBe(pdf);
    // The emitter draws the decomposed primitives, not the raw flatten.
    expect(params.entities).toBe(EXPANDED_ENTITIES);
    // pxToMm(transform.scale=2, dpi=25.4) === 2.
    expect(params.worldToPaperScale).toBeCloseTo(2);
    expect(params.colorPolicy).toEqual({ style: 'colour', dpi: 25.4 });
    // toPaper(world) = area offset + worldToScreen (identity here) → +{5,7}.
    expect(params.toPaper({ x: 10, y: 20 })).toEqual({ x: 15, y: 27 });
  });

  it('honours an explicit plotStyle in the colour policy', async () => {
    const result = await captureCurrent2dViewVector(input({ plotStyle: 'monochrome' }));
    if (result.kind !== 'vector') throw new Error('expected vector capture');
    result.draw({} as never, AREA);
    expect((emitSceneToPdf as jest.Mock).mock.calls[0][1].colorPolicy.style).toBe('monochrome');
  });
});
