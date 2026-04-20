/**
 * Unit tests — interior-features-plausibility (ADR-287 Batch 24)
 */
import {
  assessInteriorFeaturesPlausibility,
  isActionableInteriorFeaturesVerdict,
} from '../interior-features-plausibility';

describe('assessInteriorFeaturesPlausibility', () => {
  it('returns insufficientData when interiorFeatures is empty', () => {
    const r = assessInteriorFeaturesPlausibility({
      propertyType: 'apartment',
      interiorFeatures: [],
      securityFeatures: [],
      energyClass: 'A',
      heatingType: 'central',
      coolingType: 'split-units',
      areaGross: 80,
    });
    expect(r.verdict).toBe('insufficientData');
  });

  it('returns ok for plausible combination', () => {
    const r = assessInteriorFeaturesPlausibility({
      propertyType: 'apartment',
      interiorFeatures: ['fireplace'],
      securityFeatures: ['security-door'],
      energyClass: 'B',
      heatingType: 'central',
      coolingType: 'split-units',
      areaGross: 100,
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns unusual airConditioningRedundant', () => {
    const r = assessInteriorFeaturesPlausibility({
      propertyType: 'apartment',
      interiorFeatures: ['air-conditioning'],
      securityFeatures: [],
      energyClass: 'B',
      heatingType: 'central',
      coolingType: 'split-units',
      areaGross: 80,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('airConditioningRedundant');
  });

  it('returns unusual underfloorHeatingNoCentral (heating=none)', () => {
    const r = assessInteriorFeaturesPlausibility({
      propertyType: 'villa',
      interiorFeatures: ['underfloor-heating'],
      securityFeatures: [],
      energyClass: 'A',
      heatingType: 'none',
      coolingType: 'central-air',
      areaGross: 250,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('underfloorHeatingNoCentral');
  });

  it('returns unusual solarPanelsLowEnergy', () => {
    const r = assessInteriorFeaturesPlausibility({
      propertyType: 'apartment',
      interiorFeatures: ['solar-panels'],
      securityFeatures: [],
      energyClass: 'F',
      heatingType: 'central',
      coolingType: 'split-units',
      areaGross: 80,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('solarPanelsLowEnergy');
  });

  it('returns unusual fireplaceTinyStudio', () => {
    const r = assessInteriorFeaturesPlausibility({
      propertyType: 'studio',
      interiorFeatures: ['fireplace'],
      securityFeatures: [],
      energyClass: 'C',
      heatingType: 'autonomous',
      coolingType: 'split-units',
      areaGross: 25,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('fireplaceTinyStudio');
  });

  it('returns unusual luxuryFeaturesStudio (jacuzzi in studio)', () => {
    const r = assessInteriorFeaturesPlausibility({
      propertyType: 'studio',
      interiorFeatures: ['jacuzzi'],
      securityFeatures: [],
      energyClass: 'A',
      heatingType: 'central',
      coolingType: 'split-units',
      areaGross: 30,
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('luxuryFeaturesStudio');
  });

  it('isActionableInteriorFeaturesVerdict narrows correctly', () => {
    expect(isActionableInteriorFeaturesVerdict('ok')).toBe(false);
    expect(isActionableInteriorFeaturesVerdict('unusual')).toBe(true);
    expect(isActionableInteriorFeaturesVerdict('implausible')).toBe(true);
  });
});
