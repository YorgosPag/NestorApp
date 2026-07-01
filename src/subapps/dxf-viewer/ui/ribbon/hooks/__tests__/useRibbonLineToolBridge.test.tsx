/**
 * ADR-510 Φ2E — useRibbonLineToolBridge dual-mode tests.
 *
 * Coverage:
 *   - Selected primitive: getComboboxState reads linetype/lineweight/color from
 *     the entity; onComboboxChange dispatches an undoable UpdateEntityCommand.
 *   - No selection / non-primitive selected: falls back to QuickStyleStore
 *     (draw-defaults) — no UpdateEntityCommand.
 *   - Linetype options = live LinetypeRegistry (ByLayer + registered names).
 */

import { renderHook } from '@testing-library/react';
import { useRibbonLineToolBridge } from '../useRibbonLineToolBridge';
import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
} from '../bridge/line-tool-command-keys';
import { UpdateEntityCommand } from '../../../../core/commands/entity-commands/UpdateEntityCommand';
import { resetGlobalCommandHistory } from '../../../../core/commands';
import {
  registerLinetype,
  __resetLinetypeRegistryForTesting,
} from '../../../../stores/LinetypeRegistry';
import { toDisplay, fromDisplay } from '../../../../config/units';
import { displayUnitState } from '../../../../config/display-unit-state';

// ── Mock UpdateEntityCommand to capture selected-entity writes ─────────────────
jest.mock(
  '../../../../core/commands/entity-commands/UpdateEntityCommand',
  () => ({
    UpdateEntityCommand: jest.fn().mockImplementation((id, patch, _sm, label) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      redo: jest.fn(),
      validate: jest.fn(() => null),
      getAffectedEntityIds: jest.fn(() => [id]),
      __id: id,
      __patch: patch,
      __label: label,
    })),
  }),
);

// ── Mock QuickStyleStore to control draw-defaults snapshot + capture setters ───
const mockQuickSnapshot = {
  linetypeName: 'Continuous',
  lineweightMm: -2, // ByLayer sentinel
  colorMode: 'ByLayer' as 'ByLayer' | 'Concrete',
  colorAci: null as number | null,
  ltscale: 1,
};
const mockSetLinetype = jest.fn();
const mockSetLineweight = jest.fn();
const mockSetColor = jest.fn();
const mockSetLtscale = jest.fn();
jest.mock('../../../../stores/QuickStyleStore', () => ({
  getQuickStyleSnapshot: () => mockQuickSnapshot,
  subscribeQuickStyle: () => () => {},
  setQuickStyleLinetype: (...a: unknown[]) => mockSetLinetype(...a),
  setQuickStyleLineweight: (...a: unknown[]) => mockSetLineweight(...a),
  setQuickStyleColor: (...a: unknown[]) => mockSetColor(...a),
  setQuickStyleLtscale: (...a: unknown[]) => mockSetLtscale(...a),
}));

// ── Mock LayerStore (ADR-510 Φ4 — layer dropdown + current-layer default) ──────
const mockLayerSnapshot = {
  layers: [
    { id: 'lvl-1', name: 'Layer 1' },
    { id: 'lyr-2', name: 'Walls' },
  ],
  currentLayerId: 'lvl-1',
  recentLayerIds: [] as string[],
};
jest.mock('../../../../stores/LayerStore', () => ({
  getLayerStoreSnapshot: () => mockLayerSnapshot,
  subscribeLayerStore: () => () => {},
}));

