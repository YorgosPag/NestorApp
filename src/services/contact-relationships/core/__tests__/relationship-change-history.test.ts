/**
 * ADR-372 §8.6 — a save that changes nothing writes nothing; a save writes only what changed.
 *
 * 🔴 Measured live 2026-11-21 (rel_dc28b4ea): opening a relationship and pressing «Update»
 * without touching anything logged `changedFields: ["isWorkplace"]` and wrote
 * `isWorkplace: false` + `notes: null` — the store had never held the field, the form
 * materialised its default.
 */
import type { PhoneInfo } from '@/types/contacts';
import type { ContactRelationship } from '@/types/contacts/relationships';
import { diffChangedFields, pickChangedFields } from '../relationship-change-history';
import {
  projectContactInfo,
  relationshipEmailsOf,
  relationshipPhonesOf,
} from '../relationship-field-codec';

/** The payload the edit form sends for an UNTOUCHED record (same codec as `useRelationshipForm`). */
function untouchedFormPayload(stored: Partial<ContactRelationship>): Partial<ContactRelationship> {
  const phones = relationshipPhonesOf(stored);
  const emails = relationshipEmailsOf(stored);
  return {
    sourceContactId: stored.sourceContactId,
    targetContactId: stored.targetContactId,
    relationshipType: stored.relationshipType,
    position: stored.position || null,
    department: stored.department || null,
    startDate: stored.startDate ?? null,
    endDate: stored.endDate ?? null,
    notes: stored.notes || null,
    isWorkplace: stored.isWorkplace === true,
    phones,
    emails,
    contactInfo: projectContactInfo({ ...stored.contactInfo }, phones, emails),
  };
}

const structured: Partial<ContactRelationship> = {
  sourceContactId: 'cont_person',
  targetContactId: 'cont_company',
  relationshipType: 'employee',
  position: 'sales_rep',
  department: null,
  startDate: null,
  endDate: null,
  phones: [{ number: '6979793929', type: 'work', isPrimary: true, label: '', countryCode: '+30' }],
  emails: [{ email: 'dimitrios@aries.gr', type: 'work', isPrimary: true, label: '' }],
  contactInfo: { businessPhone: '+30 6979793929', businessEmail: 'dimitrios@aries.gr' },
};

describe('diffChangedFields — compares MEANING, not spelling', () => {
  it('a stored record without `isWorkplace` ≡ the form\'s `false` (implicit presence)', () => {
    expect(diffChangedFields(structured, untouchedFormPayload(structured))).toEqual([]);
  });

  it('a legacy record (channels only as display strings) round-trips unchanged', () => {
    const legacy: Partial<ContactRelationship> = {
      ...structured,
      phones: undefined,
      emails: undefined,
      contactInfo: { businessPhone: '+30 2310686440 (13)', businessEmail: 'logistirio@aries.gr' },
    };
    expect(diffChangedFields(legacy, untouchedFormPayload(legacy))).toEqual([]);
  });

  it('a stored instant ≡ the form\'s calendar day (measured live: rel_2d0d7053)', () => {
    const stored = { ...structured, startDate: '2026-11-21T11:36:52.119Z' };
    const payload = { ...untouchedFormPayload(stored), startDate: '2026-11-21' };
    expect(diffChangedFields(stored, payload)).toEqual([]);
  });

  it('a different day is still a change', () => {
    const stored = { ...structured, startDate: '2026-11-21T11:36:52.119Z' };
    const payload = { ...untouchedFormPayload(stored), startDate: '2026-11-20' };
    expect(diffChangedFields(stored, payload)).toEqual(['startDate']);
  });

  it('a real change is still a change — including `isWorkplace` turned on', () => {
    const payload = { ...untouchedFormPayload(structured), isWorkplace: true, position: 'manager' };
    expect(diffChangedFields(structured, payload).sort()).toEqual(['isWorkplace', 'position']);
  });

  it('an explicit `isWorkplace: true` turned off is a change', () => {
    const stored = { ...structured, isWorkplace: true };
    expect(diffChangedFields(stored, { ...untouchedFormPayload(stored), isWorkplace: false })).toEqual(['isWorkplace']);
  });

  it('a changed phone changes the channels AND their projection', () => {
    const payload = untouchedFormPayload(structured);
    const phones: PhoneInfo[] = [{ number: '6900000000', type: 'mobile', isPrimary: true, label: '', countryCode: '+30' }];
    const changed = { ...payload, phones, contactInfo: projectContactInfo(payload.contactInfo, phones, payload.emails ?? []) };
    expect(diffChangedFields(structured, changed).sort()).toEqual(['contactInfo', 'phones']);
  });

  it('bookkeeping fields are never a change', () => {
    const payload = { ...untouchedFormPayload(structured), lastModifiedBy: 'uid_other', updatedAt: new Date() };
    expect(diffChangedFields(structured, payload)).toEqual([]);
  });
});

describe('pickChangedFields — the field mask (AIP-134)', () => {
  it('keeps only the changed fields, including an explicit null', () => {
    const payload = { ...untouchedFormPayload(structured), position: null, notes: null };
    expect(pickChangedFields(payload, ['position'])).toEqual({ position: null });
  });

  it('never invents a field the update does not carry', () => {
    expect(pickChangedFields({ position: 'x' }, ['position', 'notes'])).toEqual({ position: 'x' });
  });
});
