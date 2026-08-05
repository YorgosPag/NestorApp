/**
 * ADR-759 §4.1 + Q5 — anchors for the survey ↔ Building Terms comparison.
 *
 * The cases below are chosen so that each one dies if a specific piece of the design
 * is removed. In particular `reopened` and `not-comparable` are the two states that a
 * naive implementation silently collapses into something else — and both collapses
 * are invisible from the outside: the card still renders, still looks resolved, and
 * is wrong.
 */
import {
  compareField,
  compareSurveyToBuildingCode,
  countActionable,
  isActionable,
  recordDecision,
  RECONCILABLE_FIELDS,
} from '../survey-reconciliation';
import { createEmptySurveyRecord } from '../survey-record-factory';
import { userSourced, type FieldReconciliation, type SurveyRecord } from '@/types/project-survey-record';
import type { ProjectBuildingCodePhase2 } from '@/types/project-building-code';

jest.mock('@/services/enterprise-id.service', () => ({
  generateSurveyRecordId: () => 'srv_test_fixed',
}));

const NOW = '2026-08-05T10:00:00.000Z';

function baseRecord(): SurveyRecord {
  return createEmptySurveyRecord({
    companyId: 'company-a',
    projectId: 'proj_1',
    createdBy: 'usr_1',
    now: NOW,
  });
}

/**
 * The G753 numbers, as measured (ADR-759 §2β.2): ΣΔ 0,8 base + 0,5 social = 1,3
 * total; coverage 50% normal / 60% maximum; height stated as text.
 */
function g753Record(overrides: Partial<SurveyRecord> = {}): SurveyRecord {
  const record = baseRecord();
  return {
    ...record,
    buildingTerms: {
      ...record.buildingTerms,
      declaredSd: userSourced<number>(0.8),
      socialFactorSd: userSourced<number>(0.5),
      totalSd: userSourced<number>(1.3),
      declaredCoveragePct: userSourced<number>(50),
      maxCoveragePct: userSourced<number>(60),
      declaredMaxHeight: userSourced<string>('κατά ΝΟΚ'),
    },
    ...overrides,
  };
}

function buildingCode(over: Partial<ProjectBuildingCodePhase2> = {}): ProjectBuildingCodePhase2 {
  return {
    plotType: 'mesaio',
    frontagesCount: 1,
    zoneId: null,
    sd: 1.3,
    coveragePct: 60,
    maxHeight: 11,
    provenance: { sd: 'user', coveragePct: 'user', maxHeight: 'user' },
    enabled: true,
    lastUpdated: NOW,
    ...over,
  } as ProjectBuildingCodePhase2;
}

function decision(over: Partial<FieldReconciliation> = {}): FieldReconciliation {
  return {
    field: 'sd',
    action: 'kept-ours',
    surveyValueAtDecision: 1.3,
    decidedBy: 'usr_1',
    decidedAt: NOW,
    ...over,
  };
}

describe('effective value mapping', () => {
  it('compares ΣΔ against the TOTAL, not the base — the total is what applies', () => {
    // Project sits at the base 0.8. If the comparison used `declaredSd` it would
    // report "identical" and the +0,5 social factor would never surface.
    const result = compareField(g753Record(), buildingCode({ sd: 0.8 }), 'sd');
    expect(result.surveyValue).toBe(1.3);
    expect(result.state).toBe('undecided');
  });

  it('falls back to the base ΣΔ when the drawing states no total', () => {
    const record = g753Record();
    const noTotal: SurveyRecord = {
      ...record,
      buildingTerms: { ...record.buildingTerms, totalSd: userSourced<number>(null) },
    };
    expect(compareField(noTotal, buildingCode(), 'sd').surveyValue).toBe(0.8);
  });

  it('compares coverage against the raised maximum when there is one', () => {
    const result = compareField(g753Record(), buildingCode({ coveragePct: 50 }), 'coveragePct');
    expect(result.surveyValue).toBe(60);
    expect(result.state).toBe('undecided');
  });
});

