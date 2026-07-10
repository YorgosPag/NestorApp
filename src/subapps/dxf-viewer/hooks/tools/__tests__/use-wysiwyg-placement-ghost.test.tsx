/**
 * ADR-624 — WYSIWYG placement-ghost SSoT (primitive + factory) unit + smoke tests.
 *
 * Κλειδώνει το build→paint συμβόλαιο του primitive/factory (το `useCanvasGhostPreview`
 * harness είναι mocked ώστε να πιάσουμε το `draw` delegate χωρίς RAF/canvas), και κάνει
 * module-load smoke στα 9 thin bindings (πιάνει σπασμένα imports/exports — ο swc/jest
 * transform είναι transpile-only και ΔΕΝ πιάνει type/import errors).
 */

import { renderHook } from '@testing-library/react';
import type { ViewTransform } from '../../../rendering/types/Types';
import type { GhostDrawFrame } from '../../../systems/preview/ghost-preview-frame';

jest.mock('../useCanvasGhostPreview', () => ({ useCanvasGhostPreview: jest.fn() }));
jest.mock('../../../bim/ghosts/wysiwyg-placement-ghost', () => ({ renderWysiwygPlacementGhost: jest.fn() }));
jest.mock('../../../stores/LayerStore', () => ({ getDefaultLayerId: () => 'layer-test' }));

import { useCanvasGhostPreview } from '../useCanvasGhostPreview';
import { renderWysiwygPlacementGhost } from '../../../bim/ghosts/wysiwyg-placement-ghost';
import {
  useWysiwygPlacementGhost,
  createBridgeStorePlacementGhostHook,
} from '../use-wysiwyg-placement-ghost';

const mockHarness = useCanvasGhostPreview as jest.Mock;
const mockRender = renderWysiwygPlacementGhost as jest.Mock;

/** Το `draw` delegate που πέρασε ο τελευταίος `useCanvasGhostPreview` κλήση. */
function lastDraw(): (frame: GhostDrawFrame) => void {
  return mockHarness.mock.calls.at(-1)![0].draw;
}
function makeFrame(effectiveCursor: { x: number; y: number } | null): GhostDrawFrame {
  return {
    ctx: {} as CanvasRenderingContext2D,
    effectiveCursor,
    viewport: { width: 100, height: 100 },
    transform: { scale: 1, offsetX: 0, offsetY: 0 } as unknown as ViewTransform,
  };
}

beforeEach(() => {
  mockHarness.mockClear();
  mockRender.mockClear();
});

describe('useWysiwygPlacementGhost (primitive)', () => {
  const baseCfg = {
    isActive: true,
    transform: {} as ViewTransform,
    getCanvas: () => null,
  };

  it('paints the built entity via renderWysiwygPlacementGhost by default', () => {
    const entity = { id: 'e1' };
    renderHook(() => useWysiwygPlacementGhost({ ...baseCfg, buildGhostEntity: () => entity as never }));
    lastDraw()(makeFrame({ x: 1, y: 2 }));
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockRender.mock.calls[0][1]).toBe(entity);
  });

  it('skips paint when buildGhostEntity returns null', () => {
    renderHook(() => useWysiwygPlacementGhost({ ...baseCfg, buildGhostEntity: () => null }));
    lastDraw()(makeFrame({ x: 1, y: 2 }));
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('uses paintGhost override instead of the default paint', () => {
    const paintGhost = jest.fn();
    renderHook(() =>
      useWysiwygPlacementGhost({ ...baseCfg, buildGhostEntity: () => ({ id: 'x' }) as never, paintGhost }),
    );
    lastDraw()(makeFrame({ x: 1, y: 2 }));
    expect(paintGhost).toHaveBeenCalledTimes(1);
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('runs drawOverlay every frame, even when no entity is built', () => {
    const drawOverlay = jest.fn();
    renderHook(() => useWysiwygPlacementGhost({ ...baseCfg, buildGhostEntity: () => null, drawOverlay }));
    lastDraw()(makeFrame(null));
    expect(drawOverlay).toHaveBeenCalledTimes(1);
  });
});

describe('createBridgeStorePlacementGhostHook (factory)', () => {
  const overrides = { width: 500 };
  const params = { foo: 'params' };
  const entity = { id: 'built' };

  function makeSpec(built: { ok: true; entity: unknown } | { ok: false; hardErrors: string[] }) {
    const buildDefaultParams = jest.fn(() => params);
    const buildEntity = jest.fn(() => built);
    const bridgeStore = { get: () => ({ overrides, getSceneUnits: () => 'mm' as const }) };
    const hook = createBridgeStorePlacementGhostHook({
      bridgeStore,
      buildDefaultParams: buildDefaultParams as never,
      buildEntity: buildEntity as never,
    });
    return { hook, buildDefaultParams, buildEntity };
  }

  it('builds from the bridge store (overrides + sceneUnits) and paints the entity', () => {
    const { hook, buildDefaultParams, buildEntity } = makeSpec({ ok: true, entity });
    renderHook(() => hook({ isAwaitingPosition: true, transform: {} as ViewTransform, getCanvas: () => null }));
    lastDraw()(makeFrame({ x: 3, y: 4 }));
    expect(buildDefaultParams).toHaveBeenCalledWith({ x: 3, y: 4 }, overrides, 'mm');
    expect(buildEntity).toHaveBeenCalledWith(params, 'layer-test');
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockRender.mock.calls[0][1]).toBe(entity);
  });

  it('skips when there is no effective cursor', () => {
    const { hook, buildDefaultParams } = makeSpec({ ok: true, entity });
    renderHook(() => hook({ isAwaitingPosition: true, transform: {} as ViewTransform, getCanvas: () => null }));
    lastDraw()(makeFrame(null));
    expect(buildDefaultParams).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('skips paint when the entity build fails (ok: false)', () => {
    const { hook } = makeSpec({ ok: false, hardErrors: ['bad'] });
    renderHook(() => hook({ isAwaitingPosition: true, transform: {} as ViewTransform, getCanvas: () => null }));
    lastDraw()(makeFrame({ x: 3, y: 4 }));
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('gates the harness on isAwaitingPosition', () => {
    const { hook } = makeSpec({ ok: true, entity });
    renderHook(() => hook({ isAwaitingPosition: false, transform: {} as ViewTransform, getCanvas: () => null }));
    expect(mockHarness.mock.calls.at(-1)![0].isActive).toBe(false);
  });
});

describe('module-load smoke — all 9 thin bindings export a hook', () => {
  const modules: ReadonlyArray<readonly [string, string]> = [
    ['../useElectricalPanelGhostPreview', 'useElectricalPanelGhostPreview'],
    ['../useMepBoilerGhostPreview', 'useMepBoilerGhostPreview'],
    ['../useMepManifoldGhostPreview', 'useMepManifoldGhostPreview'],
    ['../useMepRadiatorGhostPreview', 'useMepRadiatorGhostPreview'],
    ['../useMepWaterHeaterGhostPreview', 'useMepWaterHeaterGhostPreview'],
    ['../useMepFixtureGhostPreview', 'useMepFixtureGhostPreview'],
    ['../useOpeningGhostPreview', 'useOpeningGhostPreview'],
    ['../useMepSegmentGhostPreview', 'useMepSegmentGhostPreview'],
    ['../useSlabOpeningGhostPreview', 'useSlabOpeningGhostPreview'],
  ];

  it.each(modules)('%s exports a callable %s', (path, name) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(path) as Record<string, unknown>;
    expect(typeof mod[name]).toBe('function');
  });
});
