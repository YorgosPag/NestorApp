/**
 * Unit tests — condition-plausibility (ADR-287 Batch 25 + Batch 27)
 */
import {
  assessConditionPlausibility,
  isActionableConditionVerdict,
} from '../condition-plausibility';

describe('assessConditionPlausibility', () => {
  it('returns insufficientData when condition is unknown on non-residential', () => {
    const r = assessConditionPlausibility({
      propertyType: 'shop',
      condition: '',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'A',
    });
    expect(r.verdict).toBe('insufficientData');
  });

  it('returns ok for new + ready + central + A on residential', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'new',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'A',
    });
    expect(r.verdict).toBe('ok');
  });

  it('returns implausible needsRenovationButReady', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
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
      propertyType: 'apartment',
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
      propertyType: 'apartment',
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
      propertyType: 'apartment',
      condition: 'needs-renovation',
      operationalStatus: 'under-construction',
      heatingType: 'autonomous',
      energyClass: 'A+',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('needsRenovationHighEnergy');
  });

  it('returns unusual conditionMissingResidential when condition empty on residential', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: '',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'B',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('conditionMissingResidential');
  });

  it('returns unusual energyClassMissingResidential when energyClass empty on residential', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'good',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: '',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('energyClassMissingResidential');
  });

  it('creation scenario — fires conditionMissingResidential on fresh residential', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: '',
      operationalStatus: '',
      heatingType: '',
      energyClass: '',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('conditionMissingResidential');
  });

  it('does not flag missing condition/energy on commercial (shop)', () => {
    const r = assessConditionPlausibility({
      propertyType: 'shop',
      condition: '',
      operationalStatus: '',
      heatingType: '',
      energyClass: '',
    });
    expect(r.verdict).toBe('insufficientData');
  });

  it('priority — needsRenovationButReady fires before energy check', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'needs-renovation',
      operationalStatus: 'ready',
      heatingType: 'central',
      energyClass: 'A',
    });
    expect(r.reason).toBe('needsRenovationButReady');
  });

  it('priority — needsRenovationHighEnergy fires before energyClassMissing (energyClass set)', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'needs-renovation',
      operationalStatus: 'under-construction',
      heatingType: 'central',
      energyClass: 'A',
    });
    expect(r.reason).toBe('needsRenovationHighEnergy');
  });

  it('isActionableConditionVerdict narrows correctly', () => {
    expect(isActionableConditionVerdict('ok')).toBe(false);
    expect(isActionableConditionVerdict('insufficientData')).toBe(false);
    expect(isActionableConditionVerdict('unusual')).toBe(true);
    expect(isActionableConditionVerdict('implausible')).toBe(true);
  });

  // ===========================================================================
  // Batch 27 — Pre-completion gating (draft + under-construction)
  // ===========================================================================

  it('suppresses conditionMissingResidential when under-construction', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: '',
      operationalStatus: 'under-construction',
      heatingType: '',
      energyClass: '',
    });
    expect(r.verdict).toBe('insufficientData');
    expect(r.reason).toBeNull();
  });

  it('suppresses conditionMissingResidential when draft', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: '',
      operationalStatus: 'draft',
      heatingType: '',
      energyClass: '',
    });
    expect(r.verdict).toBe('insufficientData');
    expect(r.reason).toBeNull();
  });

  it('suppresses energyClassMissingResidential when under-construction', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'good',
      operationalStatus: 'under-construction',
      heatingType: 'central',
      energyClass: '',
    });
    expect(r.verdict).toBe('ok');
    expect(r.reason).toBeNull();
  });

  it('suppresses energyClassMissingResidential when draft', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'good',
      operationalStatus: 'draft',
      heatingType: 'central',
      energyClass: '',
    });
    expect(r.verdict).toBe('ok');
  });

  it('keeps newWithoutHeating active under-construction (declarative)', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'new',
      operationalStatus: 'under-construction',
      heatingType: 'none',
      energyClass: 'A',
    });
    expect(r.verdict).toBe('implausible');
    expect(r.reason).toBe('newWithoutHeating');
  });

  it('keeps newButLowEnergy active under-construction (declarative)', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: 'new',
      operationalStatus: 'under-construction',
      heatingType: 'central',
      energyClass: 'F',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('newButLowEnergy');
  });

  it('still fires conditionMissingResidential when maintenance (not pre-completion)', () => {
    const r = assessConditionPlausibility({
      propertyType: 'apartment',
      condition: '',
      operationalStatus: 'maintenance',
      heatingType: 'central',
      energyClass: 'B',
    });
    expect(r.verdict).toBe('unusual');
    expect(r.reason).toBe('conditionMissingResidential');
  });
});
