/**
 * Unit tests — orientation-plausibility (ADR-287 Batch 24)
 */
import {
  assessOrientationPlausibility,
  isActionableOrientationVerdict,
} from '../orientation-plausibility';

describe('assessOrientationPlausibility', () => {
  it('returns insufficientData when propertyType is unknown', () => {
    const r = assessOrientationPlausibility({ propertyType: undefined, orientations: [] });
    expect(r.verdict).toBe('insufficientData');
  });

  it('returns ok for residential with 1-4 orientations', () => {
    const r = assessOrientationPlausibility({
      propertyType: 'apartment',
      orientations: ['north', 'east'],
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns unusual missingResidential for residential with 0 orientations', () => {
    const r = assessOrientationPlausibility({
      propertyType: 'apartment',
      orientations: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('missingResidential');
  });

  it('does not flag missing for studio (small unit, no expectation)', () => {
    const r = assessOrientationPlausibility({
      propertyType: 'studio',
      orientations: [],
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns unusual tooMany for apartment with 5 orientations', () => {
    const r = assessOrientationPlausibility({
      propertyType: 'apartment',
      orientations: ['north', 'east', 'south', 'west', 'northeast'],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('tooMany');
  });

  it('returns unusual allEightNonStandalone for non-villa with 8 orientations', () => {
    const r = assessOrientationPlausibility({
      propertyType: 'apartment',
      orientations: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('allEightNonStandalone');
  });

  it('allows all 8 orientations for villa (standalone)', () => {
    const r = assessOrientationPlausibility({
      propertyType: 'villa',
      orientations: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns unusual commercialAllDirections for shop with 3 orientations', () => {
    const r = assessOrientationPlausibility({
      propertyType: 'shop',
      orientations: ['north', 'east', 'south'],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('commercialAllDirections');
  });

  it('isActionableOrientationVerdict narrows correctly', () => {
    expect(isActionableOrientationVerdict('ok')).toBe(false);
    expect(isActionableOrientationVerdict('insufficientData')).toBe(false);
    expect(isActionableOrientationVerdict('unusual')).toBe(true);
    expect(isActionableOrientationVerdict('implausible')).toBe(true);
  });
});
