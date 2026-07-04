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
// ADR-510 Φ4g — active-tool SSoT drives the contextual fillet/chamfer option panels.
import { toolStateStore } from '../../../../stores/ToolStateStore';
// ADR-510 Φ4b — το «Χρώμα» πεδίο μιλάει HEX μέσω του κεντρικού dxf-color picker· το
// bridge αποθηκεύει true-color (`hexToTrueColor`) + πλησιέστερο ACI (`findClosestAci`).
import { getAciColor, findClosestAci } from '../../../../settings/standards/aci';
import { hexToTrueColor } from '../../../../utils/dxf-true-color';

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
  colorTrueColor: null as number | null,
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
    // ADR-510 Φ4b — `color` lets the dxf-color swatch resolve a ByLayer entity to
    // the layer's rendered hex (via the SSoT resolveRenderedColorHex cascade).
    { id: 'lvl-1', name: 'Layer 1', color: '#00FF00' },
    { id: 'lyr-2', name: 'Walls', color: '#123456' },
  ],
  currentLayerId: 'lvl-1',
  recentLayerIds: [] as string[],
};
jest.mock('../../../../stores/LayerStore', () => ({
  getLayerStoreSnapshot: () => mockLayerSnapshot,
  subscribeLayerStore: () => () => {},
  // Used by the SSoT resolveEntityLayer name-fallback (id lookup wins first in these tests).
  resolveEntityLayerName: (e: { layerId?: string } | null) => e?.layerId ?? null,
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

// ADR-510 Φ4b — layers ενός φορτωμένου DXF ζουν στο `scene.layersById` (id-keyed),
// ΟΧΙ στο project-wide LayerStore· ο color swatch τα επιλύει από εκεί (όπως ο renderer).
const sceneLayersById = {
  'lvl-1': { id: 'lvl-1', name: 'Layer 1', color: '#00FF00' },
  'lyr-2': { id: 'lyr-2', name: 'Walls', color: '#123456' },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity
    ? { entities: [entity], layersById: sceneLayersById }
    : { entities: [], layersById: sceneLayersById };
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
  mockQuickSnapshot.colorTrueColor = null;
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

  it('reads color as effective hex (Concrete ACI → dxf-color picker hex)', () => {
    // colorAci 1 wins over the layer color (Concrete) → getAciColor(1), uppercased.
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.color)?.value)
      .toBe(getAciColor(1).toUpperCase());
  });

  it('reads a baked concrete-hex line from entity.color when no layer resolves (bug: swatch λευκό)', () => {
    // Exploded DXF: πράσινη γραμμή με baked `color` hex, layerId εκτός layersById → το
    // swatch πρέπει να δείχνει το entity.color, ΟΧΙ fallback λευκό.
    const bakedLine = { id: 'baked-1', type: 'line' as const, layerId: 'ghost-layer', visible: true,
      start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, color: '#00FF00' };
    const r = renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(bakedLine),
        universalSelection: makeSelection('baked-1'),
      }),
    ).result;
    expect(r.current.getComboboxState(LINE_TOOL_RIBBON_KEYS.color)?.value).toBe('#00FF00');
  });

  it('reads a ByLayer line color from scene.layersById (bug: swatch έδειχνε λευκό)', () => {
    // Γραμμή ByLayer σε DXF layer «lvl-1» (πράσινο, μόνο στο scene.layersById) → το
    // swatch πρέπει να δείχνει το χρώμα του layer, ΟΧΙ fallback λευκό.
    const byLayerLine = { id: 'bl-1', type: 'line' as const, layerId: 'lvl-1', visible: true,
      start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, colorMode: 'ByLayer' as const };
    const r = renderHook(() =>
      useRibbonLineToolBridge({
        levelManager: makeLevelManager(byLayerLine),
        universalSelection: makeSelection('bl-1'),
      }),
    ).result;
    expect(r.current.getComboboxState(LINE_TOOL_RIBBON_KEYS.color)?.value).toBe('#00FF00');
  });

  it('reads linetype scale (CELTSCALE) from the selected entity', () => {
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetypeScale)?.value).toBe('2');
  });

  it('linetype options come from the live registry (ByLayer + registered names) with thumbnails', () => {
    const opts = render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.linetype)?.options ?? [];
    expect(opts[0]?.value).toBe('ByLayer');
    expect(opts.some((o) => o.value === 'Continuous')).toBe(true);
    expect(opts.length).toBeGreaterThan(1);
    // ADR-510 Φ4b — κάθε επιλογή φέρει inline-SVG thumbnail (κοινό SSoT με διαστάσεις).
    expect(opts[0]?.thumbnail).toEqual({ kind: 'linetype', name: 'ByLayer' });
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

  it('color (hex) stores all three channels (hex + true-color + closest ACI, Concrete)', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.color, '#0000FF');
    // color:hex drives the fallback render path· colorTrueColor drives resolveEntityStyle·
    // colorAci is the DXF export degrade. All three set → κάθε path δείχνει το ίδιο χρώμα.
    expect((UpdateEntityCommand as unknown as jest.Mock).mock.calls[0][1]).toEqual({
      colorMode: 'Concrete',
      color: '#0000FF',
      colorTrueColor: hexToTrueColor('#0000FF'),
      colorAci: findClosestAci('#0000FF'),
    });
    expect(findClosestAci('#0000FF')).toBe(5); // sanity: pure blue → ACI 5
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

  it('reads color (ByLayer default) as the current layer hex', () => {
    // colorMode 'ByLayer' + currentLayerId lvl-1 (color #00FF00) → resolved layer hex.
    expect(render().current.getComboboxState(LINE_TOOL_RIBBON_KEYS.color)?.value).toBe('#00FF00');
  });

  it('color (hex) change writes a Concrete true-color + closest ACI to QuickStyle', () => {
    render().current.onComboboxChange(LINE_TOOL_RIBBON_KEYS.color, '#0000FF');
    expect(mockSetColor).toHaveBeenCalledWith('Concrete', findClosestAci('#0000FF'), hexToTrueColor('#0000FF'));
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

describe('useRibbonLineToolBridge — Φ4g Options-Bar visibility (fillet/chamfer active-tool)', () => {
  const FILLET = LINE_TOOL_PANEL_VISIBILITY_KEYS.filletOptions;
  const CHAMFER = LINE_TOOL_PANEL_VISIBILITY_KEYS.chamferOptions;

  afterEach(() => toolStateStore.selectTool('select'));

  it('fillet options are hidden unless the fillet tool is active', () => {
    toolStateStore.selectTool('select');
    expect(renderNone().current.getPanelVisibility(FILLET)).toBe(false);
    toolStateStore.selectTool('fillet');
    expect(renderNone().current.getPanelVisibility(FILLET)).toBe(true);
  });

  it('chamfer options are hidden unless the chamfer tool is active', () => {
    toolStateStore.selectTool('select');
    expect(renderNone().current.getPanelVisibility(CHAMFER)).toBe(false);
    toolStateStore.selectTool('chamfer');
    expect(renderNone().current.getPanelVisibility(CHAMFER)).toBe(true);
  });

  it('the two option panels are mutually exclusive by active tool', () => {
    toolStateStore.selectTool('fillet');
    const r = renderNone().current;
    expect(r.getPanelVisibility(FILLET)).toBe(true);
    expect(r.getPanelVisibility(CHAMFER)).toBe(false);
  });
});
