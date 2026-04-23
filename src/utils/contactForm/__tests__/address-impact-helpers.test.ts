/**
 * Unit tests for ADR-277 HQ address impact detection helpers.
 *
 * Locks the extractHeadquartersAddress fallback chain and the
 * field-by-field hasHQAddressChanged contract so project-address
 * cascade logic (triggered on HQ change) doesn't silently break
 * when the contact data shape evolves.
 *
 * @module utils/contactForm/__tests__/address-impact-helpers
 * @see ADR-277 Address Impact Guard
 */

import {
  CompanyAddressSnapshot,
  extractHeadquartersAddress,
  hasHQAddressChanged,
} from '../address-impact-helpers';
import type { Contact } from '@/types/contacts';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeContact(overrides: Partial<{
  customFields: Record<string, unknown>;
  addresses: Array<{
    street: string; number?: string; city: string;
    postalCode: string; country: string;
    type: string; isPrimary: boolean;
  }>;
}>): Contact {
  return {
    id: 'c1',
    type: 'company',
    companyName: 'ACME',
    companyId: 'co1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as Contact;
}

const ADDR_BASE = {
  street: 'Αγγελάκη',
  number: '5',
  city: 'Θεσσαλονίκη',
  postalCode: '54621',
  country: 'GR',
  type: 'work',
  isPrimary: true,
};

// ─── extractHeadquartersAddress ───────────────────────────────────────────────

describe('extractHeadquartersAddress', () => {
  describe('customFields.companyAddresses path', () => {
    it('returns headquarters address when type=headquarters exists', () => {
      const contact = makeContact({
        customFields: {
          companyAddresses: [
            { type: 'branch', street: 'Other', number: '1', city: 'X', postalCode: '11111' },
            { type: 'headquarters', street: 'Αγγελάκη', number: '5', city: 'Θεσσαλονίκη', postalCode: '54621' },
          ],
        },
      });
      const result = extractHeadquartersAddress(contact);
      expect(result?.street).toBe('Αγγελάκη');
      expect(result?.city).toBe('Θεσσαλονίκη');
    });

    it('returns first element when no headquarters type', () => {
      const contact = makeContact({
        customFields: {
          companyAddresses: [
            { type: 'branch', street: 'FirstBranch', number: '1', city: 'Αθήνα', postalCode: '10001' },
            { type: 'warehouse', street: 'WH', number: '2', city: 'Πειραιάς', postalCode: '18500' },
          ],
        },
      });
      const result = extractHeadquartersAddress(contact);
      expect(result?.street).toBe('FirstBranch');
      expect(result?.city).toBe('Αθήνα');
    });

    it('preserves settlementId when present', () => {
      const contact = makeContact({
        customFields: {
          companyAddresses: [
            {
              type: 'headquarters',
              street: 'Αγγελάκη', number: '5',
              city: 'Θεσσαλονίκη', postalCode: '54621',
              settlementId: 'settlement_001',
            },
          ],
        },
      });
      const result = extractHeadquartersAddress(contact);
      expect(result?.settlementId).toBe('settlement_001');
    });

    it('sets settlementId to undefined when absent (not coerced to null)', () => {
      const contact = makeContact({
        customFields: {
          companyAddresses: [
            { type: 'headquarters', street: 'A', number: '1', city: 'B', postalCode: '12345' },
          ],
        },
      });
      const result = extractHeadquartersAddress(contact);
      expect(result?.settlementId).toBeUndefined();
    });
  });

  describe('fallback to contact.addresses', () => {
    it('returns first addresses[0] when companyAddresses is empty', () => {
      const contact = makeContact({
        customFields: { companyAddresses: [] },
        addresses: [{ ...ADDR_BASE, street: 'FallbackStreet', number: '99' }],
      });
      const result = extractHeadquartersAddress(contact);
      expect(result?.street).toBe('FallbackStreet');
      expect(result?.number).toBe('99');
    });

    it('returns first addresses[0] when companyAddresses is absent', () => {
      const contact = makeContact({
        addresses: [{ ...ADDR_BASE, street: 'NoCustom', city: 'Λάρισα' }],
      });
      const result = extractHeadquartersAddress(contact);
      expect(result?.street).toBe('NoCustom');
      expect(result?.city).toBe('Λάρισα');
    });

    it('returns null when both companyAddresses and addresses are absent', () => {
      const contact = makeContact({});
      expect(extractHeadquartersAddress(contact)).toBeNull();
    });

    it('returns null when addresses is empty', () => {
      const contact = makeContact({ addresses: [] });
      expect(extractHeadquartersAddress(contact)).toBeNull();
    });

    it('snapshot from addresses does NOT include settlementId key', () => {
      const contact = makeContact({
        addresses: [{ ...ADDR_BASE }],
      });
      const result = extractHeadquartersAddress(contact);
      expect(result).not.toHaveProperty('settlementId');
    });
  });
});

// ─── hasHQAddressChanged ──────────────────────────────────────────────────────

describe('hasHQAddressChanged', () => {
  const base: CompanyAddressSnapshot = {
    street: 'Αγγελάκη', number: '5',
    postalCode: '54621', city: 'Θεσσαλονίκη',
  };

  it('returns false when both are null', () => {
    expect(hasHQAddressChanged(null, null)).toBe(false);
  });

  it('returns true when old is null, new is not', () => {
    expect(hasHQAddressChanged(null, base)).toBe(true);
  });

  it('returns true when new is null, old is not', () => {
    expect(hasHQAddressChanged(base, null)).toBe(true);
  });

  it('returns false when both snapshots are identical', () => {
    expect(hasHQAddressChanged(base, { ...base })).toBe(false);
  });

  it('returns true when street differs', () => {
    expect(hasHQAddressChanged(base, { ...base, street: 'Εγνατίας' })).toBe(true);
  });

  it('returns true when number differs', () => {
    expect(hasHQAddressChanged(base, { ...base, number: '10' })).toBe(true);
  });

  it('returns true when postalCode differs', () => {
    expect(hasHQAddressChanged(base, { ...base, postalCode: '54630' })).toBe(true);
  });

  it('returns true when city differs', () => {
    expect(hasHQAddressChanged(base, { ...base, city: 'Αθήνα' })).toBe(true);
  });

  it('returns true when settlementId differs (undefined vs string)', () => {
    expect(
      hasHQAddressChanged(
        { ...base, settlementId: undefined },
        { ...base, settlementId: 'sett_001' },
      ),
    ).toBe(true);
  });

  it('returns true when settlementId differs (null vs string)', () => {
    expect(
      hasHQAddressChanged(
        { ...base, settlementId: null },
        { ...base, settlementId: 'sett_001' },
      ),
    ).toBe(true);
  });

  it('returns false when settlementId is the same non-null value', () => {
    expect(
      hasHQAddressChanged(
        { ...base, settlementId: 'sett_001' },
        { ...base, settlementId: 'sett_001' },
      ),
    ).toBe(false);
  });

  describe('regression guards', () => {
    it('always returns boolean — never undefined', () => {
      expect(typeof hasHQAddressChanged(null, null)).toBe('boolean');
      expect(typeof hasHQAddressChanged(base, base)).toBe('boolean');
      expect(typeof hasHQAddressChanged(null, base)).toBe('boolean');
    });

    it('is symmetric: swap order yields same truthy result', () => {
      const changed = { ...base, city: 'Αθήνα' };
      expect(hasHQAddressChanged(base, changed)).toBe(
        hasHQAddressChanged(changed, base),
      );
    });
  });
});
