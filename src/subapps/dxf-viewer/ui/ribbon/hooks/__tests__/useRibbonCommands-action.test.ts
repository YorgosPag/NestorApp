/**
 * ADR-363 — central «Κλείσιμο» (close) interceptor tests.
 *
 * Regression (browser bug Giorgio 2026-06-23): the «Κλείσιμο» button in EVERY
 * contextual tab did nothing. Three broken patterns coexisted:
 *   - column/wall/slab/roof/opening/beam/foundation → bridge had NO close branch
 *     → button no-op.
 *   - thermalSpace/hatch/floorFinish/wallCovering → emitted `bim:select-none`,
 *     an event with NO listener → no-op.
 *   - mep* → `clearAll()` (the one working pattern).
 *
 * Fix: `routeRibbonAction` intercepts any `*.action(s).close` key BEFORE
 * per-bridge routing and calls the single `closeContextualTab` primitive
 * (`universalSelection.clearAll()`).
 */

// The 4 legacy bridges expose their `isXActionKey` from the bridge file itself
// (not a pure command-keys module), and those bridges transitively import
// firebase/levels. Stub them so importing the router stays dependency-light;
// the central close branch fires BEFORE these predicates are ever consulted.
jest.mock('../useRibbonThermalSpaceBridge', () => ({ isThermalSpaceActionKey: () => false }));
jest.mock('../useRibbonHatchBridge', () => ({ isHatchActionKey: () => false }));
jest.mock('../useRibbonFloorFinishBridge', () => ({ isFloorFinishActionKey: () => false }));
jest.mock('../useRibbonWallCoveringBridge', () => ({ isWallCoveringActionKey: () => false }));

import { isContextualTabCloseAction } from '../bridge/contextual-tab-close';
import {
  routeRibbonAction,
  type RibbonActionBridges,
} from '../useRibbonCommands-action';

describe('isContextualTabCloseAction', () => {
  it('matches both plural `.actions.close` and singular `.action.close` forms', () => {
    expect(isContextualTabCloseAction('column.actions.close')).toBe(true);
    expect(isContextualTabCloseAction('wall.actions.close')).toBe(true);
    expect(isContextualTabCloseAction('beam.actions.close')).toBe(true);
    expect(isContextualTabCloseAction('mepWaterHeater.actions.close')).toBe(true);
    // legacy singular form (thermalSpace/hatch/floorFinish/wallCovering)
    expect(isContextualTabCloseAction('thermalSpace.action.close')).toBe(true);
    expect(isContextualTabCloseAction('hatch.action.close')).toBe(true);
    expect(isContextualTabCloseAction('floorFinish.action.close')).toBe(true);
    expect(isContextualTabCloseAction('wallCovering.action.close')).toBe(true);
  });

  it('does NOT match non-close actions', () => {
    expect(isContextualTabCloseAction('column.actions.delete')).toBe(false);
    expect(isContextualTabCloseAction('column.actions.autoReinforce')).toBe(false);
    expect(isContextualTabCloseAction('array-close-tab')).toBe(false);
    expect(isContextualTabCloseAction('close')).toBe(false);
    expect(isContextualTabCloseAction('something.closer')).toBe(false);
    expect(isContextualTabCloseAction('')).toBe(false);
  });
});

/**
 * Builds a `RibbonActionBridges` mock where every bridge exposes a jest.fn
 * `onAction`, plus the `closeContextualTab`/`wrappedHandleAction` callbacks.
 * `routeRibbonAction` only ever calls `.onAction` on a bridge, so the minimal
 * shape is sufficient; the cast is test-only (no `any`).
 */
function makeBridges(): {
  bridges: RibbonActionBridges;
  closeContextualTab: jest.Mock;
  wrappedHandleAction: jest.Mock;
  columnOnAction: jest.Mock;
} {
  const closeContextualTab = jest.fn();
  const wrappedHandleAction = jest.fn();
  const columnOnAction = jest.fn();
  const bridge = (onAction: jest.Mock) => ({ onAction });

  const bridges = {
    closeContextualTab,
    wrappedHandleAction,
    columnBridge: bridge(columnOnAction),
    wallBridge: bridge(jest.fn()),
    openingBridge: bridge(jest.fn()),
    slabBridge: bridge(jest.fn()),
    roofBridge: bridge(jest.fn()),
    floorFinishBridge: bridge(jest.fn()),
    wallCoveringBridge: bridge(jest.fn()),
    hatchBridge: bridge(jest.fn()),
    thermalSpaceBridge: bridge(jest.fn()),
    beamBridge: bridge(jest.fn()),
    foundationBridge: bridge(jest.fn()),
    slabOpeningBridge: bridge(jest.fn()),
    stairBridge: bridge(jest.fn()),
    mepCircuitBridge: bridge(jest.fn()),
    mepPipeNetworkBridge: bridge(jest.fn()),
    waterAutoSupplyBridge: bridge(jest.fn()),
    drainageAutoBridge: bridge(jest.fn()),
    heatingAutoBridge: bridge(jest.fn()),
    electricalAutoBridge: bridge(jest.fn()),
    electricalWeakAutoBridge: bridge(jest.fn()),
    hvacAutoBridge: bridge(jest.fn()),
    fireAutoBridge: bridge(jest.fn()),
    gasAutoBridge: bridge(jest.fn()),
    clashDetectionBridge: bridge(jest.fn()),
    mepFixtureBridge: bridge(jest.fn()),
    mepManifoldBridge: bridge(jest.fn()),
    electricalPanelBridge: bridge(jest.fn()),
    mepRadiatorBridge: bridge(jest.fn()),
    mepBoilerBridge: bridge(jest.fn()),
    mepWaterHeaterBridge: bridge(jest.fn()),
    mepUnderfloorBridge: bridge(jest.fn()),
    mepSegmentBridge: bridge(jest.fn()),
    furnitureBridge: bridge(jest.fn()),
  } as unknown as RibbonActionBridges;

  return { bridges, closeContextualTab, wrappedHandleAction, columnOnAction };
}

describe('routeRibbonAction — central close interception', () => {
  it('routes a column close to closeContextualTab, NOT to the column bridge', () => {
    const { bridges, closeContextualTab, columnOnAction } = makeBridges();
    routeRibbonAction('column.actions.close', undefined, bridges);
    expect(closeContextualTab).toHaveBeenCalledTimes(1);
    // Priority: the owning bridge (which has no close branch) must never see it.
    expect(columnOnAction).not.toHaveBeenCalled();
  });

  it('routes a legacy singular close (thermalSpace) to closeContextualTab', () => {
    const { bridges, closeContextualTab } = makeBridges();
    routeRibbonAction('thermalSpace.action.close', undefined, bridges);
    expect(closeContextualTab).toHaveBeenCalledTimes(1);
  });

  it('does NOT call closeContextualTab for a non-close action; routes to owner', () => {
    const { bridges, closeContextualTab, columnOnAction } = makeBridges();
    routeRibbonAction('column.actions.delete', undefined, bridges);
    expect(closeContextualTab).not.toHaveBeenCalled();
    expect(columnOnAction).toHaveBeenCalledWith('column.actions.delete');
  });

  it('falls through unowned actions to wrappedHandleAction', () => {
    const { bridges, closeContextualTab, wrappedHandleAction } = makeBridges();
    routeRibbonAction('some-generic-toolbar-action', undefined, bridges);
    expect(closeContextualTab).not.toHaveBeenCalled();
    expect(wrappedHandleAction).toHaveBeenCalledWith('some-generic-toolbar-action', undefined);
  });
});
