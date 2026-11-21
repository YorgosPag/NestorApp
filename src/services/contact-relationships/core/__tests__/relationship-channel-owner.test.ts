/**
 * ADR-372 §8.5 b1 — whose channels a relationship carries: the ROLE HOLDER, not the card.
 */
import { relationshipChannelOwnerSide } from '../relationship-field-codec';

describe('relationshipChannelOwnerSide', () => {
  it('person → organisation: the person (source) holds the channels', () => {
    expect(relationshipChannelOwnerSide('individual', 'company')).toBe('source');
    expect(relationshipChannelOwnerSide('individual', 'service')).toBe('source');
  });

  it('organisation → person: the person (target) holds the channels', () => {
    expect(relationshipChannelOwnerSide('company', 'individual')).toBe('target');
    expect(relationshipChannelOwnerSide('service', 'individual')).toBe('target');
  });

  it('person ↔ person and organisation ↔ organisation: the stored source', () => {
    expect(relationshipChannelOwnerSide('individual', 'individual')).toBe('source');
    expect(relationshipChannelOwnerSide('company', 'company')).toBe('source');
    expect(relationshipChannelOwnerSide('company', 'service')).toBe('source');
  });

  it('unknown type reads as a person (the historic default of contactOwnerKindOf)', () => {
    expect(relationshipChannelOwnerSide('company', undefined)).toBe('target');
  });
});
