/**
 * Unit tests for the ADR-319 contact address type taxonomy (SSoT).
 *
 * These tests lock the scope-filtering contracts so future additions
 * to CONTACT_ADDRESS_TYPE_METADATA don't silently expose wrong types
 * to individual / company / service contact forms.
 *
 * Regression trigger: the 2026-04-23 public-service taxonomy addition
 * (central_service, regional_service, annex, department) — without
 * these tests a company contact could incorrectly see service-only keys.
 *
 * @module types/contacts/__tests__/address-types
 * @see ADR-319 Contact Address Type Registry
 */

import {
  CONTACT_ADDRESS_TYPE_METADATA,
  CONTACT_ADDRESS_TYPES,
  getAddressTypesForContact,
  getDefaultSecondaryAddressType,
  getPrimaryAddressType,
  isValidContactAddressType,
} from '../address-types';

// ─── getAddressTypesForContact ────────────────────────────────────────────────

describe('getAddressTypesForContact', () => {
  describe('individual scope', () => {
    it('includes home', () => {
      expect(getAddressTypesForContact('individual')).toContain('home');
    });

    it('includes vacation', () => {
      expect(getAddressTypesForContact('individual')).toContain('vacation');
    });

    it('includes office', () => {
      expect(getAddressTypesForContact('individual')).toContain('office');
    });

    it('includes other', () => {
      expect(getAddressTypesForContact('individual')).toContain('other');
    });

    it('does NOT include headquarters', () => {
      expect(getAddressTypesForContact('individual')).not.toContain('headquarters');
    });

    it('does NOT include central_service', () => {
      expect(getAddressTypesForContact('individual')).not.toContain('central_service');
    });

    it('does NOT include regional_service', () => {
      expect(getAddressTypesForContact('individual')).not.toContain('regional_service');
    });
  });

  describe('company scope', () => {
    it('includes headquarters', () => {
      expect(getAddressTypesForContact('company')).toContain('headquarters');
    });

    it('includes branch', () => {
      expect(getAddressTypesForContact('company')).toContain('branch');
    });

    it('includes warehouse', () => {
      expect(getAddressTypesForContact('company')).toContain('warehouse');
    });

    it('includes showroom', () => {
      expect(getAddressTypesForContact('company')).toContain('showroom');
    });

    it('includes factory', () => {
      expect(getAddressTypesForContact('company')).toContain('factory');
    });

    it('includes department', () => {
      expect(getAddressTypesForContact('company')).toContain('department');
    });

    it('does NOT include home', () => {
      expect(getAddressTypesForContact('company')).not.toContain('home');
    });

    it('does NOT include vacation', () => {
      expect(getAddressTypesForContact('company')).not.toContain('vacation');
    });

    it('does NOT include central_service', () => {
      expect(getAddressTypesForContact('company')).not.toContain('central_service');
    });

    it('does NOT include regional_service', () => {
      expect(getAddressTypesForContact('company')).not.toContain('regional_service');
    });
  });

  describe('service scope', () => {
    it('includes central_service', () => {
      expect(getAddressTypesForContact('service')).toContain('central_service');
    });

    it('includes regional_service', () => {
      expect(getAddressTypesForContact('service')).toContain('regional_service');
    });

    it('includes annex', () => {
      expect(getAddressTypesForContact('service')).toContain('annex');
    });

    it('includes department', () => {
      expect(getAddressTypesForContact('service')).toContain('department');
    });

    it('does NOT include headquarters', () => {
      expect(getAddressTypesForContact('service')).not.toContain('headquarters');
    });

    it('does NOT include warehouse', () => {
      expect(getAddressTypesForContact('service')).not.toContain('warehouse');
    });

    it('does NOT include showroom', () => {
      expect(getAddressTypesForContact('service')).not.toContain('showroom');
    });

    it('does NOT include factory', () => {
      expect(getAddressTypesForContact('service')).not.toContain('factory');
    });

    it('does NOT include branch', () => {
      expect(getAddressTypesForContact('service')).not.toContain('branch');
    });
  });

  describe('undefined contactType — fallback to individual', () => {
    it('returns same result as individual', () => {
      expect(getAddressTypesForContact(undefined)).toEqual(
        getAddressTypesForContact('individual'),
      );
    });

    it('includes home', () => {
      expect(getAddressTypesForContact(undefined)).toContain('home');
    });

    it('does NOT include headquarters', () => {
      expect(getAddressTypesForContact(undefined)).not.toContain('headquarters');
    });
  });
});

