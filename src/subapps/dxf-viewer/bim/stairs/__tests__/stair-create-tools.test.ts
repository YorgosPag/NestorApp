/**
 * ADR-619 Bug #6 — regression guard: the stair persistence first-save listener
 * must accept BOTH stair-creating tools. A scattered `tool === 'stair'` check
 * dropped «Σκάλα από περιοχή» (`'stair-from-region'`) so the region stair was
 * never persisted and vanished on refresh.
 */

import {
  STAIR_CREATE_TOOLS,
  isStairCreateTool,
} from '../stair-create-tools';

describe('isStairCreateTool (ADR-619 stair-create tool SSoT)', () => {
  it('accepts the line-based stair tool', () => {
    expect(isStairCreateTool('stair')).toBe(true);
  });

  it('accepts «Σκάλα από περιοχή» — the regression that lost persistence', () => {
    expect(isStairCreateTool('stair-from-region')).toBe(true);
  });

  it('rejects other entity tools and empty input', () => {
    expect(isStairCreateTool('wall')).toBe(false);
    expect(isStairCreateTool('column')).toBe(false);
    expect(isStairCreateTool('slab')).toBe(false);
    expect(isStairCreateTool(undefined)).toBe(false);
    expect(isStairCreateTool('')).toBe(false);
  });

  it('every listed tool is accepted (array ↔ predicate stay in lock-step)', () => {
    for (const tool of STAIR_CREATE_TOOLS) {
      expect(isStairCreateTool(tool)).toBe(true);
    }
  });
});
