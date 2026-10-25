import { validateMeasurementFamilyEvolution } from '../measurement-family-evolution';
import type { WorkspaceMeasurementFamilyDefinition } from '../../types/measurement-family';

const current: WorkspaceMeasurementFamilyDefinition = {
  code: 'luminous_efficacy',
  labels: { el: 'Φωτεινή απόδοση' },
  standardUnitCode: 'lm_W',
  singleUnit: false,
  units: [
    { code: 'lm_W', symbol: 'lm/W', factor: 1 },
    { code: 'klm_W', symbol: 'klm/W', factor: 1000 },
  ],
};
const codes = (next: WorkspaceMeasurementFamilyDefinition) =>
  validateMeasurementFamilyEvolution(current, next).map((issue) => issue.code);

describe('validateMeasurementFamilyEvolution — append-only while in use', () => {
  it('allows adding units and renaming symbols or labels', () => {
    const next = {
      ...current,
      labels: { el: 'Απόδοση', en: 'Efficacy' },
      units: [...current.units.map((unit) => ({ ...unit, symbol: `${unit.symbol} ` })), { code: 'mlm_W', symbol: 'mlm/W', factor: 0.001 }],
    };
    expect(codes(next)).toEqual([]);
  });

  it('locks the standard unit', () => {
    expect(codes({ ...current, standardUnitCode: 'klm_W' })).toContain('unitLockedInUse');
  });

  it('locks factors and offsets of existing units', () => {
    expect(codes({ ...current, units: [current.units[0], { ...current.units[1], factor: 999 }] })).toEqual(['unitLockedInUse']);
    expect(codes({ ...current, units: [current.units[0], { ...current.units[1], offset: 1 }] })).toEqual(['unitLockedInUse']);
  });

  it('forbids removing a unit', () => {
    expect(codes({ ...current, units: [current.units[0]] })).toEqual(['unitLockedInUse']);
  });
});