// ─── getPrimaryAddressType ────────────────────────────────────────────────────

describe('getPrimaryAddressType', () => {
  it('returns home for individual', () => {
    expect(getPrimaryAddressType('individual')).toBe('home');
  });

  it('returns headquarters for company', () => {
    expect(getPrimaryAddressType('company')).toBe('headquarters');
  });

  it('returns central_service for service', () => {
    expect(getPrimaryAddressType('service')).toBe('central_service');
  });

  it('returns home when contactType is undefined (individual fallback)', () => {
    expect(getPrimaryAddressType(undefined)).toBe('home');
  });
});

// ─── getDefaultSecondaryAddressType ──────────────────────────────────────────

describe('getDefaultSecondaryAddressType', () => {
  it('returns office for individual', () => {
    expect(getDefaultSecondaryAddressType('individual')).toBe('office');
  });

  it('returns branch for company', () => {
    expect(getDefaultSecondaryAddressType('company')).toBe('branch');
  });

  it('returns regional_service for service', () => {
    expect(getDefaultSecondaryAddressType('service')).toBe('regional_service');
  });

  it('returns office when contactType is undefined (individual fallback)', () => {
    expect(getDefaultSecondaryAddressType(undefined)).toBe('office');
  });
});

// ─── isValidContactAddressType ────────────────────────────────────────────────

describe('isValidContactAddressType', () => {
  it('accepts known type: home', () => {
    expect(isValidContactAddressType('home')).toBe(true);
  });

  it('accepts known type: headquarters', () => {
    expect(isValidContactAddressType('headquarters')).toBe(true);
  });

  it('accepts known type: central_service', () => {
    expect(isValidContactAddressType('central_service')).toBe(true);
  });

  it('accepts known type: other', () => {
    expect(isValidContactAddressType('other')).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidContactAddressType(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidContactAddressType(undefined)).toBe(false);
  });

  it('rejects number', () => {
    expect(isValidContactAddressType(42)).toBe(false);
  });

  it('rejects unknown string', () => {
    expect(isValidContactAddressType('residence')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidContactAddressType('')).toBe(false);
  });
});

// ─── CONTACT_ADDRESS_TYPE_METADATA invariants ─────────────────────────────────

describe('CONTACT_ADDRESS_TYPE_METADATA structure invariants', () => {
  it('only "other" has allowsCustomLabel: true', () => {
    const withCustomLabel = CONTACT_ADDRESS_TYPES.filter(
      k => CONTACT_ADDRESS_TYPE_METADATA[k].allowsCustomLabel === true,
    );
    expect(withCustomLabel).toEqual(['other']);
  });

  it('every type has at least one scope entry', () => {
    CONTACT_ADDRESS_TYPES.forEach(k => {
      expect(CONTACT_ADDRESS_TYPE_METADATA[k].scope.length).toBeGreaterThan(0);
    });
  });

  it('primaryFor keys are a subset of scope keys', () => {
    CONTACT_ADDRESS_TYPES.forEach(k => {
      const meta = CONTACT_ADDRESS_TYPE_METADATA[k];
      if (meta.primaryFor) {
        meta.primaryFor.forEach(s => {
          expect(meta.scope).toContain(s);
        });
      }
    });
  });
});

// ─── regression guards ────────────────────────────────────────────────────────

describe('regression guards', () => {
  it('getAddressTypesForContact result is a subset of CONTACT_ADDRESS_TYPES', () => {
    (['individual', 'company', 'service'] as const).forEach(ct => {
      const result = getAddressTypesForContact(ct);
      result.forEach(k => expect(CONTACT_ADDRESS_TYPES).toContain(k));
    });
  });

  it('getPrimaryAddressType always returns a value in CONTACT_ADDRESS_TYPES', () => {
    (['individual', 'company', 'service', undefined] as const).forEach(ct => {
      expect(CONTACT_ADDRESS_TYPES).toContain(getPrimaryAddressType(ct));
    });
  });

  it('getDefaultSecondaryAddressType always returns a value in CONTACT_ADDRESS_TYPES', () => {
    (['individual', 'company', 'service', undefined] as const).forEach(ct => {
      expect(CONTACT_ADDRESS_TYPES).toContain(getDefaultSecondaryAddressType(ct));
    });
  });
});
