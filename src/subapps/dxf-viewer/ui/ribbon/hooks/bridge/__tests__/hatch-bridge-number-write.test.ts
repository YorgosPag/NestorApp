/**
 * ADR-507/643/653 — tests για τον hatch numeric-field write dispatcher (εξήχθη από
 * το `useRibbonHatchBridge`, N.7.1 όριο 500 γρ.). Pure module — δοκιμάζεται με
 * πλαστά hatch/defaults/callback spies, μηδέν React.
 */

import { applyHatchNumberChange } from '../hatch-bridge-number-write';
import { HATCH_RIBBON_KEYS } from '../hatch-command-keys';
import { getHatchDrawDefaults, resetHatchDrawDefaults } from '../../../../../bim/hatch/hatch-draw-defaults-store';
import type { HatchEntity } from '../../../../../types/entities';

function makeHatch(overrides: Partial<HatchEntity> = {}): HatchEntity {
  return {
    id: 'h1',
    type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
    fillType: 'user-defined',
    patternType: 'pattern',
    fillColor: '#808080',
    visible: true,
    drawOrder: 4,
    ...overrides,
  } as HatchEntity;
}

function run(
  commandKey: string,
  value: string,
  hatch: HatchEntity | null,
  applyGradientChange = jest.fn(),
  applyImageChange = jest.fn(),
) {
  const patchHatch = jest.fn();
  const setDrawDefaults = jest.fn();
  const handled = applyHatchNumberChange(
    commandKey, value, hatch, getHatchDrawDefaults(), patchHatch, setDrawDefaults,
    applyGradientChange, applyImageChange,
  );
  return { handled, patchHatch, setDrawDefaults, applyGradientChange, applyImageChange };
}

describe('applyHatchNumberChange', () => {
  beforeEach(() => resetHatchDrawDefaults());

  it('returns false for a non-numeric hatch key', () => {
    const { handled, patchHatch, setDrawDefaults } = run(HATCH_RIBBON_KEYS.stringParams.fillColor, '5', null);
    expect(handled).toBe(false);
    expect(patchHatch).not.toHaveBeenCalled();
    expect(setDrawDefaults).not.toHaveBeenCalled();
  });

  it('returns true (handled, no-op) for a non-numeric value', () => {
    const { handled, patchHatch, setDrawDefaults } = run(HATCH_RIBBON_KEYS.params.lineAngle, 'not-a-number', null);
    expect(handled).toBe(true);
    expect(patchHatch).not.toHaveBeenCalled();
    expect(setDrawDefaults).not.toHaveBeenCalled();
  });

  it('transparency: selection-only — no-ops with no hatch selected', () => {
    const { patchHatch } = run(HATCH_RIBBON_KEYS.params.transparency, '50', null);
    expect(patchHatch).not.toHaveBeenCalled();
  });

  it('transparency: clamps + patches the selected hatch', () => {
    const hatch = makeHatch();
    const { patchHatch } = run(HATCH_RIBBON_KEYS.params.transparency, '150', hatch);
    expect(patchHatch).toHaveBeenCalledWith(hatch, { transparency: 90 });
  });

  it('gap tolerance: 0 is valid (disables) and writes to draw-defaults with no selection', () => {
    const { setDrawDefaults } = run(HATCH_RIBBON_KEYS.params.gapTolerance, '0', null);
    expect(setDrawDefaults).toHaveBeenCalledWith({ gapTolerance: 0 });
  });

  it('gap tolerance: >0 on a selected hatch patches the entity', () => {
    const hatch = makeHatch();
    const { patchHatch } = run(HATCH_RIBBON_KEYS.params.gapTolerance, '5', hatch);
    expect(patchHatch).toHaveBeenCalledWith(hatch, { gapTolerance: 5 });
  });

  it('gradientAngle delegates to applyGradientChange', () => {
    const applyGradientChange = jest.fn();
    run(HATCH_RIBBON_KEYS.params.gradientAngle, '45', null, applyGradientChange);
    expect(applyGradientChange).toHaveBeenCalledWith(null, { field: 'angleDeg', value: 45 });
  });

  it('imageTileWidth delegates to applyImageChange (rejects <= 0)', () => {
    const applyImageChange = jest.fn();
    run(HATCH_RIBBON_KEYS.params.imageTileWidth, '0', null, jest.fn(), applyImageChange);
    expect(applyImageChange).not.toHaveBeenCalled();
    run(HATCH_RIBBON_KEYS.params.imageTileWidth, '250', null, jest.fn(), applyImageChange);
    expect(applyImageChange).toHaveBeenCalledWith(null, { field: 'tileWidth', value: 250 });
  });

  it('tintStrength converts the 0..100 UI percent to a 0..1 domain value', () => {
    const applyImageChange = jest.fn();
    run(HATCH_RIBBON_KEYS.params.tintStrength, '40', null, jest.fn(), applyImageChange);
    expect(applyImageChange).toHaveBeenCalledWith(null, { field: 'tintStrength', value: 0.4 });
  });

  it('lineAngle: user-defined fillType writes lineAngle', () => {
    const hatch = makeHatch({ fillType: 'user-defined' });
    const { patchHatch } = run(HATCH_RIBBON_KEYS.params.lineAngle, '30', hatch);
    expect(patchHatch).toHaveBeenCalledWith(hatch, { lineAngle: 30 });
  });

  it('lineAngle: predefined fillType writes patternAngle instead', () => {
    const hatch = makeHatch({ fillType: 'predefined', patternName: 'ANSI31' });
    const { patchHatch } = run(HATCH_RIBBON_KEYS.params.lineAngle, '30', hatch);
    expect(patchHatch).toHaveBeenCalledWith(hatch, { patternAngle: 30 });
  });

  it('patternScale: rejects <= 0, writes draw-default with no selection', () => {
    const { setDrawDefaults } = run(HATCH_RIBBON_KEYS.params.patternScale, '0', null);
    expect(setDrawDefaults).not.toHaveBeenCalled();
    const { setDrawDefaults: sd2 } = run(HATCH_RIBBON_KEYS.params.patternScale, '2', null);
    expect(sd2).toHaveBeenCalledWith({ patternScale: 2 });
  });

  it('«Απόσταση» (lineSpacing key itself): user-defined writes lineSpacing directly', () => {
    const hatch = makeHatch({ fillType: 'user-defined' });
    const { patchHatch } = run(HATCH_RIBBON_KEYS.params.lineSpacing, '75', hatch);
    expect(patchHatch).toHaveBeenCalledWith(hatch, { lineSpacing: 75 });
  });

  it('«Απόσταση»: predefined fillType translates mm spacing into patternScale', () => {
    const hatch = makeHatch({ fillType: 'predefined', patternName: 'ANSI31' });
    const { patchHatch } = run(HATCH_RIBBON_KEYS.params.lineSpacing, '50', hatch);
    expect(patchHatch).toHaveBeenCalledTimes(1);
    const [, patch] = patchHatch.mock.calls[0];
    expect(patch).toHaveProperty('patternScale');
    expect(typeof (patch as { patternScale: number }).patternScale).toBe('number');
  });
});
