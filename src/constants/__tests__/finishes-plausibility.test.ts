/**
 * Unit tests — finishes-plausibility (ADR-287 Batch 24)
 */
import {
  assessFinishesPlausibility,
  isActionableFinishesVerdict,
} from '../finishes-plausibility';

describe('assessFinishesPlausibility', () => {
  it('returns insufficientData when all fields empty', () => {
    const r = assessFinishesPlausibility({
      flooring: [],
      windowFrames: '',
      glazing: '',
      energyClass: '',
      condition: '',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('insufficientData');
  });

  it('returns ok for double glazing + class A', () => {
    const r = assessFinishesPlausibility({
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

  it('returns unusual glazingMissingFinished', () => {
    const r = assessFinishesPlausibility({
      flooring: ['tiles'],
      windowFrames: 'aluminum',
      glazing: '',
      energyClass: 'B',
      condition: 'new',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('glazingMissingFinished');
  });

  it('returns unusual flooringEmptyFinished', () => {
    const r = assessFinishesPlausibility({
      flooring: [],
      windowFrames: 'aluminum',
      glazing: 'double',
      energyClass: 'B',
      condition: 'excellent',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('flooringEmptyFinished');
  });

  it('does not flag missing finishes when condition=needs-renovation', () => {
    const r = assessFinishesPlausibility({
      flooring: [],
      windowFrames: 'aluminum',
      glazing: 'double',
      energyClass: 'D',
      condition: 'needs-renovation',
      interiorFeatures: [],
    });
    expect(r.verdict).toBe('ok');
  });

  it('isActionableFinishesVerdict narrows correctly', () => {
    expect(isActionableFinishesVerdict('ok')).toBe(false);
    expect(isActionableFinishesVerdict('unusual')).toBe(true);
    expect(isActionableFinishesVerdict('implausible')).toBe(true);
  });
});
