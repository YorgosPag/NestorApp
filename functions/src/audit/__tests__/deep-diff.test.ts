/**
 * Unit tests for the generic CDC deep diff.
 *
 * These tests exist specifically to prevent a repeat of the Phase 6 shortName
 * regression: the moment any change silently stops producing a diff for a
 * field that end users care about, one of these tests fails.
 *
 * @module functions/audit/__tests__/deep-diff
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

import { deepDiff } from '../deep-diff';

describe('deepDiff', () => {
  describe('equality semantics', () => {
    it('returns an empty array when before and after are identical', () => {
      const doc = { firstName: 'Γιώργος', status: 'active' };
      expect(deepDiff(doc, doc)).toEqual([]);
    });

    it('treats null, undefined and empty string as equivalent', () => {
      const changes = deepDiff(
        { shortName: null, nickname: undefined, phone: '' },
        { shortName: '', nickname: null, phone: undefined },
      );
      expect(changes).toEqual([]);
    });

    it('detects a single leaf change', () => {
      const changes = deepDiff(
        { shortName: 'ΔΟΥ Α' },
        { shortName: 'ΔΟΥ Β' },
      );
      expect(changes).toEqual([
        { field: 'shortName', label: 'shortName', oldValue: 'ΔΟΥ Α', newValue: 'ΔΟΥ Β' },
      ]);
    });
  });

  describe('regression: the Phase 6 shortName bug must never recur', () => {
    it('emits a change for shortName on a public service contact', () => {
      // This is the exact scenario the user reported: editing the short name
      // on a δημόσια υπηρεσία contact. Previously, the service-layer diff
      // excluded shortName via COMPANY_EXCLUSIVE and no audit entry was
      // written. With CDC deep diff there is no exclude list for user fields.
      const before = {
        type: 'service',
        name: 'Δημόσια Οικονομική Υπηρεσία',
        shortName: '',
        companyId: 'c1',
      };
      const after = {
        type: 'service',
        name: 'Δημόσια Οικονομική Υπηρεσία',
        shortName: 'ΔΟΥ',
        companyId: 'c1',
      };

      const changes = deepDiff(before, after);
      const shortNameChange = changes.find((c) => c.field === 'shortName');

      expect(shortNameChange).toBeDefined();
      expect(shortNameChange?.oldValue).toBeNull();
      expect(shortNameChange?.newValue).toBe('ΔΟΥ');
    });
  });

  describe('nested objects', () => {
    it('produces dot-notation paths for nested changes', () => {
      const changes = deepDiff(
        { commercial: { askingPrice: 100, currency: 'EUR' } },
        { commercial: { askingPrice: 150, currency: 'EUR' } },
      );
      expect(changes).toEqual([
        {
          field: 'commercial.askingPrice',
          label: 'commercial.askingPrice',
          oldValue: 100,
          newValue: 150,
        },
      ]);
    });

    it('detects a newly-added nested field', () => {
      const changes = deepDiff(
        { customFields: {} },
        { customFields: { chamber: 'Αθηνών' } },
      );
      expect(changes).toContainEqual({
        field: 'customFields.chamber',
        label: 'customFields.chamber',
        oldValue: null,
        newValue: 'Αθηνών',
      });
    });

    it('detects a removed nested field', () => {
      const changes = deepDiff(
        { customFields: { chamber: 'Αθηνών' } },
        { customFields: {} },
      );
      expect(changes).toContainEqual({
        field: 'customFields.chamber',
        label: 'customFields.chamber',
        oldValue: 'Αθηνών',
        newValue: null,
      });
    });
  });

  describe('arrays and complex values', () => {
    it('treats arrays as opaque leaf values (serialized JSON)', () => {
      const changes = deepDiff(
        { personaTypes: ['owner'] },
        { personaTypes: ['owner', 'tenant'] },
      );
      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('personaTypes');
    });

    it('treats arrays with same elements in same order as equal', () => {
      const changes = deepDiff(
        { tags: ['a', 'b', 'c'] },
        { tags: ['a', 'b', 'c'] },
      );
      expect(changes).toEqual([]);
    });
  });

  describe('ignored fields', () => {
    it('skips system timestamps', () => {
      const changes = deepDiff(
        { firstName: 'Γιώργος', updatedAt: { _seconds: 1, _nanoseconds: 0 } },
        { firstName: 'Γιώργος', updatedAt: { _seconds: 2, _nanoseconds: 0 } },
      );
      expect(changes).toEqual([]);
    });

    it('skips the performer metadata fields themselves', () => {
      const changes = deepDiff(
        { status: 'active', _lastModifiedBy: 'user1', _lastModifiedByName: 'Alice' },
        { status: 'active', _lastModifiedBy: 'user2', _lastModifiedByName: 'Bob' },
      );
      expect(changes).toEqual([]);
    });

    it('skips search index metadata', () => {
      const changes = deepDiff(
        { displayName: 'A', searchTokens: ['a'], searchKeywords: ['a'] },
        { displayName: 'A', searchTokens: ['a', 'aa'], searchKeywords: ['a', 'aa'] },
      );
      expect(changes).toEqual([]);
    });

    it('still reports user-field changes when only system fields also moved', () => {
      const changes = deepDiff(
        { displayName: 'Old', updatedAt: { _seconds: 1, _nanoseconds: 0 } },
        { displayName: 'New', updatedAt: { _seconds: 2, _nanoseconds: 0 } },
      );
      expect(changes).toEqual([
        { field: 'displayName', label: 'displayName', oldValue: 'Old', newValue: 'New' },
      ]);
    });
  });

  describe('deterministic output', () => {
    it('sorts changes alphabetically by field path', () => {
      const changes = deepDiff(
        { c: 1, a: 1, b: 1 },
        { c: 2, a: 2, b: 2 },
      );
      expect(changes.map((c) => c.field)).toEqual(['a', 'b', 'c']);
    });
  });
});
