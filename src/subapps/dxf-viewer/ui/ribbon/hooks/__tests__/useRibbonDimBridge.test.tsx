/**
 * ADR-562 Φ3 — useRibbonDimBridge tests (mirror του useRibbonLineToolBridge test).
 *
 * Coverage:
 *   - Selected dimension: getComboboxState reads the resolved per-part DIMSTYLE
 *     value (override → styleId → built-in); onComboboxChange dispatches an
 *     undoable UpdateEntityCommand writing `{ overrides: {...} }`.
 *   - Unified writes: ext linetype mirrors dimltex1→dimltex2; arrow style clears
 *     dimblk1/dimblk2 so both heads inherit the unified dimblk.
 *   - No selection → no command.
 */

import { renderHook } from '@testing-library/react';
import { useRibbonDimBridge } from '../useRibbonDimBridge';
import { DIM_RIBBON_KEYS } from '../bridge/dim-command-keys';
import { BUILTIN_DIM_STYLE_IDS } from '../../../../systems/dimensions/dim-style-templates';
import { UpdateEntityCommand } from '../../../../core/commands/entity-commands/UpdateEntityCommand';
import { resetGlobalCommandHistory } from '../../../../core/commands';
// ADR-562 Φ7 — the per-part color controls are now the enterprise hex color picker.
// getComboboxState returns a HEX string; onComboboxChange writes BOTH the nearest ACI
// (`findClosestAci`) AND the packed true-color companion (`hexToTrueColor`).
import { findClosestAci } from '../../../../settings/standards/aci';
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

const K = DIM_RIBBON_KEYS.override;
const CHOOSER = DIM_RIBBON_KEYS.style.chooser;

// ── Fixtures ──────────────────────────────────────────────────────────────────
// ISO 129 built-in: dimclrd=dimclre=dimclrt=256 (ByLayer), dimlwd=dimlwe=-2,
// dimltype=dimltex1=dimltex2='ByLayer', arrowColor omitted (inherits dimclrd).
const ISO = BUILTIN_DIM_STYLE_IDS.ISO_129;

/** Dimension carrying explicit per-part overrides (read tests). */
const dimWithOverrides = {
  id: 'dim-1',
  type: 'dimension' as const,
  dimensionType: 'linear',
  styleId: ISO,
  defPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 2 }],
  layer: '0',
  visible: true,
  overrides: {
    dimclrd: 1, dimlwd: 0.35, dimltype: 'Dashed',
    arrowColor: 3, dimasz: 5, textFontFamily: 'Roboto',
  },
};

/** Dimension with NO overrides (write tests → clean patch). */
const dimPlain = {
  id: 'dim-2',
  type: 'dimension' as const,
  dimensionType: 'linear',
  styleId: ISO,
  defPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 2 }],
  layer: '0',
  visible: true,
};