// ── Mock shared current-layer SSoT action (ADR-358/510 Φ4) — the ribbon default
// (no-selection) layer change delegates to `useCurrentLayerChange`, the SAME
// path as the CurrentLayerPicker popover (permission gate + toast + recent FIFO).
const mockChangeCurrentLayer = jest.fn(() => 'changed' as const);
jest.mock('../../../components/layer-picker/useCurrentLayerChange', () => ({
  useCurrentLayerChange: () => ({ changeCurrentLayer: mockChangeCurrentLayer }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const lineEntity = {
  id: 'line-1',
  type: 'line' as const,
  layerId: 'lvl-1',
  visible: true,
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
  linetypeName: 'DASHED',
  lineweightMm: 0.35,
  colorMode: 'Concrete' as const,
  colorAci: 1,
  ltscale: 2,
};

const wallEntity = { id: 'wall-1', type: 'wall' as const, layerId: 'lvl-1', visible: true };

// 3 vertices, open → 2 segments. Width arrays index-aligned (ADR-510 Φ3d).
const polylineEntity = {
  id: 'pl-1',
  type: 'polyline' as const,
  layerId: 'lvl-1',
  visible: true,
  vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  closed: false,
  startWidths: [100, 100],
  endWidths: [100, 100],
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity] } : { entities: [] };
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonLineToolBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
  } as unknown as Parameters<typeof useRibbonLineToolBridge>[0]['universalSelection'];
}

beforeEach(() => {
  resetGlobalCommandHistory();
  __resetLinetypeRegistryForTesting();
  (UpdateEntityCommand as unknown as jest.Mock).mockClear();
  mockSetLinetype.mockClear();
  mockSetLineweight.mockClear();
  mockSetColor.mockClear();
  mockSetLtscale.mockClear();
  mockChangeCurrentLayer.mockClear();
  mockQuickSnapshot.linetypeName = 'Continuous';
  mockQuickSnapshot.lineweightMm = -2;
  mockQuickSnapshot.colorMode = 'ByLayer';
  mockQuickSnapshot.colorAci = null;
  mockQuickSnapshot.ltscale = 1;
});

// ─────────────────────────────────────────────────────────────────────────────
// SELECTED PRIMITIVE BRANCH
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonLineToolBridge — selected primitive (read)', () => {
  function render() {
    return renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(lineEntity),
        universalSelection: makeSelection('line-1'),
      }),
    ).result;
  }

  it('reads linetype from the selected entity', () => {
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetype)?.value).toBe('DASHED');
  });

  it('reads lineweight from the selected entity', () => {
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.lineweight)?.value).toBe('0.35');
  });

  it('reads color (ACI) from the selected entity', () => {
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.color)?.value).toBe('1');
  });

  it('reads linetype scale (CELTSCALE) from the selected entity', () => {
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetypeScale)?.value).toBe('2');
  });

  it('linetype options come from the live registry (ByLayer + registered names)', () => {
    const opts = render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetype)?.options ?? [];
    expect(opts[0]?.value).toBe('ByLayer');
    expect(opts.some((o) => o.value === 'Continuous')).toBe(true);
    expect(opts.length).toBeGreaterThan(1);
  });
});

