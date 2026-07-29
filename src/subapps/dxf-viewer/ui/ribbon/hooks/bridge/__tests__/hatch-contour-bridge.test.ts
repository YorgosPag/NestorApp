/**
 * ADR-507 — tests για το hatch contour-pen bridge slice (read/toggle/write dispatch).
 * Pure module (μηδέν React) — δοκιμάζεται απευθείας με πλαστά hatch/defaults/callbacks.
 */

import {
  readHatchContourComboboxState,
  getHatchContourToggleState,
  applyHatchContourStringChange,
  applyHatchContourToggleChange,
} from '../hatch-contour-bridge';
import { HATCH_RIBBON_KEYS } from '../hatch-command-keys';
import { getHatchDrawDefaults, resetHatchDrawDefaults, type HatchDrawDefaults } from '../../../../../bim/hatch/hatch-draw-defaults-store';
import { LINEWEIGHT_SPECIAL } from '../../../../../config/lineweight-iso-catalog';
import type { HatchEntity } from '../../../../../types/entities';

const OTHER_KEY = 'hatch.params.fillColor';

function makeHatch(overrides: Partial<HatchEntity> = {}): HatchEntity {
  return {
    id: 'h1',
    type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
    fillType: 'solid',
    patternType: 'solid',
    fillColor: '#808080',
    visible: true,
    drawOrder: 4,
    ...overrides,
  } as HatchEntity;
}

describe('readHatchContourComboboxState', () => {
  const defaults: HatchDrawDefaults = getHatchDrawDefaults();
  const linetypeOptions = [{ value: 'ByLayer', labelKey: 'ByLayer', isLiteralLabel: true as const }];

  it('returns null for a non-contour key', () => {
    expect(readHatchContourComboboxState(OTHER_KEY, null, defaults, linetypeOptions)).toBeNull();
  });

  it('contour color: no selection, no override → falls back to the draft fillColor', () => {
    const state = readHatchContourComboboxState(
      HATCH_RIBBON_KEYS.stringParams.contourColor, null, defaults, linetypeOptions,
    );
    expect(state?.value).toBe(defaults.fillColor);
  });

  it('contour color: selected hatch with no pen override → inherits the hatch fillColor', () => {
    const hatch = makeHatch({ fillColor: '#123456' });
    const state = readHatchContourComboboxState(
      HATCH_RIBBON_KEYS.stringParams.contourColor, hatch, defaults, linetypeOptions,
    );
    expect(state?.value).toBe('#123456');
  });

  it('contour color: selected hatch WITH a pen color override → returns the override', () => {
    const hatch = makeHatch({ fillColor: '#123456', contourPen: { visible: true, color: '#abcdef' } });
    const state = readHatchContourComboboxState(
      HATCH_RIBBON_KEYS.stringParams.contourColor, hatch, defaults, linetypeOptions,
    );
    expect(state?.value).toBe('#abcdef');
  });

  it('contour lineweight: absent → ByLayer sentinel', () => {
    const hatch = makeHatch();
    const state = readHatchContourComboboxState(
      HATCH_RIBBON_KEYS.stringParams.contourLineweight, hatch, defaults, linetypeOptions,
    );
    expect(state?.value).toBe('ByLayer');
  });

  it('contour lineweight: concrete override → formatted mm value', () => {
    const hatch = makeHatch({ contourPen: { visible: true, lineweightMm: 0.5 } });
    const state = readHatchContourComboboxState(
      HATCH_RIBBON_KEYS.stringParams.contourLineweight, hatch, defaults, linetypeOptions,
    );
    expect(state?.value).toBe('0.50');
  });

  it('contour linetype: absent → Continuous, carries the live registry options', () => {
    const hatch = makeHatch();
    const state = readHatchContourComboboxState(
      HATCH_RIBBON_KEYS.stringParams.contourLinetype, hatch, defaults, linetypeOptions,
    );
    expect(state?.value).toBe('Continuous');
    expect(state?.options).toBe(linetypeOptions);
  });

  it('contour linetype: override → returns the stored name', () => {
    const hatch = makeHatch({ contourPen: { visible: true, linetypeName: 'DASHED' } });
    const state = readHatchContourComboboxState(
      HATCH_RIBBON_KEYS.stringParams.contourLinetype, hatch, defaults, linetypeOptions,
    );
    expect(state?.value).toBe('DASHED');
  });
});

