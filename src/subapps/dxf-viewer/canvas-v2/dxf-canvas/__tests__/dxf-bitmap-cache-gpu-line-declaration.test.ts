/**
 * ADR-909 Β2.7 / ADR-639 — το bitmap cache **δηλώνει** ότι πάνω του κάθεται το στρώμα γραμμών GPU.
 *
 * Η καταστολή των γραμμών του GPU έγινε **δήλωση του καλούντος** (`linesOwnedByGpuLayer`), ώστε εκτύπωση,
 * δημόσια κάτοψη και read-only προβολή να χαράζουν τα πάντα χωρίς να το θυμηθούν. Το αντίτιμο: ο **ένας**
 * καλών που ΠΡΕΠΕΙ να τη δηλώνει είναι ο ζωντανός καμβάς — και αν την ξεχάσει, κάθε γραμμή μεγάλου σχεδίου
 * ζωγραφίζεται **δύο φορές** (Canvas2D + GPU) χωρίς να φαίνεται πουθενά εκτός από τον χρόνο του καρέ.
 *
 *   Δ1  το `rebuild` περνά `linesOwnedByGpuLayer: true` στον αποδότη, μαζί με `skipInteractive: true`
 */

import type { DxfRenderOptions, DxfScene } from '../dxf-types';
import { DxfBitmapCache } from '../dxf-bitmap-cache';

const mockOptions: DxfRenderOptions[] = [];

jest.mock('../DxfRenderer', () => ({
  DxfRenderer: jest.fn().mockImplementation(() => ({
    render: (_scene: unknown, _transform: unknown, _viewport: unknown, options: DxfRenderOptions) => {
      mockOptions.push(options);
    },
  })),
}));
jest.mock('../../../systems/viewport/ViewportStore', () => ({ getActiveScaleName: () => '1:50' }));
jest.mock('../../../systems/navigation/NavigationGestureStore', () => ({ isNavigationGesture: () => false }));
jest.mock('../../../bim/services/opening-tag-style-service', () => ({
  getCurrentOpeningTagStyle: () => ({ enabled: false }),
}));
jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: () => 1,
  toDevicePixels: (cssPixels: number) => cssPixels,
}));
jest.mock('../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: { getState: () => ({ drawingScale: 50, viewRange: {}, objectStyles: {} }) },
}));

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
});
afterAll(() => getContextSpy.mockRestore());
beforeEach(() => { mockOptions.length = 0; });

describe('bitmap cache — δήλωση του στρώματος γραμμών GPU', () => {
  it('Δ1 το rebuild δηλώνει linesOwnedByGpuLayer μαζί με skipInteractive', () => {
    const cache = new DxfBitmapCache();
    cache.rebuild(
      { entities: [] } as unknown as DxfScene,
      { scale: 1, offsetX: 0, offsetY: 0 },
      { width: 800, height: 600 },
      { showGrid: false, showLayerNames: false, wireframeMode: false },
    );
    expect(mockOptions).toHaveLength(1);
    expect(mockOptions[0]).toMatchObject({ skipInteractive: true, linesOwnedByGpuLayer: true });
  });
});
