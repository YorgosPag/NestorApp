/**
 * @fileoverview eu-member-states — η ΜΙΑ ρίζα των κρατών μελών της ΕΕ (ADR-ACC-003 §22.5)
 */

import { ADDRESS_COUNTRY_OPTIONS } from '@/utils/address/country-codes';
import { EU_MEMBER_STATES, isEuMemberState } from '../eu-member-states';

describe('EU_MEMBER_STATES', () => {
  it('27 κράτη μέλη, μοναδικά, κωδικοί ISO alpha-2 με κεφαλαία', () => {
    expect(EU_MEMBER_STATES).toHaveLength(27);
    expect(new Set(EU_MEMBER_STATES).size).toBe(27);
    for (const code of EU_MEMBER_STATES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it('η Ελλάδα είναι GR (ISO), όχι EL (πρόθεμα ΑΦΜ στο VIES)', () => {
    expect(isEuMemberState('GR')).toBe(true);
    expect(isEuMemberState('EL')).toBe(false);
  });

  it('το Ηνωμένο Βασίλειο δεν είναι κράτος μέλος· πεζά/κενό/null ⇒ όχι', () => {
    expect(isEuMemberState('GB')).toBe(false);
    expect(isEuMemberState('nl')).toBe(false);
    expect(isEuMemberState('')).toBe(false);
    expect(isEuMemberState(null)).toBe(false);
  });

  it('κάθε κράτος μέλος διαλέγεται στον κεντρικό κατάλογο χωρών (αλλιώς ο πελάτης του δεν δηλώνεται)', () => {
    const selectable = new Set(ADDRESS_COUNTRY_OPTIONS.map((option) => option.value));
    expect(EU_MEMBER_STATES.filter((code) => !selectable.has(code))).toEqual([]);
  });
});