describe('useRibbonLineToolBridge — selected primitive (write = undoable command)', () => {
  function render() {
    return renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(lineEntity),
        universalSelection: makeSelection('line-1'),
      }),
    ).result;
  }

  it('linetype change dispatches UpdateEntityCommand with the new name', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetype, 'HIDDEN');
    const call = (UpdateEntityCommand as unknown as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('line-1');
    expect(call[1]).toEqual({ linetypeName: 'HIDDEN' });
    expect(mockSetLinetype).not.toHaveBeenCalled();
  });

  it('lineweight change dispatches a numeric mm patch', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.lineweight, '0.50');
    expect((UpdateEntityCommand as unknown as jest.Mock).mock.calls[0][1]).toEqual({ lineweightMm: 0.5 });
  });

  it('linetype scale change dispatches a numeric ltscale patch', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetypeScale, '1.5');
    expect((UpdateEntityCommand as unknown as jest.Mock).mock.calls[0][1]).toEqual({ ltscale: 1.5 });
    expect(mockSetLtscale).not.toHaveBeenCalled();
  });

  it('linetype scale change ignores non-positive / NaN values (no command)', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetypeScale, '0');
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetypeScale, 'abc');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('color → ByLayer clears the concrete color fields', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.color, 'ByLayer');
    expect((UpdateEntityCommand as unknown as jest.Mock).mock.calls[0][1]).toEqual({
      colorMode: 'ByLayer', colorAci: undefined, color: undefined, colorTrueColor: null,
    });
  });

  it('color → ACI sets a Concrete color patch', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.color, '3');
    expect((UpdateEntityCommand as unknown as jest.Mock).mock.calls[0][1]).toEqual({
      colorMode: 'Concrete', colorAci: 3, color: undefined, colorTrueColor: null,
    });
  });

  it('registered custom linetype appears in the live options', () => {
    registerLinetype({ name: 'MY-CUSTOM', description: 'x', pattern: [5, -5] } as Parameters<typeof registerLinetype>[0]);
    const opts = render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetype)?.options ?? [];
    expect(opts.some((o) => o.value === 'MY-CUSTOM')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRAW-DEFAULTS FALLBACK BRANCH
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonLineToolBridge — no selection → QuickStyle draw-defaults', () => {
  function render() {
    return renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    ).result;
  }

  it('reads linetype from QuickStyle snapshot', () => {
    mockQuickSnapshot.linetypeName = 'CENTER';
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetype)?.value).toBe('CENTER');
  });

  it('linetype change writes to QuickStyle, not an entity command', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetype, 'PHANTOM');
    expect(mockSetLinetype).toHaveBeenCalledWith('PHANTOM');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('reads linetype scale from QuickStyle snapshot', () => {
    mockQuickSnapshot.ltscale = 3;
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetypeScale)?.value).toBe('3');
  });

  it('linetype scale change writes to QuickStyle, not an entity command', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetypeScale, '2.5');
    expect(mockSetLtscale).toHaveBeenCalledWith(2.5);
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POLYLINE WIDTH (ADR-510 Φ3d)
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonLineToolBridge — polyline width (Φ3d)', () => {
  const unit = displayUnitState.getUnit();

  function renderPolyline() {
    return renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(polylineEntity),
        universalSelection: makeSelection('pl-1'),
      }),
    ).result;
  }

  it('reads the uniform width from the selected polyline (in display unit)', () => {
    const expected = String(toDisplay(100, unit).value);
    expect(renderPolyline().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.width)?.value).toBe(expected);
  });

  it('width change writes a uniform per-segment patch (display → mm) for both sides', () => {
    renderPolyline().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.width, '0.2');
    const mm = fromDisplay(0.2, unit);
    expect((UpdateEntityCommand as unknown as jest.Mock).mock.calls[0][1]).toEqual({
      startWidths: [mm, mm], // 2 segments
      endWidths: [mm, mm],
    });
  });

  it('width 0 clears to zero-width segments (hairline)', () => {
    renderPolyline().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.width, '0');
    expect((UpdateEntityCommand as unknown as jest.Mock).mock.calls[0][1]).toEqual({
      startWidths: [0, 0],
      endWidths: [0, 0],
    });
  });

  it('width is 0 and writes nothing for a non-polyline selection', () => {
    const result = renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(lineEntity),
        universalSelection: makeSelection('line-1'),
      }),
    ).result;
    expect(result.current.getComboboxState(LINE_TOOL_RIBBON_KEYS.width)?.value).toBe('0');
    result.current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.width, '0.3');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('useRibbonLineToolBridge — non-primitive selected → draw-defaults', () => {
  it('a selected wall does NOT route to UpdateEntityCommand', () => {
    const result = renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(wallEntity),
        universalSelection: makeSelection('wall-1'),
      }),
    ).result;
    result.current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.linetype, 'DASHED');
    expect(mockSetLinetype).toHaveBeenCalledWith('DASHED');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADR-510 Φ4 — AutoCAD-grade General (layer / transparency) + Geometry
// ─────────────────────────────────────────────────────────────────────────────

const K = LINE_TOOL_RIBBON_KEYS;
const patchOf = (n = 0) =>
  (UpdateEntityCommand as unknown as jest.Mock).mock.calls[n][1] as Record<string, unknown>;
const renderLine = () =>
  renderHook(() =>
    useRibbonLineToolBridge({
      levelManager: makeLevelManager(lineEntity),
      universalSelection: makeSelection('line-1'),
    }),
  ).result;
const renderPolyline = () =>
  renderHook(() =>
    useRibbonLineToolBridge({
      levelManager: makeLevelManager(polylineEntity),
      universalSelection: makeSelection('pl-1'),
    }),
  ).result;
const renderNone = () =>
  renderHook(() =>
    useRibbonLineToolBridge({
      levelManager: makeLevelManager(null),
      universalSelection: makeSelection(null),
    }),
  ).result;