describe('getHatchContourToggleState', () => {
  const defaults: HatchDrawDefaults = getHatchDrawDefaults();

  it('returns null for a non-contour toggle key', () => {
    expect(getHatchContourToggleState(HATCH_RIBBON_KEYS.toggles.sendToBack, null, defaults)).toBeNull();
  });

  it('no selection → the draft default (visible)', () => {
    expect(getHatchContourToggleState(HATCH_RIBBON_KEYS.toggles.contourVisible, null, defaults)).toBe(true);
  });

  it('selected hatch, absent contourPen → visible (SSoT default)', () => {
    const hatch = makeHatch();
    expect(getHatchContourToggleState(HATCH_RIBBON_KEYS.toggles.contourVisible, hatch, defaults)).toBe(true);
  });

  it('selected hatch, contourPen.visible=false → hidden', () => {
    const hatch = makeHatch({ contourPen: { visible: false } });
    expect(getHatchContourToggleState(HATCH_RIBBON_KEYS.toggles.contourVisible, hatch, defaults)).toBe(false);
  });
});

describe('applyHatchContourStringChange (dual-mode write)', () => {
  beforeEach(() => resetHatchDrawDefaults());

  it('returns false and calls nothing for a non-contour key', () => {
    const patchHatch = jest.fn();
    const setDrawDefaults = jest.fn();
    const handled = applyHatchContourStringChange(
      OTHER_KEY, '#000000', null, getHatchDrawDefaults(), patchHatch, setDrawDefaults,
    );
    expect(handled).toBe(false);
    expect(patchHatch).not.toHaveBeenCalled();
    expect(setDrawDefaults).not.toHaveBeenCalled();
  });

  it('no selection: contour color change patches the flat draw-default', () => {
    const patchHatch = jest.fn();
    const setDrawDefaults = jest.fn();
    const handled = applyHatchContourStringChange(
      HATCH_RIBBON_KEYS.stringParams.contourColor, '#ff0000', null, getHatchDrawDefaults(), patchHatch, setDrawDefaults,
    );
    expect(handled).toBe(true);
    expect(patchHatch).not.toHaveBeenCalled();
    expect(setDrawDefaults).toHaveBeenCalledWith({ contourColor: '#ff0000' });
  });

  it('selected hatch: contour color change patches a rebuilt nested contourPen', () => {
    const hatch = makeHatch({ contourPen: { visible: true, linetypeName: 'DASHED' } });
    const patchHatch = jest.fn();
    const setDrawDefaults = jest.fn();
    const handled = applyHatchContourStringChange(
      HATCH_RIBBON_KEYS.stringParams.contourColor, '#ff0000', hatch, getHatchDrawDefaults(), patchHatch, setDrawDefaults,
    );
    expect(handled).toBe(true);
    expect(setDrawDefaults).not.toHaveBeenCalled();
    expect(patchHatch).toHaveBeenCalledTimes(1);
    const [entity, patch] = patchHatch.mock.calls[0];
    expect(entity).toBe(hatch);
    expect(patch).toEqual({ contourPen: { visible: true, color: '#ff0000', linetypeName: 'DASHED' } });
  });

  it('selected hatch: ByLayer contour lineweight write trims to undefined (hairline)', () => {
    const hatch = makeHatch({ contourPen: { visible: true, lineweightMm: 0.5 } });
    const patchHatch = jest.fn();
    const setDrawDefaults = jest.fn();
    applyHatchContourStringChange(
      HATCH_RIBBON_KEYS.stringParams.contourLineweight, 'ByLayer', hatch, getHatchDrawDefaults(), patchHatch, setDrawDefaults,
    );
    const [, patch] = patchHatch.mock.calls[0];
    expect((patch as { contourPen: { lineweightMm?: number } }).contourPen.lineweightMm).toBeUndefined();
  });

  it('selected hatch: concrete contour lineweight write parses the mm string', () => {
    const hatch = makeHatch();
    const patchHatch = jest.fn();
    const setDrawDefaults = jest.fn();
    applyHatchContourStringChange(
      HATCH_RIBBON_KEYS.stringParams.contourLineweight, '0.50', hatch, getHatchDrawDefaults(), patchHatch, setDrawDefaults,
    );
    const [, patch] = patchHatch.mock.calls[0];
    expect((patch as { contourPen: { lineweightMm?: number } }).contourPen.lineweightMm).toBe(0.5);
  });

  it('no selection: contour lineweight change patches the flat LineweightMm draw-default', () => {
    const setDrawDefaults = jest.fn();
    applyHatchContourStringChange(
      HATCH_RIBBON_KEYS.stringParams.contourLineweight, '0.50', null, getHatchDrawDefaults(), jest.fn(), setDrawDefaults,
    );
    expect(setDrawDefaults).toHaveBeenCalledWith({ contourLineweightMm: 0.5 });
  });

  it('no selection: contour linetype change patches the flat draw-default', () => {
    const setDrawDefaults = jest.fn();
    applyHatchContourStringChange(
      HATCH_RIBBON_KEYS.stringParams.contourLinetype, 'DASHED', null, getHatchDrawDefaults(), jest.fn(), setDrawDefaults,
    );
    expect(setDrawDefaults).toHaveBeenCalledWith({ contourLinetypeName: 'DASHED' });
  });
});

