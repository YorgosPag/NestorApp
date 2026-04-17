/**
 * Unit tests — finishes-plausibility (ADR-287 Batch 25)
 */
import {
  assessFinishesPlausibility,
  isActionableFinishesVerdict,
} from '../finishes-plausibility';

describe('assessFinishesPlausibility', () => {
  it('returns insufficientData when all fields empty', () => {
    const r = assessFinishesPlausibility({
      propertyType: undefined,
      flooring: [],
      windowFrames: '',
      glazing: '',
      energyClass: '',
      condition: '',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('insufficientData');
  });

  it('returns ok for double glazing + class A on residential', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'apartment',
      flooring: ['tiles'],
      windowFrames: 'aluminum',
      glazing: 'double',
      energyClass: 'A',
      condition: 'new',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns implausible glazingSingleHighEnergy (single + A)', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'apartment',
      flooring: ['tiles'],
      windowFrames: 'aluminum',
      glazing: 'single',
      energyClass: 'A',
      condition: 'new',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('glazingSingleHighEnergy');
  });

  it('returns unusual carpetWithUnderfloor', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'apartment',
      flooring: ['carpet'],
      windowFrames: 'aluminum',
      glazing: 'double',
      energyClass: 'B',
      condition: 'good',
      interiorFeatures: ['underfloor-heating'],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('carpetWithUnderfloor');
  });

  it('returns unusual glazingTripleLowEnergy (triple + F)', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'apartment',
      flooring: ['tiles'],
      windowFrames: 'aluminum',
      glazing: 'triple',
      energyClass: 'F',
      condition: 'good',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('glazingTripleLowEnergy');
  });

  it('returns unusual glazingMissingResidential when glazing empty on residential', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'apartment',
      flooring: ['tiles'],
      windowFrames: 'aluminum',
      glazing: '',
      energyClass: 'B',
      condition: 'good',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('glazingMissingResidential');
  });

  it('returns unusual flooringMissingResidential when flooring empty on residential', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'maisonette',
      flooring: [],
      windowFrames: 'aluminum',
      glazing: 'double',
      energyClass: 'B',
      condition: 'excellent',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('flooringMissingResidential');
  });

  it('returns unusual framesMissingResidential when frames empty on residential', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'villa',
      flooring: ['marble'],
      windowFrames: '',
      glazing: 'double',
      energyClass: 'A',
      condition: 'new',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('framesMissingResidential');
  });

  it('flags missing finishes on residential regardless of condition (needs-renovation)', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'apartment',
      flooring: [],
      windowFrames: 'aluminum',
      glazing: 'double',
      energyClass: 'D',
      condition: 'needs-renovation',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('flooringMissingResidential');
  });

  it('does not flag missing finishes on commercial (shop)', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'shop',
      flooring: [],
      windowFrames: '',
      glazing: '',
      energyClass: 'C',
      condition: 'good',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('ok');
  });

  it('does not flag missing finishes on storage (auxiliary)', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'storage',
      flooring: [],
      windowFrames: '',
      glazing: '',
      energyClass: '',
      condition: 'good',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('ok');
  });

  it('prefers glazingSingleHighEnergy (implausible) over flooringMissingResidential (unusual)', () => {
    const r = assessFinishesPlausibility({
      propertyType: 'apartment',
      flooring: [],
      windowFrames: 'aluminum',
      glazing: 'single',
      energyClass: 'A',
      condition: 'new',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('glazingSingleHighEnergy');
  });

  it('isActionableFinishesVerdict narrows correctly', () => {
    expect(isActionableFinishesVerdict('ok')).toBe(false);
    expect(isActionableFinishesVerdict('unusual')).toBe(true);
    expect(isActionableFinishesVerdict('implausible')).toBe(true);
  });
});
