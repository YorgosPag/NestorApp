/**
 * Unit tests — systems-plausibility (ADR-287 Batch 25 + Batch 27)
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

  it('returns unusual heatingMissingResidential when heatingType empty on residential', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: '',
      coolingType: 'split-units',
      condition: 'good',
      areaGross: 80,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('heatingMissingResidential');
  });

  it('returns unusual coolingMissingResidential when coolingType empty on residential', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: 'central',
      coolingType: '',
      condition: 'good',
      areaGross: 80,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('coolingMissingResidential');
  });

  it('does not flag missing heating/cooling for commercial (shop)', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'shop',
      heatingType: '',
      coolingType: '',
      condition: 'good',
      areaGross: 50,
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

  it('prefers heatingNoneResidential (implausible) over heatingMissingResidential (unusual)', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: 'none',
      coolingType: '',
      condition: 'good',
      areaGross: 80,
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('heatingNoneResidential');
  });

  it('isActionableSystemsVerdict narrows correctly', () => {
    expect(isActionableSystemsVerdict('ok')).toBe(false);
    expect(isActionableSystemsVerdict('unusual')).toBe(true);
    expect(isActionableSystemsVerdict('implausible')).toBe(true);
  });

  // ===========================================================================
  // Batch 27 — Pre-completion gating (draft + under-construction)
  // ===========================================================================

  it('suppresses heatingMissingResidential when under-construction', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: '',
      coolingType: 'split-units',
      condition: 'good',
      areaGross: 80,
      operationalStatus: 'under-construction',
    });
    expect(r.verdict).toBe('ok');
    expect(r.reason).toBeNull();
  });

  it('suppresses coolingMissingResidential when draft', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: 'central',
      coolingType: '',
      condition: 'good',
      areaGross: 80,
      operationalStatus: 'draft',
    });
    expect(r.verdict).toBe('ok');
  });

  it('suppresses both missing warnings when under-construction all-empty', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: '',
      coolingType: '',
      condition: '',
      areaGross: 80,
      operationalStatus: 'under-construction',
    });
    expect(r.verdict).toBe('ok');
  });

  it('keeps heatingNoneResidential active under-construction (declarative)', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: 'none',
      coolingType: 'split-units',
      condition: 'good',
      areaGross: 80,
      operationalStatus: 'under-construction',
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('heatingNoneResidential');
  });

  it('keeps coolingOversizedTinyUnit active under-construction (declarative)', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'studio',
      heatingType: 'autonomous',
      coolingType: 'central-air',
      condition: 'good',
      areaGross: 25,
      operationalStatus: 'under-construction',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('coolingOversizedTinyUnit');
  });

  it('still fires heatingMissingResidential when inspection (not pre-completion)', () => {
    const r = assessSystemsPlausibility({
      propertyType: 'apartment',
      heatingType: '',
      coolingType: 'split-units',
      condition: 'good',
      areaGross: 80,
      operationalStatus: 'inspection',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('heatingMissingResidential');
  });
});
