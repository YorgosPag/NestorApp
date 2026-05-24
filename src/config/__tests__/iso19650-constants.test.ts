/**
 * Unit tests for ISO 19650 constants module (ADR-373 Phase 1).
 * Covers: enum exhaustiveness, regex edge cases, StudyGroup mapping.
 */

import type { StudyGroup } from '@/config/study-groups-config';
import {
  BUILDING_CODE_REGEX,
  CDE_STATES,
  CDE_STATE_VALUES,
  DISCIPLINE_CODES,
  DISCIPLINE_CODE_VALUES,
  DOCUMENT_SERIES,
  DOCUMENT_SERIES_VALUES,
  ISO19650_BUDGET_CAP_USD,
  REVISION_CODE_REGEX,
  SUITABILITY_CODES,
  SUITABILITY_CODE_REGEX,
  SUITABILITY_CODE_VALUES,
  STUDY_GROUP_TO_DEFAULT_DISCIPLINE,
  type DisciplineCode,
} from '@/config/iso19650-constants';

describe('iso19650-constants — discipline codes (OQ1)', () => {
  it('exposes exactly 13 discipline codes (core 8 + extended 5)', () => {
    expect(DISCIPLINE_CODE_VALUES).toHaveLength(13);
  });

  it('includes all core 8 + extended 5 letters', () => {
    const expected = ['A', 'S', 'M', 'E', 'K', 'H', 'N', 'X', 'T', 'L', 'P', 'F', 'D'];
    expect(DISCIPLINE_CODE_VALUES.sort()).toEqual(expected.sort());
  });

  it('every discipline has a non-empty Greek label', () => {
    DISCIPLINE_CODE_VALUES.forEach((code) => {
      expect(DISCIPLINE_CODES[code].labelEl.length).toBeGreaterThan(0);
    });
  });

  it('every discipline maps to a valid StudyGroup', () => {
    const validGroups: ReadonlyArray<StudyGroup> = [
      'administrative', 'fiscal', 'architectural', 'structural',
      'mechanical', 'energy', 'site',
    ];
    DISCIPLINE_CODE_VALUES.forEach((code) => {
      expect(validGroups).toContain(DISCIPLINE_CODES[code].studyGroup);
    });
  });
});

describe('iso19650-constants — document series (OQ3)', () => {
  it('exposes exactly 9 numeric series', () => {
    expect(DOCUMENT_SERIES_VALUES).toHaveLength(9);
  });

  it('series numbers are 100..900 in steps of 100', () => {
    expect(DOCUMENT_SERIES_VALUES.sort((a, b) => a - b)).toEqual([
      100, 200, 300, 400, 500, 600, 700, 800, 900,
    ]);
  });

  it('every series has Greek + English labels', () => {
    DOCUMENT_SERIES_VALUES.forEach((s) => {
      expect(DOCUMENT_SERIES[s].labelEl).toBeTruthy();
      expect(DOCUMENT_SERIES[s].labelEn).toBeTruthy();
    });
  });
});

describe('iso19650-constants — CDE states (OQ4)', () => {
  it('exposes exactly 4 states', () => {
    expect(CDE_STATE_VALUES).toHaveLength(4);
  });

  it('contains SUPERSEDED (not ARCHIVED) for disambiguation', () => {
    expect(CDE_STATE_VALUES).toContain('SUPERSEDED');
    expect(CDE_STATE_VALUES).not.toContain('ARCHIVED');
  });

  it('Greek labels are present for all states', () => {
    CDE_STATE_VALUES.forEach((s) => {
      expect(CDE_STATES[s].labelEl).toBeTruthy();
    });
  });
});

describe('iso19650-constants — REVISION_CODE_REGEX (OQ2)', () => {
  it.each(['P01', 'T02', 'C03', 'R10', 'AB99', 'P00', 'AB00'])(
    'accepts valid revision code %s',
    (code) => {
      expect(REVISION_CODE_REGEX.test(code)).toBe(true);
    },
  );

  it.each([
    ['P1', 'single digit'],
    ['P001', 'three digits'],
    ['X05', 'unknown prefix'],
    ['p01', 'lowercase'],
    ['IFC', 'suitability code — separate field'],
    ['IFA', 'suitability code — separate field'],
    ['ASB', 'suitability code — separate field'],
    ['', 'empty'],
    ['P 01', 'space'],
  ])('rejects invalid revision code %s (%s)', (code) => {
    expect(REVISION_CODE_REGEX.test(code)).toBe(false);
  });
});

