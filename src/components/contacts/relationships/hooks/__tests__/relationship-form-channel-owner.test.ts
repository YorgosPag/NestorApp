/**
 * ADR-372 §8.5 b1 — the form asks WHOSE channels these are from the encoded role and both
 * contact types; the rule itself is the codec's `relationshipChannelOwnerSide`.
 */
jest.mock('@/services/contact-relationships/core/RelationshipValidationService', () => ({
  RelationshipValidationError: class RelationshipValidationError extends Error {},
}));

import { formChannelOwner } from '../relationship-form-orientation';

describe('formChannelOwner', () => {
  it('picked type still unknown ⇒ the current contact', () => {
    expect(formChannelOwner('vendor', 'company', undefined)).toEqual({ side: 'current', kind: 'company' });
  });

  it('person on the picked side of a company card ⇒ the picked person, with or without a role', () => {
    expect(formChannelOwner('', 'company', 'individual')).toEqual({ side: 'picked', kind: 'individual' });
    expect(formChannelOwner('employee', 'company', 'individual')).toEqual({ side: 'picked', kind: 'individual' });
  });

  it('person card, picked company ⇒ the current person', () => {
    expect(formChannelOwner('employee', 'individual', 'company')).toEqual({ side: 'current', kind: 'individual' });
  });

  it('company ↔ company ⇒ the stored source, which the role decides', () => {
    // `vendor` (no suffix) ⇒ the picked contact is the source.
    expect(formChannelOwner('vendor', 'company', 'service')).toEqual({ side: 'picked', kind: 'service' });
    // `vendor@inverse` ⇒ the current contact is the source.
    expect(formChannelOwner('vendor@inverse', 'company', 'service')).toEqual({ side: 'current', kind: 'company' });
  });

  it('company ↔ company without a role ⇒ the current contact', () => {
    expect(formChannelOwner('', 'company', 'company')).toEqual({ side: 'current', kind: 'company' });
  });
});
