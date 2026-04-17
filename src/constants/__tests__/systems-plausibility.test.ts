/**
 * Unit tests — systems-plausibility (ADR-287 Batch 24)
 */
import {
  assessSystemsPlausibility,
  isActionableSystemsVerdict,
} from '../systems-plausibility';

describe('assessSystemsPlausibility', () => {
  it('returns insufficientData for unknown propertyType', () => {
    const r = assessSystemsPlausibility({
      propertyType: undefined,
      heatingType: 'central',
      coolingType: 'split-units',
      condition: 'new',
      areaGross: 80,
    });
    expect(r.verdict).toBe('insufficientData');
  });

  it('returns ok for residential with central + split + condition new', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: 'central',
      coolingType: 'split-units',
      condition: 'new',
      areaGross: 80,
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns implausible heatingNoneNewBuild', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: 'none',
      coolingType: 'split-units',
      condition: 'new',
      areaGross: 80,
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('heatingNoneNewBuild');
  });

  it('returns implausible heatingNoneResidential when condition not new', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: 'none',
      coolingType: 'split-units',
      condition: 'good',
      areaGross: 80,
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('heatingNoneResidential');
  });

  it('does not flag heating=none for storage/hall (auxiliary)', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'storage',
      heatingType: 'none',
      coolingType: 'none',
      condition: 'good',
      areaGross: 20,
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns unusual coolingOversizedTinyUnit', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'studio',
      heatingType: 'autonomous',
      coolingType: 'central-air',
      condition: 'good',
      areaGross: 25,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('coolingOversizedTinyUnit');
  });

  it('returns unusual coolingNoneLargeUnit', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'maisonette',
      heatingType: 'central',
      coolingType: 'none',
      condition: 'good',
      areaGross: 200,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('coolingNoneLargeUnit');
  });

  it('isActionableSystemsVerdict narrows correctly', () => {
    expect(isActionableSystemsVerdict('ok')).toBe(false);
    expect(isActionableSystemsVerdict('unusual')).toBe(true);
    expect(isActionableSystemsVerdict('implausible')).toBe(true);
  });
});