describe('useRibbonLineToolBridge — Φ4 General (layer + transparency)', () => {
  it('reads the entity layer id', () => {
    expect(renderLine().current.getComboboxState(K.layer)?.value).toBe('lvl-1');
  });

  it('layer options come from the live LayerStore', () => {
    const opts = renderLine().current.getComboboxState(K.layer)?.options ?? [];
    expect(opts.map((o) => o.value)).toEqual(['lvl-1', 'lyr-2']);
  });

  it('layer change patches layerId on the selected entity', () => {
    renderLine().current.onComboboxChange(K.layer, 'lyr-2');
    expect(patchOf()).toEqual({ layerId: 'lyr-2' });
  });

  it('layer change with no selection routes through the shared current-layer SSoT', () => {
    renderNone().current.onComboboxChange(K.layer, 'lyr-2');
    expect(mockChangeCurrentLayer).toHaveBeenCalledWith('lyr-2');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('transparency defaults to 0 and clamps to 0..90 on write', () => {
    const r = renderLine();
    expect(r.current.getComboboxState(K.transparency)?.value).toBe('0');
    r.current.onComboboxChange(K.transparency, '150');
    expect(patchOf()).toEqual({ transparency: 90 });
  });
});

describe('useRibbonLineToolBridge — Φ4 Geometry (selected line)', () => {
  const unit = displayUnitState.getUnit();
  const disp = (mm: number) => String(toDisplay(mm, unit).value);

  it('reads length (display unit) and angle (degrees) from the endpoints', () => {
    const r = renderLine();
    expect(r.current.getComboboxState(K.length)?.value).toBe(disp(10));
    expect(r.current.getComboboxState(K.angle)?.value).toBe('0');
  });

  it('reads start / end / delta coordinates in display units', () => {
    const r = renderLine();
    expect(r.current.getComboboxState(K.startX)?.value).toBe(disp(0));
    expect(r.current.getComboboxState(K.endX)?.value).toBe(disp(10));
    expect(r.current.getComboboxState(K.deltaX)?.value).toBe(disp(10));
    expect(r.current.getComboboxState(K.deltaY)?.value).toBe(disp(0));
  });

  it('length change moves end to the typed length (display → mm)', () => {
    renderLine().current.onComboboxChange(K.length, disp(20));
    const end = patchOf().end as { x: number; y: number };
    expect(end.x).toBeCloseTo(20, 6);
    expect(end.y).toBeCloseTo(0, 6);
  });

  it('angle change rotates end about start keeping the length', () => {
    renderLine().current.onComboboxChange(K.angle, '90');
    const end = patchOf().end as { x: number; y: number };
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.y).toBeCloseTo(10, 6);
  });

  it('startX change patches the start coordinate (display → mm)', () => {
    renderLine().current.onComboboxChange(K.startX, disp(5));
    const start = patchOf().start as { x: number; y: number };
    expect(start.x).toBeCloseTo(5, 6);
    expect(start.y).toBeCloseTo(0, 6);
  });

  it('deltaX change sets end so end-start equals the delta', () => {
    renderLine().current.onComboboxChange(K.deltaX, disp(3));
    const end = patchOf().end as { x: number; y: number };
    expect(end.x).toBeCloseTo(3, 6);
  });

  it('geometry write is a no-op for a non-line primitive', () => {
    renderPolyline().current.onComboboxChange(K.length, '5');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('useRibbonLineToolBridge — Φ4 panel visibility (geometry is line-only)', () => {
  const GEOM = LINE_TOOL_PANEL_VISIBILITY_KEYS.geometry;

  it('geometry panel is visible for a selected line', () => {
    expect(renderLine().current.getPanelVisibility(GEOM)).toBe(true);
  });

  it('geometry panel is hidden for a selected polyline', () => {
    expect(renderPolyline().current.getPanelVisibility(GEOM)).toBe(false);
  });

  it('geometry panel is hidden with no selection', () => {
    expect(renderNone().current.getPanelVisibility(GEOM)).toBe(false);
  });

  it('an unknown visibility key defaults to visible', () => {
    expect(renderLine().current.getPanelVisibility('whatever')).toBe(true);
  });
});
