/**
 * Unit tests for contactMapper.ts — SSoT safe field accessors + mapContactToFormData.
 *
 * Regression coverage for the 2026-04-24 incident where an unclosed `/**` JSDoc
 * block made `function toRecord(...)` part of a comment, raising
 * `ReferenceError: toRecord is not defined` at runtime. The error was silently
 * swallowed by `getSafeFieldValue`/`getSafeArrayValue` try/catch blocks, so the
 * edit form showed empty `firstName`/`lastName` for valid contacts.
 *
 * These tests assert the canonical behaviour of the accessors AND the
 * full `mapIndividualContactToFormData` round-trip so any regression of the
 * same class is caught at pre-commit time.
 *
 * @module utils/contactForm/__tests__/contactMapper
 * @see adrs/ADR-322-contact-mappers-test-coverage-ssot.md
 */

import {
  getSafeFieldValue,
  getSafeNestedValue,
  getSafeArrayValue,
  mapContactToFormData,
} from '../contactMapper';
import { mapIndividualContactToFormData } from '../fieldMappers/individualMapper';
import type { Contact, IndividualContact } from '@/types/contacts';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeIndividual(overrides: Partial<IndividualContact> = {}): IndividualContact {
  return {
    id: 'cont_test',
    type: 'individual',
    firstName: 'Georgios',
    lastName: 'Pagonis',
    status: 'active',
    companyId: 'comp_test',
    ...overrides,
  } as IndividualContact;
}

// ─── getSafeFieldValue ───────────────────────────────────────────────────────

describe('getSafeFieldValue', () => {
  it('returns the field value when present', () => {
    expect(getSafeFieldValue({ firstName: 'Georgios' }, 'firstName')).toBe('Georgios');
  });

  it('returns empty string fallback when field missing', () => {
    expect(getSafeFieldValue({ other: 'x' }, 'firstName')).toBe('');
  });

  it('returns empty string fallback when value is null', () => {
    expect(getSafeFieldValue({ firstName: null }, 'firstName')).toBe('');
  });

  it('returns empty string fallback when value is undefined', () => {
    expect(getSafeFieldValue({ firstName: undefined }, 'firstName')).toBe('');
  });

  it('returns custom fallback when provided and field missing', () => {
    expect(getSafeFieldValue({}, 'firstName', 'N/A')).toBe('N/A');
  });

  it('returns fallback when obj is null', () => {
    expect(getSafeFieldValue(null, 'firstName')).toBe('');
  });

  it('returns fallback when obj is undefined', () => {
    expect(getSafeFieldValue(undefined, 'firstName')).toBe('');
  });

  it('preserves non-string values (numbers)', () => {
    expect(getSafeFieldValue({ count: 42 }, 'count')).toBe(42);
  });

  it('preserves non-string values (booleans)', () => {
    expect(getSafeFieldValue({ active: true }, 'active')).toBe(true);
  });
});

// ─── getSafeNestedValue ──────────────────────────────────────────────────────

describe('getSafeNestedValue', () => {
  it('returns the nested value when path valid', () => {
    expect(getSafeNestedValue({ address: { street: 'Main' } }, 'address.street')).toBe('Main');
  });

  it('returns fallback when intermediate path is undefined', () => {
    expect(getSafeNestedValue({ address: undefined }, 'address.street')).toBe('');
  });

  it('returns fallback when leaf is null', () => {
    expect(getSafeNestedValue({ address: { street: null } }, 'address.street')).toBe('');
  });

  it('returns fallback when obj is null', () => {
    expect(getSafeNestedValue(null, 'address.street')).toBe('');
  });

  it('supports deep paths', () => {
    const obj = { a: { b: { c: 'deep' } } };
    expect(getSafeNestedValue(obj, 'a.b.c')).toBe('deep');
  });
});

// ─── getSafeArrayValue ───────────────────────────────────────────────────────

describe('getSafeArrayValue', () => {
  it('returns the array when present', () => {
    expect(getSafeArrayValue({ tags: ['a', 'b'] }, 'tags')).toEqual(['a', 'b']);
  });

  it('returns empty array fallback when field missing', () => {
    expect(getSafeArrayValue({}, 'tags')).toEqual([]);
  });

  it('returns empty array fallback when field is not an array', () => {
    expect(getSafeArrayValue({ tags: 'not-an-array' }, 'tags')).toEqual([]);
  });

  it('returns empty array fallback when obj is null', () => {
    expect(getSafeArrayValue(null, 'tags')).toEqual([]);
  });

  it('returns custom fallback when provided', () => {
    expect(getSafeArrayValue({}, 'tags', ['default'])).toEqual(['default']);
  });
});

// ─── mapIndividualContactToFormData — regression for the toRecord bug ────────

describe('mapIndividualContactToFormData', () => {
  it('populates firstName and lastName from a valid individual contact', () => {
    // 🚨 REGRESSION TEST (2026-04-24):
    // If `toRecord` ever ends up inside a comment again, `getSafeFieldValue`
    // throws `ReferenceError`, catches it, and returns `''`. This test locks
    // the contract: a valid contact MUST produce a populated form.
    const contact = makeIndividual({ firstName: 'Georgios', lastName: 'Pagonis' });
    const result = mapIndividualContactToFormData(contact);
    expect(result.firstName).toBe('Georgios');
    expect(result.lastName).toBe('Pagonis');
    expect(result.type).toBe('individual');
    expect(result.id).toBe('cont_test');
  });

  it('populates additional fields when present', () => {
    const contact = makeIndividual({
      firstName: 'A',
      lastName: 'B',
      fatherName: 'C',
      motherName: 'D',
      amka: '12345678901',
    });
    const result = mapIndividualContactToFormData(contact);
    expect(result.fatherName).toBe('C');
    expect(result.motherName).toBe('D');
    expect(result.amka).toBe('12345678901');
  });

  it('returns empty strings for missing optional fields (not undefined)', () => {
    const contact = makeIndividual({ firstName: 'A', lastName: 'B' });
    const result = mapIndividualContactToFormData(contact);
    // React inputs must get strings, never undefined
    expect(result.fatherName).toBe('');
    expect(result.motherName).toBe('');
    expect(result.amka).toBe('');
  });

  it('returns minimal form data when contact type is not individual', () => {
    const companyContact = { id: 'c1', type: 'company', companyName: 'X' } as unknown as Contact;
    const result = mapIndividualContactToFormData(companyContact);
    expect(result.id).toBe('c1');
    expect(result.firstName).toBe('');
    expect(result.lastName).toBe('');
  });
});

// ─── mapContactToFormData dispatcher ─────────────────────────────────────────

describe('mapContactToFormData', () => {
  it('routes individual contacts through the individual mapper', () => {
    const contact = makeIndividual({ firstName: 'Georgios', lastName: 'Pagonis' });
    const { formData, warnings } = mapContactToFormData(contact);
    expect(formData.firstName).toBe('Georgios');
    expect(formData.lastName).toBe('Pagonis');
    expect(warnings).toEqual([]);
  });

  it('warns on unknown contact type but still returns a form shell', () => {
    const contact = { id: 'c1', type: 'alien' } as unknown as Contact;
    const { formData, warnings } = mapContactToFormData(contact);
    expect(formData.id).toBe('c1');
    expect(warnings.length).toBeGreaterThan(0);
  });
});