describe('iso19650-constants — BUILDING_CODE_REGEX (OQ5)', () => {
  it.each([
    'Κ1', 'Κ12', 'Κ1-Α', 'Κ1-Β1', 'A-1', 'B12-Γ2', 'A1', 'Α99',
  ])('accepts valid building code %s', (code) => {
    expect(BUILDING_CODE_REGEX.test(code)).toBe(true);
  });

  it.each([
    ['κ1', 'lowercase main'],
    ['Κ123', 'three digits in main'],
    ['Κ1-Α-Β', 'multi-dash chain'],
    ['Κ', 'missing digit'],
    ['1Κ', 'digit before letter'],
    ['Κ1-', 'trailing dash without suffix'],
    ['Κ1-αβγδ', 'suffix > 3 chars'],
    ['', 'empty'],
  ])('rejects invalid building code %s (%s)', (code) => {
    expect(BUILDING_CODE_REGEX.test(code)).toBe(false);
  });
});

describe('iso19650-constants — STUDY_GROUP_TO_DEFAULT_DISCIPLINE', () => {
  it('covers all 7 StudyGroups with a valid DisciplineCode', () => {
    const groups: ReadonlyArray<StudyGroup> = [
      'administrative', 'fiscal', 'architectural', 'structural',
      'mechanical', 'energy', 'site',
    ];
    groups.forEach((g) => {
      const code = STUDY_GROUP_TO_DEFAULT_DISCIPLINE[g];
      expect(DISCIPLINE_CODE_VALUES).toContain(code as DisciplineCode);
    });
  });

  it('mechanical defaults to M (AI may override to E/L/F by content)', () => {
    expect(STUDY_GROUP_TO_DEFAULT_DISCIPLINE.mechanical).toBe('M');
  });

  it('site defaults to H (AI may override to T/D)', () => {
    expect(STUDY_GROUP_TO_DEFAULT_DISCIPLINE.site).toBe('H');
  });
});

describe('iso19650-constants — ISO19650_BUDGET_CAP_USD (OQ6)', () => {
  it('is set to $0.01 per file', () => {
    expect(ISO19650_BUDGET_CAP_USD).toBe(0.01);
  });
});

describe('iso19650-constants — suitability codes (BS 1192 OQ2 Phase 2)', () => {
  it('exposes exactly 4 suitability codes', () => {
    expect(SUITABILITY_CODE_VALUES).toHaveLength(4);
  });

  it('contains IFA/IFR/IFC/ASB', () => {
    expect(SUITABILITY_CODE_VALUES.sort()).toEqual(['ASB', 'IFA', 'IFC', 'IFR']);
  });

  it('every suitability code has Greek + English labels', () => {
    SUITABILITY_CODE_VALUES.forEach((code) => {
      expect(SUITABILITY_CODES[code].labelEl).toBeTruthy();
      expect(SUITABILITY_CODES[code].labelEn).toBeTruthy();
    });
  });

  it.each(['IFA', 'IFR', 'IFC', 'ASB'])(
    'SUITABILITY_CODE_REGEX accepts %s',
    (code) => {
      expect(SUITABILITY_CODE_REGEX.test(code)).toBe(true);
    },
  );

  it.each([
    ['ifa', 'lowercase'],
    ['IFXX', 'unknown code'],
    ['IFC ', 'trailing space'],
    ['', 'empty'],
    ['P01', 'revision code — different field'],
    ['R02', 'revision code — different field'],
  ])('SUITABILITY_CODE_REGEX rejects %s (%s)', (code) => {
    expect(SUITABILITY_CODE_REGEX.test(code)).toBe(false);
  });

  it('suitability codes are distinct from revision codes (orthogonality)', () => {
    const suitabilityCodes = new Set(SUITABILITY_CODE_VALUES);
    const revisionPrefixes = ['P', 'T', 'C', 'R', 'AB'];
    revisionPrefixes.forEach((prefix) => {
      expect(suitabilityCodes.has(prefix as never)).toBe(false);
    });
  });
});
