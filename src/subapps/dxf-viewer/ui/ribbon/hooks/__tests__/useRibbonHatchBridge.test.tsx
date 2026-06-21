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
  resetHatchDrawDefaults,
} from '../../../../bim/hatch/hatch-draw-defaults-store';

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
const FILLTYPE_KEY = HATCH_RIBBON_KEYS.stringParams.fillType;

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