const wallEntity = { id: 'wall-1', type: 'wall' as const, layer: '0', visible: true };

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity] } : { entities: [] };
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonDimBridge>[0]['levelManager'];
}
function makeSelection(id: string | null) {
  return { getPrimaryId: jest.fn(() => id) } as unknown as Parameters<typeof useRibbonDimBridge>[0]['universalSelection'];
}
function renderWith(entity: unknown | null, id: string | null) {
  return renderHook(() =>
    useRibbonDimBridge({ levelManager: makeLevelManager(entity), universalSelection: makeSelection(id) }),
  ).result;
}
const patchOf = (n = 0) =>
  (UpdateEntityCommand as unknown as jest.Mock).mock.calls[n][1] as Record<string, unknown>;

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateEntityCommand as unknown as jest.Mock).mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// READ — resolved per-part values
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonDimBridge — selected dimension (read)', () => {
  const r = () => renderWith(dimWithOverrides, 'dim-1');

  it('reads dim-line color (as HEX, Φ7 picker) / weight / linetype from overrides', () => {
    // ACI 1 (red) override → the picker reads it back as its hex form.
    expect(r().current.getComboboxState(K.color)?.value).toBe('#FF0000');
    expect(r().current.getComboboxState(K.lineWeight)?.value).toBe('0.35');
    expect(r().current.getComboboxState(K.lineType)?.value).toBe('Dashed');
  });

  it('reads arrow size + separate arrow color (as HEX, Φ7 picker) + font', () => {
    expect(r().current.getComboboxState(K.arrowSize)?.value).toBe('5');
    // ACI 3 (green) arrow-color override → hex form.
    expect(r().current.getComboboxState(K.arrowColor)?.value).toBe('#00FF00');
    expect(r().current.getComboboxState(K.textFont)?.value).toBe('Roboto');
  });

  it('ADR-362 — linetype density (dimltscale) reads the default 1 when absent (not 0)', () => {
    expect(r().current.getComboboxState(K.lineTypeScale)?.value).toBe('1');
  });

  it('un-overridden extension color resolves the ByLayer built-in (256) to the default hex', () => {
    // Φ7 — the picker has no ByLayer sentinel; ACI 256 with no layer colour resolves
    // to the neutral default swatch so the picker opens on a sane value.
    expect(r().current.getComboboxState(K.extColor)?.value).toBe('#ffffff');
  });

  it('linetype options come from the live registry; arrow options from the block SSoT', () => {
    const lt = r().current.getComboboxState(K.lineType)?.options ?? [];
    expect(lt.some((o) => o.value === 'ByLayer')).toBe(true);
    expect(lt.some((o) => o.value === 'Continuous')).toBe(true);
    const arrows = r().current.getComboboxState(K.arrowStyle)?.options ?? [];
    expect(arrows.length).toBeGreaterThan(1);
    expect(arrows.some((o) => o.value === 'closedFilled')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — undoable overrides patch
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonDimBridge — selected dimension (write = undoable overrides)', () => {
  const r = () => renderWith(dimPlain, 'dim-2');

  it('color change (hex picker) writes the nearest ACI + the true-color companion', () => {
    const HEX = '#0000ff'; // pure blue → ACI 5
    r().current.onComboboxChange(K.color, HEX);
    expect(patchOf()).toEqual({
      overrides: { dimclrd: findClosestAci(HEX), dimclrdTrueColor: hexToTrueColor(HEX) },
    });
    expect(findClosestAci(HEX)).toBe(5); // sanity: pure blue → ACI 5
  });

  it('lineweight ByLayer → -2 sentinel', () => {
    r().current.onComboboxChange(K.lineWeight, 'ByLayer');
    expect(patchOf()).toEqual({ overrides: { dimlwd: -2 } });
  });

  it('ext linetype writes dimltex1 AND mirrors dimltex2 (unified)', () => {
    r().current.onComboboxChange(K.extType, 'Hidden');
    expect(patchOf()).toEqual({ overrides: { dimltex1: 'Hidden', dimltex2: 'Hidden' } });
  });

  it('arrow style writes dimblk and clears dimblk1/dimblk2 (both heads unified)', () => {
    r().current.onComboboxChange(K.arrowStyle, 'oblique');
    expect(patchOf()).toEqual({ overrides: { dimblk: 'oblique', dimblk1: '', dimblk2: '' } });
  });

  it('arrow color (hex picker) writes the separate arrowColor ACI + true-color companion', () => {
    const HEX = '#00ffff'; // pure cyan → ACI 4
    r().current.onComboboxChange(K.arrowColor, HEX);
    expect(patchOf()).toEqual({
      overrides: { arrowColor: findClosestAci(HEX), arrowTrueColor: hexToTrueColor(HEX) },
    });
    expect(findClosestAci(HEX)).toBe(4); // sanity: pure cyan → ACI 4
  });

  it('invalid arrow size (NaN) writes no command', () => {
    r().current.onComboboxChange(K.arrowSize, 'abc');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('ADR-362 — linetype density writes the dimltscale override', () => {
    r().current.onComboboxChange(K.lineTypeScale, '2');
    expect(patchOf()).toEqual({ overrides: { dimltscale: 2 } });
  });

  it('write merges on top of existing overrides (non-destructive)', () => {
    const HEX = '#ffffff'; // white → ACI 7
    renderWith(dimWithOverrides, 'dim-1').current.onComboboxChange(K.color, HEX);
    const ov = patchOf().overrides as Record<string, unknown>;
    expect(ov.dimclrd).toBe(findClosestAci(HEX));
    expect(ov.dimclrdTrueColor).toBe(hexToTrueColor(HEX)); // Φ7 companion also written
    expect(ov.dimlwd).toBe(0.35); // pre-existing override preserved
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DIMSTYLE CHOOSER — reads styleId, applies immediately (Revit type selector)
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonDimBridge — DIMSTYLE chooser', () => {
  it('reads the selected dim styleId; options come from the registry (incl. built-ins)', () => {
    const state = renderWith(dimPlain, 'dim-2').current.getComboboxState(CHOOSER);
    expect(state?.value).toBe(ISO);
    expect((state?.options ?? []).some((o) => o.value === ISO)).toBe(true);
    expect((state?.options ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('picking a different style applies it immediately (styleId patch)', () => {
    renderWith(dimPlain, 'dim-2').current.onComboboxChange(CHOOSER, BUILTIN_DIM_STYLE_IDS.ARCHITECTURAL_US);
    expect(patchOf()).toEqual({ styleId: BUILTIN_DIM_STYLE_IDS.ARCHITECTURAL_US });
  });

  it('re-picking the current style is a no-op (no command)', () => {
    renderWith(dimPlain, 'dim-2').current.onComboboxChange(CHOOSER, ISO);
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('no selection → empty chooser value + no command', () => {
    const r = renderWith(null, null);
    expect(r.current.getComboboxState(CHOOSER)?.value).toBe('');
    r.current.onComboboxChange(CHOOSER, BUILTIN_DIM_STYLE_IDS.ASME_Y14_5);
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEXT POSITION (DIMTAD override) + TEXT ROTATION (entity field)
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonDimBridge — text position + rotation', () => {
  const POSITION = DIM_RIBBON_KEYS.text.position;
  const ROTATION = DIM_RIBBON_KEYS.text.rotation;

  it('reads DIMTAD from the resolved style (ISO 129 → above)', () => {
    expect(renderWith(dimPlain, 'dim-2').current.getComboboxState(POSITION)?.value).toBe('above');
  });

  it('text position writes a DIMTAD override', () => {
    renderWith(dimPlain, 'dim-2').current.onComboboxChange(POSITION, 'centered');
    expect(patchOf()).toEqual({ overrides: { dimtad: 'centered' } });
  });

  it('reads text rotation from the entity field (defaults to 0)', () => {
    expect(renderWith(dimPlain, 'dim-2').current.getComboboxState(ROTATION)?.value).toBe('0');
    const rotated = { ...dimPlain, id: 'dim-r', textRotation: 45 };
    expect(renderWith(rotated, 'dim-r').current.getComboboxState(ROTATION)?.value).toBe('45');
  });

  it('text rotation writes the entity `textRotation` field (deg), not an override', () => {
    renderWith(dimPlain, 'dim-2').current.onComboboxChange(ROTATION, '90');
    expect(patchOf()).toEqual({ textRotation: 90 });
  });

  it('invalid text rotation (NaN) writes no command', () => {
    renderWith(dimPlain, 'dim-2').current.onComboboxChange(ROTATION, 'abc');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GUARDS
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonDimBridge — guards', () => {
  it('no selection → empty value + no command', () => {
    const r = renderWith(null, null);
    expect(r.current.getComboboxState(K.color)?.value).toBe('');
    r.current.onComboboxChange(K.color, '5');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('a selected non-dimension entity is ignored', () => {
    renderWith(wallEntity, 'wall-1').current.onComboboxChange(K.color, '5');
    expect(UpdateEntityCommand as unknown as jest.Mock).not.toHaveBeenCalled();
  });

  it('a non-dim command key returns null (not a combobox)', () => {
    expect(renderWith(dimPlain, 'dim-2').current.getComboboxState('line.tool.color')).toBeNull();
  });
});
