/**
 * ADR-405 — BIM Discipline Taxonomy SSoT — Unit tests.
 *
 * Covers:
 *   - DISCIPLINE_BY_CATEGORY locked decisions (slab=structural, annotations)
 *   - CATEGORIES_BY_DISCIPLINE is a faithful inverse (round-trip)
 *   - resolveEntityDiscipline priority (explicit > type > layer > null)
 *   - MODEL_DISCIPLINES contents
 */

import {
  DISCIPLINE_BY_CATEGORY,
  CATEGORIES_BY_DISCIPLINE,
  MODEL_DISCIPLINES,
  resolveEntityDiscipline,
} from '../bim-discipline';
import { BIM_CATEGORIES } from '../../../config/bim-object-styles';

describe('ADR-405 DISCIPLINE_BY_CATEGORY', () => {
  it('maps every BIM category (total over BimCategory)', () => {
    for (const cat of BIM_CATEGORIES) {
      expect(DISCIPLINE_BY_CATEGORY[cat]).toBeDefined();
    }
  });

  it('locked decision: slab → structural', () => {
    expect(DISCIPLINE_BY_CATEGORY.slab).toBe('structural');
  });

  it('ADR-406: light-fixture → electrical (first MEP placeable category)', () => {
    expect(DISCIPLINE_BY_CATEGORY['light-fixture']).toBe('electrical');
    // and the inverse map lists it under electrical.
    expect(CATEGORIES_BY_DISCIPLINE.electrical).toContain('light-fixture');
  });

  it('locked decision: column/beam/stair → structural', () => {
    expect(DISCIPLINE_BY_CATEGORY.column).toBe('structural');
    expect(DISCIPLINE_BY_CATEGORY.beam).toBe('structural');
    expect(DISCIPLINE_BY_CATEGORY.stair).toBe('structural');
  });

  it('architectural: wall/opening/slab-opening/roof/ceiling/envelope', () => {
    for (const cat of ['wall', 'opening', 'slab-opening', 'roof', 'ceiling', 'envelope'] as const) {
      expect(DISCIPLINE_BY_CATEGORY[cat]).toBe('architectural');
    }
  });

  it('locked decision: dimension/hatch/grip → annotation', () => {
    for (const cat of ['dimension', 'hatch', 'grip'] as const) {
      expect(DISCIPLINE_BY_CATEGORY[cat]).toBe('annotation');
    }
  });
});

describe('ADR-405 CATEGORIES_BY_DISCIPLINE (inverse)', () => {
  it('round-trips: every category appears under its discipline (annotations excluded)', () => {
    for (const cat of BIM_CATEGORIES) {
      const disc = DISCIPLINE_BY_CATEGORY[cat];
      if (disc === 'annotation') {
        // annotations are not part of any discipline bucket
        for (const d of Object.keys(CATEGORIES_BY_DISCIPLINE)) {
          expect(CATEGORIES_BY_DISCIPLINE[d as keyof typeof CATEGORIES_BY_DISCIPLINE]).not.toContain(cat);
        }
      } else {
        expect(CATEGORIES_BY_DISCIPLINE[disc]).toContain(cat);
      }
    }
  });

  it('disciplines with no placeable category yet map to []', () => {
    // ADR-406/408 populated electrical (light-fixture + electrical-panel + mep-wire);
    // ADR-410 populated interior (furniture). mechanical/plumbing remain reserved.
    expect(CATEGORIES_BY_DISCIPLINE.mechanical).toEqual([]);
    expect(CATEGORIES_BY_DISCIPLINE.plumbing).toEqual([]);
    expect(CATEGORIES_BY_DISCIPLINE.electrical).toEqual(['light-fixture', 'electrical-panel', 'mep-wire']);
    // ADR-410 — furniture is the first (and only) placeable interior category.
    expect(CATEGORIES_BY_DISCIPLINE.interior).toEqual(['furniture']);
  });
});

describe('ADR-405 MODEL_DISCIPLINES', () => {
  it('contains the placeable model disciplines (ADR-410 added interior)', () => {
    expect([...MODEL_DISCIPLINES]).toEqual([
      'architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'interior',
    ]);
  });
});

describe('ADR-405 resolveEntityDiscipline (priority)', () => {
  it('1. explicit per-instance override wins', () => {
    expect(
      resolveEntityDiscipline({ discipline: 'mechanical', category: 'wall', layerCategory: 'structural' }),
    ).toBe('mechanical');
  });

  it('2. type-derived from category when no override', () => {
    expect(resolveEntityDiscipline({ category: 'column' })).toBe('structural');
    expect(resolveEntityDiscipline({ category: 'wall' })).toBe('architectural');
  });

  it('3. layer aecCategory fallback when no category', () => {
    expect(resolveEntityDiscipline({ layerCategory: 'electrical' })).toBe('electrical');
  });

  it('4. null for DXF primitive (no override, no category, no layer)', () => {
    expect(resolveEntityDiscipline({})).toBeNull();
  });

  it('type beats layer (category present)', () => {
    expect(resolveEntityDiscipline({ category: 'beam', layerCategory: 'architectural' })).toBe('structural');
  });
});
