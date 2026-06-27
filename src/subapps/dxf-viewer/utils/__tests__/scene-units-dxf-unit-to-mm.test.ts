/**
 * ADR-537 γ — dxfUnitToMm / dxfSceneUnitToMm: mm-per-DXF-unit factor used to align the
 * 3D raw-DXF grip / ghost / outline / pick path (mm-based `dxfPlanToWorld`) with the
 * unit-scaled wireframe (`DxfToThreeConverter`), so non-mm scenes (cm / m / in / ft) edit
 * correctly. By construction `dxfUnitToMm = sceneUnitsToMeters × 1000`.
 */

import { dxfUnitToMm, dxfSceneUnitToMm, sceneUnitsToMeters, type SceneUnits } from '../scene-units';

describe('dxfUnitToMm', () => {
  it('returns 1 for mm (identity — no-op on the existing mm path)', () => {
    expect(dxfUnitToMm('mm')).toBe(1);
  });

  it('maps each unit to its mm value', () => {
    expect(dxfUnitToMm('cm')).toBeCloseTo(10);
    expect(dxfUnitToMm('m')).toBeCloseTo(1000);
    expect(dxfUnitToMm('in')).toBeCloseTo(25.4);
    expect(dxfUnitToMm('ft')).toBeCloseTo(304.8);
  });

  it('equals sceneUnitsToMeters × 1000 for every unit (linked scales, never drift)', () => {
    (['mm', 'cm', 'm', 'in', 'ft'] as SceneUnits[]).forEach((u) => {
      expect(dxfUnitToMm(u)).toBeCloseTo(sceneUnitsToMeters(u) * 1000);
    });
  });

  it('round-trips an entity-unit value to mm and back', () => {
    const valueCm = 42;
    const mm = valueCm * dxfUnitToMm('cm');
    expect(mm).toBeCloseTo(420);
    expect(mm / dxfUnitToMm('cm')).toBeCloseTo(valueCm);
  });
});

describe('dxfSceneUnitToMm', () => {
  it('resolves the declared unit (mirrors the wireframe scale resolution)', () => {
    expect(dxfSceneUnitToMm({ units: 'cm' })).toBeCloseTo(10);
    expect(dxfSceneUnitToMm({ units: 'm' })).toBeCloseTo(1000);
  });

  it('defaults to mm (factor 1) for a null scene / missing unit', () => {
    expect(dxfSceneUnitToMm(null)).toBe(1);
    expect(dxfSceneUnitToMm(undefined)).toBe(1);
    expect(dxfSceneUnitToMm({ units: null })).toBe(1);
  });
});
