/**
 * ADR-507 Φ2 — useRibbonHatchBridge tests.
 *
 * Κρίσιμο regression (browser bug Giorgio): επιλογή predefined μοτίβου από το
 * dropdown ΠΡΕΠΕΙ να θέτει ΚΑΙ `fillType:'predefined'` — αλλιώς το fillType έμενε
 * 'solid' και ο renderer αγνοούσε το patternName (έκανε solid fill).
 *
 * Coverage: selected hatch (patch μέσω UpdateEntityCommand) + drawing-mode
 * (draw-defaults store), για patternName + patternScale + fillType + read state.
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonHatchBridge } from '../useRibbonHatchBridge';
import { HATCH_RIBBON_KEYS } from '../bridge/hatch-command-keys';
import { UpdateEntityCommand } from '../../../../core/commands/entity-commands/UpdateEntityCommand';
import { resetGlobalCommandHistory } from '../../../../core/commands';
import {
  getHatchDrawDefaults,
  setHatchDrawDefaults,
  resetHatchDrawDefaults,
} from '../../../../bim/hatch/hatch-draw-defaults-store';
import {
  hatchMinWorldSpacing,
  patternScaleForSpacingMm,
} from '../../../../bim/geometry/shared/hatch-pattern-geometry';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Capture τα patches χωρίς να εκτελείται πραγματικό scene mutation.
jest.mock('../../../../core/commands/entity-commands/UpdateEntityCommand', () => ({
  UpdateEntityCommand: jest.fn().mockImplementation((id, patch) => ({
    execute: jest.fn(), undo: jest.fn(), __id: id, __patch: patch,
  })),
}));

const solidHatch = {
  id: 'hatch-1', type: 'hatch' as const, layerId: 'lvl-1', visible: true,
  fillType: 'solid' as const, fillColor: '#808080',
  boundaryPaths: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]],
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonHatchBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
  } as unknown as Parameters<typeof useRibbonHatchBridge>[0]['universalSelection'];
}

const PATTERN_KEY = HATCH_RIBBON_KEYS.stringParams.patternName;
const SCALE_KEY = HATCH_RIBBON_KEYS.params.patternScale;
const ANGLE_KEY = HATCH_RIBBON_KEYS.params.lineAngle;
const SPACING_KEY = HATCH_RIBBON_KEYS.params.lineSpacing;
const FILLTYPE_KEY = HATCH_RIBBON_KEYS.stringParams.fillType;
const GRAD_TYPE_KEY = HATCH_RIBBON_KEYS.stringParams.gradientType;
const GRAD_COLOR1_KEY = HATCH_RIBBON_KEYS.stringParams.gradientColor1;
const GRAD_COLOR2_KEY = HATCH_RIBBON_KEYS.stringParams.gradientColor2;
const GRAD_ANGLE_KEY = HATCH_RIBBON_KEYS.params.gradientAngle;
const GRAD_SINGLE_KEY = HATCH_RIBBON_KEYS.toggles.gradientSingleColor;
const GRAD_VIS_KEY = HATCH_RIBBON_KEYS.visibility.gradient;

beforeEach(() => {
  resetGlobalCommandHistory();
  resetHatchDrawDefaults();
  (UpdateEntityCommand as jest.Mock).mockClear();
});

describe('useRibbonHatchBridge — patternName (selected hatch)', () => {
  it('επιλογή μοτίβου → patch θέτει fillType=predefined + patternName + patternType (το bug)', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(solidHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    act(() => result.current.onComboboxChange(PATTERN_KEY, 'AR-CONC'));
    const patch = (UpdateEntityCommand as jest.Mock).mock.calls[0]?.[1];
    expect(patch).toMatchObject({
      patternName: 'AR-CONC', fillType: 'predefined', patternType: 'pattern',
    });
  });

  it('getComboboxState διαβάζει το patternName της οντότητας', () => {
    const predef = { ...solidHatch, fillType: 'predefined' as const, patternName: 'BRICK' };
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(predef),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    expect(result.current.getComboboxState(PATTERN_KEY)?.value).toBe('BRICK');
  });
});

describe('useRibbonHatchBridge — patternName (drawing mode, χωρίς επιλογή)', () => {
  it('επιλογή μοτίβου → draw-defaults patternName + fillType=predefined', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => result.current.onComboboxChange(PATTERN_KEY, 'STEEL'));
    expect(getHatchDrawDefaults().patternName).toBe('STEEL');
    expect(getHatchDrawDefaults().fillType).toBe('predefined');
    // δεν εκτελέστηκε command (καμία επιλογή)
    expect((UpdateEntityCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('patternScale → draw-defaults patternScale', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => result.current.onComboboxChange(SCALE_KEY, '5'));
    expect(getHatchDrawDefaults().patternScale).toBe(5);
  });

  it('fillType=predefined από το Τύπος dropdown', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => result.current.onComboboxChange(FILLTYPE_KEY, 'predefined'));
    expect(getHatchDrawDefaults().fillType).toBe('predefined');
  });
});

describe('useRibbonHatchBridge — «Γωνία»/«Απόσταση» mode-aware routing (ADR-507 bug fix)', () => {
  const predefHatch = {
    ...solidHatch, fillType: 'predefined' as const, patternType: 'pattern' as const,
    patternName: 'ANSI31', patternScale: 1, patternAngle: 0,
  };

  it('«Γωνία» σε predefined hatch → γράφει patternAngle (ΟΧΙ lineAngle — το bug)', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(predefHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    act(() => result.current.onComboboxChange(ANGLE_KEY, '30'));
    const patch = (UpdateEntityCommand as jest.Mock).mock.calls[0]?.[1];
    expect(patch).toEqual({ patternAngle: 30 });
    expect(patch.lineAngle).toBeUndefined();
  });

  it('«Απόσταση» σε predefined hatch → γράφει patternScale (μετατροπή mm→×)', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(predefHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    act(() => result.current.onComboboxChange(SPACING_KEY, '100'));
    const patch = (UpdateEntityCommand as jest.Mock).mock.calls[0]?.[1];
    expect(patch.patternScale).toBeCloseTo(patternScaleForSpacingMm('ANSI31', 100), 6);
    expect(patch.lineSpacing).toBeUndefined();
  });

  it('«Γωνία» σε user-defined hatch → γράφει lineAngle (αμετάβλητη συμπεριφορά)', () => {
    const userHatch = { ...solidHatch, fillType: 'user-defined' as const, lineAngle: 0, lineSpacing: 100 };
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(userHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    act(() => result.current.onComboboxChange(ANGLE_KEY, '30'));
    expect((UpdateEntityCommand as jest.Mock).mock.calls[0]?.[1]).toEqual({ lineAngle: 30 });
  });

  it('read-back predefined: «Γωνία»=patternAngle, «Απόσταση»=world min-spacing', () => {
    const h = { ...predefHatch, patternAngle: 15, patternScale: 1 };
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(h),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    expect(result.current.getComboboxState(ANGLE_KEY)?.value).toBe('15');
    expect(result.current.getComboboxState(SPACING_KEY)?.value)
      .toBe(String(Math.round(hatchMinWorldSpacing(h))));
  });

  it('drawing mode predefined: «Γωνία»/«Απόσταση» → draw-defaults patternAngle/patternScale', () => {
    setHatchDrawDefaults({ fillType: 'predefined', patternName: 'ANSI31', patternScale: 1 });
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => result.current.onComboboxChange(ANGLE_KEY, '30'));
    act(() => result.current.onComboboxChange(SPACING_KEY, '100'));
    expect(getHatchDrawDefaults().patternAngle).toBe(30);
    expect(getHatchDrawDefaults().patternScale).toBeCloseTo(patternScaleForSpacingMm('ANSI31', 100), 6);
    expect((UpdateEntityCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

describe('useRibbonHatchBridge — gradient (ADR-507 Φ5 UI)', () => {
  it('drawing mode: gradient type/color/angle/single → draw-defaults', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => result.current.onComboboxChange(GRAD_TYPE_KEY, 'spherical'));
    act(() => result.current.onComboboxChange(GRAD_COLOR1_KEY, '#27ae60'));
    act(() => result.current.onComboboxChange(GRAD_COLOR2_KEY, '#c0392b'));
    act(() => result.current.onComboboxChange(GRAD_ANGLE_KEY, '45'));
    act(() => result.current.onToggle(GRAD_SINGLE_KEY, true));
    const d = getHatchDrawDefaults();
    expect(d.gradientType).toBe('spherical');
    expect(d.gradientColor1).toBe('#27ae60');
    expect(d.gradientColor2).toBe('#c0392b');
    expect(d.gradientAngle).toBe(45);
    expect(d.gradientSingleColor).toBe(true);
    expect((UpdateEntityCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('fillType=gradient drawing mode → draw-defaults fillType', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => result.current.onComboboxChange(FILLTYPE_KEY, 'gradient'));
    expect(getHatchDrawDefaults().fillType).toBe('gradient');
  });

  it('selected hatch: switch σε gradient χωρίς gradient data → patch δίνει default gradient object', () => {
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(solidHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    act(() => result.current.onComboboxChange(FILLTYPE_KEY, 'gradient'));
    const patch = (UpdateEntityCommand as jest.Mock).mock.calls[0]?.[1];
    expect(patch.fillType).toBe('gradient');
    expect(patch.patternType).toBe('gradient');
    expect(patch.gradient).toMatchObject({ type: 'linear', color1: expect.any(String) });
  });

  it('selected gradient hatch: αλλαγή color1 χτίζει ΟΛΟ το gradient (nested immutable merge)', () => {
    const gradHatch = {
      ...solidHatch, fillType: 'gradient' as const, patternType: 'gradient' as const,
      gradient: { type: 'linear' as const, color1: '#2980b9', color2: '#ffffff' },
    };
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(gradHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    act(() => result.current.onComboboxChange(GRAD_COLOR1_KEY, '#000000'));
    const patch = (UpdateEntityCommand as jest.Mock).mock.calls[0]?.[1];
    // ΟΛΟ το gradient ξαναχτίστηκε: νέο color1, διατήρηση color2/type.
    expect(patch.gradient).toMatchObject({ type: 'linear', color1: '#000000', color2: '#ffffff' });
  });

  it('getComboboxState διαβάζει τα gradient πεδία της οντότητας', () => {
    const gradHatch = {
      ...solidHatch, fillType: 'gradient' as const,
      gradient: { type: 'cylinder' as const, color1: '#2980b9', color2: '#c0392b', angleDeg: 30 },
    };
    const { result } = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(gradHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    expect(result.current.getComboboxState(GRAD_TYPE_KEY)?.value).toBe('cylinder');
    expect(result.current.getComboboxState(GRAD_COLOR1_KEY)?.value).toBe('#2980b9');
    expect(result.current.getComboboxState(GRAD_COLOR2_KEY)?.value).toBe('#c0392b');
    expect(result.current.getComboboxState(GRAD_ANGLE_KEY)?.value).toBe('30');
  });

  it('getPanelVisibility: gradient panel ορατό μόνο όταν fillType=gradient', () => {
    const gradHatch = { ...solidHatch, fillType: 'gradient' as const };
    const visible = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(gradHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    expect(visible.result.current.getPanelVisibility(GRAD_VIS_KEY)).toBe(true);

    const hidden = renderHook(() =>
      useRibbonHatchBridge({
        levelManager: makeLevelManager(solidHatch),
        universalSelection: makeSelection('hatch-1'),
      }),
    );
    expect(hidden.result.current.getPanelVisibility(GRAD_VIS_KEY)).toBe(false);
  });
});
