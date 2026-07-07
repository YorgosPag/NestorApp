/**
 * ADR-581 — Match habit store (default checklist από συνήθεια) tests.
 */

import { getDefaultChecklist, recordApply, __resetMatchHabitStore } from '../match-habit-store';
import {
  ROLE_STYLE_COLOR,
  ROLE_GEOM_WIDTH,
  ROLE_MATERIAL_PRIMARY,
  asRole,
} from '../semantic-roles';
import type { SemanticRole } from '../match-types';

const ROLE_STRUCT = asRole('structural.concreteGrade');

const OFFERED: SemanticRole[] = [ROLE_STYLE_COLOR, ROLE_GEOM_WIDTH, ROLE_STRUCT, ROLE_MATERIAL_PRIMARY];

beforeEach(() => __resetMatchHabitStore());

describe('getDefaultChecklist — cold start', () => {
  it('style + geometry ON, structural/material OFF (καμία εμπειρία)', () => {
    const on = getDefaultChecklist('column', 'column', OFFERED);
    expect(on.has(ROLE_STYLE_COLOR)).toBe(true);
    expect(on.has(ROLE_GEOM_WIDTH)).toBe(true);
    expect(on.has(ROLE_STRUCT)).toBe(false);
    expect(on.has(ROLE_MATERIAL_PRIMARY)).toBe(false);
  });
});

describe('recordApply → habit', () => {
  it('ρόλος επιλεγμένος στην πλειοψηφία → default ON· απορριφθείς → OFF', () => {
    // 3 apply: ο structural επιλέγεται 2/3 (ON), ο style 0/3 (OFF παρά το cold-start).
    recordApply('column', 'column', OFFERED, new Set([ROLE_STRUCT]));
    recordApply('column', 'column', OFFERED, new Set([ROLE_STRUCT]));
    recordApply('column', 'column', OFFERED, new Set());

    const on = getDefaultChecklist('column', 'column', OFFERED);
    expect(on.has(ROLE_STRUCT)).toBe(true);      // 2/3 ≥ 0.5
    expect(on.has(ROLE_STYLE_COLOR)).toBe(false); // 0/3 < 0.5 (η εμπειρία υπερισχύει του cold-start)
  });

  it('η συνήθεια είναι ανά ζεύγος (sourceType,targetType)', () => {
    recordApply('column', 'beam', OFFERED, new Set([ROLE_STRUCT]));
    recordApply('column', 'beam', OFFERED, new Set([ROLE_STRUCT]));
    // Το ζεύγος column→column παραμένει cold-start.
    expect(getDefaultChecklist('column', 'beam', OFFERED).has(ROLE_STRUCT)).toBe(true);
    expect(getDefaultChecklist('column', 'column', OFFERED).has(ROLE_STRUCT)).toBe(false);
  });
});
