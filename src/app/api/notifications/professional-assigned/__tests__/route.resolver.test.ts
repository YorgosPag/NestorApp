/**
 * Tests for professional-assigned notification — role→dept mapping + L2 fallback (ADR-326 Phase 6.2)
 */

import { mapRoleToDept } from '../role-to-dept-map';

describe('mapRoleToDept', () => {
  it('maps legal_advisor to legal', () => {
    expect(mapRoleToDept('legal_advisor')).toBe('legal');
  });

  it('maps civil_engineer to engineering', () => {
    expect(mapRoleToDept('civil_engineer')).toBe('engineering');
  });

  it('maps architect to engineering', () => {
    expect(mapRoleToDept('architect')).toBe('engineering');
  });

  it('maps accountant to accounting', () => {
    expect(mapRoleToDept('accountant')).toBe('accounting');
  });

  it('returns null for unknown role', () => {
    expect(mapRoleToDept('unknown_role')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapRoleToDept('')).toBeNull();
  });
});
