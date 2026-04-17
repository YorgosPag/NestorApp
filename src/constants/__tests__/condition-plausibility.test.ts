/**
 * Unit tests — condition-plausibility (ADR-287 Batch 24)
 */
import {
  assessConditionPlausibility,
  isActionableConditionVerdict,
} from '../condition-plausibility';

describe('assessConditionPlausibility', () => {
  it('returns insufficientData when condition is unknown', () => {
    const r = assessConditionPlausibility({
      condition: '',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'A',
    });
    expect(r.verdict).toBe('insufficientData');
  });

  it('returns ok for new + ready + central + A', () => {
    const r = assessConditionPlausibility({
      condition: 'new',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'A',
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns implausible needsRenovationButReady', () => {
    const r = assessConditionPlausibility({
      condition: 'needs-renovation',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'C',
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('needsRenovationButReady');
  });

  it('returns implausible newWithoutHeating', () => {
    const r = assessConditionPlausibility({
      condition: 'new',
      operationalStatus: 'under-construction',
      heatingType: 'none',
      energyClass: 'A',
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('newWithoutHeating');
  });

  it('returns unusual newButLowEnergy', () => {
    const r = assessConditionPlausibility({
      condition: 'new',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'F',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('newButLowEnergy');
  });

  it('returns unusual needsRenovationHighEnergy', () => {
    const r = assessConditionPlausibility({
      condition: 'needs-renovation',
      operationalStatus: 'under-construction',
      heatingType: 'autonomous',
      energyClass: 'A+',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('needsRenovationHighEnergy');
  });

  it('priority — needsRenovationButReady fires before energy check', () => {
    const r = assessConditionPlausibility({
      condition: 'needs-renovation',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'A',
    });
    expect(r.reason).toBe('needsRenovationButReady');
  });

  it('isActionableConditionVerdict narrows correctly', () => {
    expect(isActionableConditionVerdict('ok')).toBe(false);
    expect(isActionableConditionVerdict('insufficientData')).toBe(false);
    expect(isActionableConditionVerdict('unusual')).toBe(true);
    expect(isActionableConditionVerdict('implausible')).toBe(true);
  });
});