describe('applyHatchContourToggleChange (dual-mode write)', () => {
  beforeEach(() => resetHatchDrawDefaults());

  it('returns false and calls nothing for a non-contour toggle key', () => {
    const patchHatch = jest.fn();
    const setDrawDefaults = jest.fn();
    const handled = applyHatchContourToggleChange(
      HATCH_RIBBON_KEYS.toggles.sendToBack, true, null, getHatchDrawDefaults(), patchHatch, setDrawDefaults,
    );
    expect(handled).toBe(false);
    expect(patchHatch).not.toHaveBeenCalled();
    expect(setDrawDefaults).not.toHaveBeenCalled();
  });

  it('no selection: toggling OFF patches the flat draw-default', () => {
    const setDrawDefaults = jest.fn();
    const handled = applyHatchContourToggleChange(
      HATCH_RIBBON_KEYS.toggles.contourVisible, false, null, getHatchDrawDefaults(), jest.fn(), setDrawDefaults,
    );
    expect(handled).toBe(true);
    expect(setDrawDefaults).toHaveBeenCalledWith({ contourVisible: false });
  });

  it('selected hatch: toggling OFF patches a rebuilt nested contourPen, keeping overrides', () => {
    const hatch = makeHatch({ contourPen: { visible: true, color: '#abcdef' } });
    const patchHatch = jest.fn();
    applyHatchContourToggleChange(
      HATCH_RIBBON_KEYS.toggles.contourVisible, false, hatch, getHatchDrawDefaults(), patchHatch, jest.fn(),
    );
    const [entity, patch] = patchHatch.mock.calls[0];
    expect(entity).toBe(hatch);
    expect(patch).toEqual({ contourPen: { visible: false, color: '#abcdef' } });
  });

  it('selected hatch with NO contourPen: toggling OFF defaults visible=true baseline then overrides to false', () => {
    const hatch = makeHatch();
    const patchHatch = jest.fn();
    applyHatchContourToggleChange(
      HATCH_RIBBON_KEYS.toggles.contourVisible, false, hatch, getHatchDrawDefaults(), patchHatch, jest.fn(),
    );
    const [, patch] = patchHatch.mock.calls[0];
    expect((patch as { contourPen: { visible: boolean } }).contourPen.visible).toBe(false);
  });
});

// Sanity: the ByLayer sentinel used across these tests really is the registry's constant.
describe('sentinel sanity', () => {
  it('LINEWEIGHT_SPECIAL.BYLAYER is a non-concrete lineweight', () => {
    expect(LINEWEIGHT_SPECIAL.BYLAYER).toBeLessThan(0);
  });
});