describe('states', () => {
  it('reports identical when both sides agree', () => {
    expect(compareField(g753Record(), buildingCode({ sd: 1.3 }), 'sd').state).toBe('identical');
  });

  it('reports no-survey-value when the drawing is silent', () => {
    const result = compareField(baseRecord(), buildingCode(), 'sd');
    expect(result.state).toBe('no-survey-value');
    expect(isActionable(result.state)).toBe(false);
  });

  it('reports not-comparable for a height stated as prose, and keeps the words', () => {
    // «κατά ΝΟΚ» must never be coerced to a number. A plausible-looking figure in
    // the wrong place is worse than no figure (ADR-759 §2β.5).
    const result = compareField(g753Record(), buildingCode(), 'maxHeight');
    expect(result.state).toBe('not-comparable');
    expect(result.surveyValue).toBeNull();
    expect(result.surveyText).toBe('κατά ΝΟΚ');
    expect(isActionable(result.state)).toBe(false);
  });

  it('does compare a height that really is a number', () => {
    const record = g753Record();
    const numeric: SurveyRecord = {
      ...record,
      buildingTerms: { ...record.buildingTerms, declaredMaxHeight: userSourced<string>('12,5') },
    };
    const result = compareField(numeric, buildingCode({ maxHeight: 11 }), 'maxHeight');
    expect(result.surveyValue).toBe(12.5);
    expect(result.state).toBe('undecided');
  });

  it('does not read a number out of a value that merely starts with one', () => {
    const record = g753Record();
    const prefixed: SurveyRecord = {
      ...record,
      buildingTerms: { ...record.buildingTerms, declaredMaxHeight: userSourced<string>('11 μ. κατά ΝΟΚ') },
    };
    expect(compareField(prefixed, buildingCode(), 'maxHeight').surveyValue).toBeNull();
  });
});

describe('decisions', () => {
  it('shows kept-ours once the difference has been accepted', () => {
    const record = g753Record({ reconciliations: [decision()] });
    expect(compareField(record, buildingCode({ sd: 0.8 }), 'sd').state).toBe('kept-ours');
  });

  it('shows adopted when the value was taken over', () => {
    const record = g753Record({ reconciliations: [decision({ action: 'adopted' })] });
    expect(compareField(record, buildingCode({ sd: 0.8 }), 'sd').state).toBe('adopted');
  });

  it('RE-OPENS a decision once the survey value changes underneath it', () => {
    // 🔴 The load-bearing case. The engineer accepted a difference against 1.3; the
    // record is later corrected to 1.5. Without `surveyValueAtDecision` the card
    // would keep showing "accepted difference" for a number nobody ever judged.
    const record = g753Record({
      reconciliations: [decision({ surveyValueAtDecision: 1.3 })],
      buildingTerms: {
        ...g753Record().buildingTerms,
        totalSd: userSourced<number>(1.5),
      },
    });
    const result = compareField(record, buildingCode({ sd: 0.8 }), 'sd');
    expect(result.state).toBe('reopened');
    expect(isActionable(result.state)).toBe(true);
  });

  it('ignores a decision belonging to a different field', () => {
    const record = g753Record({ reconciliations: [decision({ field: 'coveragePct' })] });
    expect(compareField(record, buildingCode({ sd: 0.8 }), 'sd').state).toBe('undecided');
  });

  it('replaces a previous decision for the same field instead of stacking', () => {
    const first = decision({ action: 'kept-ours' });
    const second = decision({ action: 'adopted' });
    const ledger = recordDecision(recordDecision([], first), second);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].action).toBe('adopted');
  });

  it('keeps decisions for other fields when recording one', () => {
    const ledger = recordDecision([decision({ field: 'coveragePct' })], decision({ field: 'sd' }));
    expect(ledger.map((r) => r.field).sort()).toEqual(['coveragePct', 'sd']);
  });
});

describe('the table as a whole', () => {
  it('covers every reconcilable field, once each', () => {
    const table = compareSurveyToBuildingCode(g753Record(), buildingCode());
    expect(table.map((c) => c.field)).toEqual([...RECONCILABLE_FIELDS]);
    expect(new Set(table.map((c) => c.field)).size).toBe(RECONCILABLE_FIELDS.length);
  });

  it('counts only what the engineer can actually act on', () => {
    // sd differs (undecided) · coverage identical · height not comparable ⇒ 1
    const table = compareSurveyToBuildingCode(
      g753Record(),
      buildingCode({ sd: 0.8, coveragePct: 60 }),
    );
    expect(countActionable(table)).toBe(1);
  });

  it('counts nothing when the drawing declares nothing', () => {
    expect(countActionable(compareSurveyToBuildingCode(baseRecord(), buildingCode()))).toBe(0);
  });
});
