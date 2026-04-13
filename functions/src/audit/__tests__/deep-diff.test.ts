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
    it('emits a single collection "added" entry for appended primitives', () => {
      const changes = deepDiff(
        { personaTypes: ['owner'] },
        { personaTypes: ['owner', 'tenant'] },
      );
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        field: 'personaTypes',
        kind: 'collection',
        op: 'added',
        itemKey: 's:tenant',
        itemLabel: 'tenant',
      });
    });

    it('treats arrays with same elements in same order as equal', () => {
      const changes = deepDiff(
        { tags: ['a', 'b', 'c'] },
        { tags: ['a', 'b', 'c'] },
      );
      expect(changes).toEqual([]);
    });
  });

  describe('collection-aware diff (ADR-195 Phase 11)', () => {
    it('emits `added` for a new address with stable id', () => {
      const before = { addresses: [{ id: '1', type: 'site', street: 'Σαμοθράκης' }] };
      const after = {
        addresses: [
          { id: '1', type: 'site', street: 'Σαμοθράκης' },
          { id: '2', type: 'entrance', street: 'Παραδόσεων' },
        ],
      };
      const changes = deepDiff(before, after);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        field: 'addresses',
        kind: 'collection',
        op: 'added',
        itemKey: 'k:2',
        itemLabel: 'Παραδόσεων — entrance',
        oldValue: null,
        newValue: null,
      });
    });

    it('emits `removed` for a deleted address', () => {
      const before = {
        addresses: [
          { id: '1', type: 'site', street: 'Σαμοθράκης' },
          { id: '2', type: 'entrance', street: 'Παραδόσεων' },
        ],
      };
      const after = { addresses: [{ id: '1', type: 'site', street: 'Σαμοθράκης' }] };
      const changes = deepDiff(before, after);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        op: 'removed',
        itemKey: 'k:2',
      });
    });

    it('emits `modified` with granular subChanges', () => {
      const before = {
        addresses: [{ id: '1', type: 'site', street: 'Σαμοθράκης', number: '16' }],
      };
      const after = {
        addresses: [{ id: '1', type: 'site', street: 'Παραδόσεων', number: '16' }],
      };
      const changes = deepDiff(before, after);
      expect(changes).toHaveLength(1);
      expect(changes[0].op).toBe('modified');
      expect(changes[0].itemKey).toBe('k:1');
      expect(changes[0].subChanges).toContainEqual({
        subField: 'street',
        oldValue: 'Σαμοθράκης',
        newValue: 'Παραδόσεων',
      });
    });

    it('distinguishes phones by number (no stable id)', () => {
      const before = { phones: [{ number: '2101111111', type: 'home' }] };
      const after = {
        phones: [
          { number: '2101111111', type: 'home' },
          { number: '2109999999', type: 'home' },
        ],
      };
      const changes = deepDiff(before, after);
      expect(changes).toHaveLength(1);
      expect(changes[0].op).toBe('added');
      expect(changes[0].itemLabel).toContain('2109999999');
    });

    it('handles mixed add/remove/modify in one diff', () => {
      const before = {
        addresses: [
          { id: '1', type: 'site', street: 'Α' },
          { id: '2', type: 'entrance', street: 'Β' },
          { id: '3', type: 'delivery', street: 'Γ' },
        ],
      };
      const after = {
        addresses: [
          { id: '1', type: 'site', street: 'Α-NEW' },
          { id: '3', type: 'delivery', street: 'Γ' },
          { id: '4', type: 'legal', street: 'Δ' },
        ],
      };
      const changes = deepDiff(before, after);
      expect(changes).toHaveLength(3);
      const ops = changes.map((c) => c.op).sort();
      expect(ops).toEqual(['added', 'modified', 'removed']);
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
