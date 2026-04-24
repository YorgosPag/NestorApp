/**
 * Unit tests for data-cleaning utilities.
 *
 * Primary focus: `sanitizeContactForUpdate` (ADR-323) — the SSoT that splits
 * a partial update payload into `cleanUpdates` (real values to write) and
 * `fieldsToDelete` (fields the user explicitly cleared, paired with Firestore
 * `deleteField()` by the service layer).
 *
 * Regression coverage for the 2026-04-24 bloat incident: updateContact was
 * writing ~30 empty default fields on every save because sanitize was only
 * called in createContact.
 *
 * @module utils/contactForm/utils/__tests__/data-cleaning
 * @see adrs/ADR-323-contact-mutations-sanitize-ssot-diff-updates.md
 */

import {
  sanitizeContactForUpdate,
  type ContactDataRecord,
} from '../data-cleaning';

describe('sanitizeContactForUpdate', () => {
  // ─── cleanUpdates: real values that must be written ──────────────────────

  it('keeps non-empty string values in cleanUpdates', () => {
    const result = sanitizeContactForUpdate({ firstName: 'Georgios' });
    expect(result.cleanUpdates).toEqual({ firstName: 'Georgios' });
    expect(result.fieldsToDelete).toEqual([]);
  });

  it('keeps non-empty arrays in cleanUpdates', () => {
    const result = sanitizeContactForUpdate({
      personas: [{ personaType: 'client', status: 'active' }],
    } as ContactDataRecord);
    expect(result.cleanUpdates.personas).toEqual([{ personaType: 'client', status: 'active' }]);
    expect(result.fieldsToDelete).toEqual([]);
  });

  it('keeps numbers and booleans in cleanUpdates', () => {
    const result = sanitizeContactForUpdate({ isFavorite: true, age: 42 } as ContactDataRecord);
    expect(result.cleanUpdates).toEqual({ isFavorite: true, age: 42 });
    expect(result.fieldsToDelete).toEqual([]);
  });

  it('keeps non-empty nested objects in cleanUpdates', () => {
    const result = sanitizeContactForUpdate({
      socialMedia: { facebook: 'fb.com/g', instagram: '' },
    } as ContactDataRecord);
    // facebook kept, instagram flagged for deletion inside
    expect(result.cleanUpdates.socialMedia).toEqual({ facebook: 'fb.com/g' });
  });

  // ─── fieldsToDelete: explicit user clears ────────────────────────────────

  it('flags empty string as fieldToDelete', () => {
    const result = sanitizeContactForUpdate({ fatherName: '' });
    expect(result.cleanUpdates).toEqual({});
    expect(result.fieldsToDelete).toEqual(['fatherName']);
  });

  it('flags whitespace-only string as fieldToDelete', () => {
    const result = sanitizeContactForUpdate({ fatherName: '   ' });
    expect(result.fieldsToDelete).toEqual(['fatherName']);
  });

  it('flags empty array as fieldToDelete', () => {
    const result = sanitizeContactForUpdate({ tags: [] } as ContactDataRecord);
    expect(result.cleanUpdates).toEqual({});
    expect(result.fieldsToDelete).toEqual(['tags']);
  });

  it('flags explicit null as fieldToDelete', () => {
    const result = sanitizeContactForUpdate({ notes: null } as unknown as ContactDataRecord);
    expect(result.fieldsToDelete).toEqual(['notes']);
  });

  it('flags whole object as fieldToDelete when ALL nested fields are empty', () => {
    const result = sanitizeContactForUpdate({
      socialMedia: { facebook: '', instagram: '', linkedin: '' },
    } as ContactDataRecord);
    expect(result.cleanUpdates).toEqual({});
    expect(result.fieldsToDelete).toEqual(['socialMedia']);
  });

  // ─── undefined: leave untouched (no-op) ──────────────────────────────────

  it('drops undefined fields (no write, no delete — leaves Firestore value alone)', () => {
    const result = sanitizeContactForUpdate({
      firstName: 'Georgios',
      lastName: undefined,
    } as ContactDataRecord);
    expect(result.cleanUpdates).toEqual({ firstName: 'Georgios' });
    expect(result.fieldsToDelete).toEqual([]);
  });

  // ─── requiresSpecialDeletion: preserve photo fields ──────────────────────

  it('preserves photoURL even if empty (special deletion semantics elsewhere)', () => {
    const result = sanitizeContactForUpdate({ photoURL: '' } as ContactDataRecord);
    expect(result.cleanUpdates.photoURL).toBe('');
    expect(result.fieldsToDelete).toEqual([]);
  });

  it('preserves logoURL even if empty', () => {
    const result = sanitizeContactForUpdate({ logoURL: '' } as ContactDataRecord);
    expect(result.cleanUpdates.logoURL).toBe('');
    expect(result.fieldsToDelete).toEqual([]);
  });

  it('preserves multiplePhotoURLs even if empty array', () => {
    const result = sanitizeContactForUpdate({
      multiplePhotoURLs: [],
    } as ContactDataRecord);
    expect(result.cleanUpdates.multiplePhotoURLs).toEqual([]);
    expect(result.fieldsToDelete).toEqual([]);
  });

  // ─── mixed payload: the real-world bloat regression test ─────────────────

  it('2026-04-24 regression: strips initialFormData defaults from a real update payload', () => {
    // This payload mimics what came out of the pre-L2 form state — a single
    // user-touched field (fatherName) drowning in default empties. Post-fix,
    // only fatherName must survive as a write; everything else must be either
    // dropped (undefined), flagged for deletion (empty), or preserved-as-is
    // (photo fields).
    const result = sanitizeContactForUpdate({
      fatherName: 'ΝΕΣΤΟΡΑΣ',
      specialty: '',
      notes: '',
      emails: [],
      phones: [],
      documents: { announcementDocs: [], registrationDocs: [] },
      socialMedia: { facebook: '', instagram: '', linkedin: '', twitter: '' },
      escoUri: '',
      escoSkills: [],
      personas: [],
      motherName: '',
      photoURL: '',
      multiplePhotoURLs: [],
    } as ContactDataRecord);

    expect(result.cleanUpdates).toEqual({
      fatherName: 'ΝΕΣΤΟΡΑΣ',
      photoURL: '',
      multiplePhotoURLs: [],
    });
    expect(result.fieldsToDelete.sort()).toEqual(
      [
        'specialty',
        'notes',
        'emails',
        'phones',
        'documents',
        'socialMedia',
        'escoUri',
        'escoSkills',
        'personas',
        'motherName',
      ].sort(),
    );
  });

  // ─── idempotency ─────────────────────────────────────────────────────────

  it('is idempotent on cleanUpdates (running twice yields same result)', () => {
    const input = { firstName: 'X', fatherName: '', tags: [] } as ContactDataRecord;
    const first = sanitizeContactForUpdate(input);
    const second = sanitizeContactForUpdate(first.cleanUpdates);
    expect(second.cleanUpdates).toEqual(first.cleanUpdates);
  });
});
