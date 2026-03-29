/**
 * @tests Filter Operators — ADR-268 Report Builder
 * Validates operator-per-type mapping and edge cases.
 */

import { OPERATORS_BY_TYPE, isValidOperatorForType, type FilterOperator, type FieldValueType } from '../report-builder-types';
import { DOMAIN_DEFINITIONS } from '../domain-definitions';

// ============================================================================
// Operator Mapping Correctness
// ============================================================================

describe('Filter Operators — Type Mapping', () => {
  it('text supports only: eq, neq, contains, starts_with', () => {
    const ops = OPERATORS_BY_TYPE.text;
    expect([...ops].sort()).toEqual(['contains', 'eq', 'neq', 'starts_with']);
  });

  it('enum supports only: eq, neq, in', () => {
    const ops = OPERATORS_BY_TYPE.enum;
    expect([...ops].sort()).toEqual(['eq', 'in', 'neq']);
  });

  it('number supports: eq, neq, gt, gte, lt, lte, between', () => {
    const ops = OPERATORS_BY_TYPE.number;
    expect(ops).toHaveLength(7);
    expect(ops).toContain('between');
  });

  it('currency has same operators as number', () => {
    expect([...OPERATORS_BY_TYPE.currency].sort()).toEqual(
      [...OPERATORS_BY_TYPE.number].sort(),
    );
  });

  it('percentage has same operators as number', () => {
    expect([...OPERATORS_BY_TYPE.percentage].sort()).toEqual(
      [...OPERATORS_BY_TYPE.number].sort(),
    );
  });

  it('date supports: eq, before, after, between', () => {
    const ops = OPERATORS_BY_TYPE.date;
    expect([...ops].sort()).toEqual(['after', 'before', 'between', 'eq']);
  });

  it('boolean supports only: eq', () => {
    const ops = OPERATORS_BY_TYPE.boolean;
    expect(ops).toEqual(['eq']);
  });
});

// ============================================================================
// Cross-validation: All domain fields have valid operators
// ============================================================================

describe('Filter Operators — Domain Cross-Validation', () => {
  for (const [domainId, def] of Object.entries(DOMAIN_DEFINITIONS)) {
    describe(`${domainId}`, () => {
      for (const field of def.fields) {
        if (!field.filterable) continue;

        it(`${field.key} (${field.type}) has at least 1 valid operator`, () => {
          const validOps = OPERATORS_BY_TYPE[field.type];
          expect(validOps.length).toBeGreaterThan(0);
        });

        it(`${field.key} first operator is valid for its type`, () => {
          const firstOp = OPERATORS_BY_TYPE[field.type][0];
          expect(isValidOperatorForType(firstOp, field.type)).toBe(true);
        });
      }
    });
  }
});

// ============================================================================
// Negative Cases
// ============================================================================

describe('Filter Operators — Invalid Combinations', () => {
  const invalid: Array<[FilterOperator, FieldValueType]> = [
    ['contains', 'number'],
    ['contains', 'currency'],
    ['contains', 'boolean'],
    ['contains', 'date'],
    ['starts_with', 'number'],
    ['starts_with', 'enum'],
    ['gt', 'text'],
    ['gt', 'enum'],
    ['gt', 'boolean'],
    ['between', 'text'],
    ['between', 'enum'],
    ['between', 'boolean'],
    ['before', 'text'],
    ['before', 'number'],
    ['after', 'enum'],
    ['in', 'text'],
    ['in', 'number'],
    ['in', 'boolean'],
    ['in', 'date'],
  ];

  it.each(invalid)(
    '%s is NOT valid for %s',
    (op, type) => {
      expect(isValidOperatorForType(op, type)).toBe(false);
    },
  );
});
