/**
 * ADR-608 — captureCurrent2dViewVector unit tests.
 *
 * The heavy collaborators (scene conversion, flatten, colour stamp, transform,
 * emitter) are mocked so the test isolates THIS adapter's contract:
 *   - returns a `kind:'vector'` result with the right appliedScaleDenominator,
 *   - defers emission into a `draw(pdf, area)` closure,
 *   - folds world → paper mm correctly (worldToScreen → pxToMm → +area offset),
 *   - passes the flattened entities + a `{style, dpi}` colour policy to the emitter.
 */

import { captureCurrent2dViewVector } from '../capture/capture-2d-vector';
import type { Capture2dInput } from '../capture/capture-2d';
import { resolvePrintTransform } from '../capture/capture-2d';
import { convertSceneToDxf } from '../../hooks/canvas/useDxfSceneConversion';
import { setLayers } from '../../stores/LayerStore';
import { flattenSceneEntitiesForDxf } from '../../export/core/bim-to-dxf-primitives';
import { stampRenderedColors } from '../../export/formats/dxf-export-adapter';
import { emitSceneToPdf } from '../vector/scene-vector-emitter';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { PrintableAreaMm } from '../config/paper-types';

jest.mock('../capture/capture-2d', () => ({
  resolvePrintTransform: jest.fn(),
}));
jest.mock('../../hooks/canvas/useDxfSceneConversion', () => ({
  convertSceneToDxf: jest.fn(),
}));
jest.mock('../../stores/LayerStore', () => ({ setLayers: jest.fn() }));
jest.mock('../../export/core/bim-to-dxf-primitives', () => ({
  flattenSceneEntitiesForDxf: jest.fn(),
}));
jest.mock('../../export/formats/dxf-export-adapter', () => ({
  stampRenderedColors: jest.fn(),
}));
jest.mock('../vector/scene-vector-emitter', () => ({ emitSceneToPdf: jest.fn() }));
jest.mock('../../rendering/core/CoordinateTransforms', () => ({
  CoordinateTransforms: { worldToScreen: jest.fn() },
}));

const FLAT_ENTITIES = [{ type: 'line' }];
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
  (convertSceneToDxf as jest.Mock).mockReturnValue({ layersById: { L: {} }, units: 'mm' });
  (resolvePrintTransform as jest.Mock).mockReturnValue({ scale: 2, offsetX: 0, offsetY: 0 });
  (stampRenderedColors as jest.Mock).mockImplementation((e: unknown) => e);
  (flattenSceneEntitiesForDxf as jest.Mock).mockReturnValue({ entities: FLAT_ENTITIES, warnings: [] });
  // Identity screen transform so toPaper reduces to +area offset.
  (CoordinateTransforms.worldToScreen as jest.Mock).mockImplementation((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
});

describe('captureCurrent2dViewVector', () => {
  it('returns a vector capture and hydrates the LayerStore', () => {
    const result = captureCurrent2dViewVector(input());
    expect(result.kind).toBe('vector');
    expect(setLayers).toHaveBeenCalledTimes(1);
    // Emission is deferred — nothing drawn until the assembler calls draw().
    expect(emitSceneToPdf).not.toHaveBeenCalled();
  });

  it('reports appliedScaleDenominator only in drawing-scale mode', () => {
    expect(captureCurrent2dViewVector(input()).appliedScaleDenominator).toBeNull();
    const scaled = captureCurrent2dViewVector(
      input({ fitMode: 'drawing-scale', scaleDenominator: 50 }),
    );
    expect(scaled.appliedScaleDenominator).toBe(50);
  });

  it('draw() folds world→paper and feeds flattened entities to the emitter', () => {
    const result = captureCurrent2dViewVector(input());
    if (result.kind !== 'vector') throw new Error('expected vector capture');

    const pdf = {} as never;
    result.draw(pdf, AREA);

    expect(emitSceneToPdf).toHaveBeenCalledTimes(1);
    const [passedPdf, params] = (emitSceneToPdf as jest.Mock).mock.calls[0];
    expect(passedPdf).toBe(pdf);
    expect(params.entities).toBe(FLAT_ENTITIES);
    // pxToMm(transform.scale=2, dpi=25.4) === 2.
    expect(params.worldToPaperScale).toBeCloseTo(2);
    expect(params.colorPolicy).toEqual({ style: 'colour', dpi: 25.4 });
    // toPaper(world) = area offset + worldToScreen (identity here) → +{5,7}.
    expect(params.toPaper({ x: 10, y: 20 })).toEqual({ x: 15, y: 27 });
  });

  it('honours an explicit plotStyle in the colour policy', () => {
    const result = captureCurrent2dViewVector(input({ plotStyle: 'monochrome' }));
    if (result.kind !== 'vector') throw new Error('expected vector capture');
    result.draw({} as never, AREA);
    expect((emitSceneToPdf as jest.Mock).mock.calls[0][1].colorPolicy.style).toBe('monochrome');
  });
});
