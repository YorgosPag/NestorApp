/**
 * Tests for the shared audit diff primitive.
 *
 * Covers the legacy (`Record<string, string>`) signature used by both
 * `EntityAuditService.diffFields` and `computeEntityDiff`. Focus areas:
 *   - null/undefined/empty normalization (no false positives from form defaults)
 *   - dot-notation flattening for nested tracked fields
 *   - sorted-key equivalence for objects (JSON stability)
 *   - partial-update semantics (untouched fields produce no diff)
 *
 * @module lib/audit/__tests__/audit-diff.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  serializeScalar,
  sortKeys,
  flattenForTracking,
  diffTrackedFieldsLegacy,
} from '../audit-diff';

describe('serializeScalar', () => {
  it('returns null for null/undefined/empty string', () => {
    expect(serializeScalar(null)).toBe(null);
    expect(serializeScalar(undefined)).toBe(null);
    expect(serializeScalar('')).toBe(null);
  });

  it('passes through primitives', () => {
    expect(serializeScalar('hello')).toBe('hello');
    expect(serializeScalar(42)).toBe(42);
    expect(serializeScalar(true)).toBe(true);
    expect(serializeScalar(false)).toBe(false);
  });

  it('normalizes empty arrays to null', () => {
    expect(serializeScalar([])).toBe(null);
  });

  it('normalizes empty objects to null', () => {
    expect(serializeScalar({})).toBe(null);
  });

  it('normalizes objects with all-empty values to null (form noise)', () => {
    expect(serializeScalar({ facebook: '', twitter: '', instagram: null })).toBe(null);
  });

  it('serializes non-empty objects deterministically (sorted keys)', () => {
    const a = serializeScalar({ a: 1, b: 2 });
    const b = serializeScalar({ b: 2, a: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":1,"b":2}');
  });

  it('serializes non-empty arrays as JSON', () => {
    expect(serializeScalar(['x', 'y'])).toBe('["x","y"]');
  });
});

describe('sortKeys', () => {
  it('returns primitives unchanged', () => {
    expect(sortKeys(1)).toBe(1);
    expect(sortKeys('x')).toBe('x');
    expect(sortKeys(null)).toBe(null);
  });

  it('sorts object keys recursively', () => {
    const input = { z: { b: 2, a: 1 }, a: 1 };
    const sorted = sortKeys(input) as Record<string, unknown>;
    expect(Object.keys(sorted)).toEqual(['a', 'z']);
    expect(Object.keys(sorted.z as Record<string, unknown>)).toEqual(['a', 'b']);
  });

  it('preserves array order (only sorts inner objects)', () => {
    const input = [{ b: 2, a: 1 }, { d: 4, c: 3 }];
    const sorted = sortKeys(input) as Array<Record<string, unknown>>;
    expect(Object.keys(sorted[0])).toEqual(['a', 'b']);
    expect(Object.keys(sorted[1])).toEqual(['c', 'd']);
  });
});

describe('flattenForTracking', () => {
  it('passes top-level tracked keys through unchanged', () => {
    const tracked = { name: 'Name', status: 'Status' };
    const doc = { name: 'X', status: 'active', untracked: 'ignore' };
    const flat = flattenForTracking(doc, tracked);
    expect(flat.name).toBe('X');
    expect(flat.status).toBe('active');
    expect(flat.untracked).toBe('ignore');
  });

  it('flattens nested objects matching dot-notation tracked keys', () => {
    const tracked = { 'commercial.askingPrice': 'Price' };
    const doc = { commercial: { askingPrice: 100, finalPrice: 90 } };
    const flat = flattenForTracking(doc, tracked);
    expect(flat['commercial.askingPrice']).toBe(100);
    expect(flat['commercial.finalPrice']).toBeUndefined();
  });

  it('does not flatten arrays (treats them as leaf values)', () => {
    const tracked = { tags: 'Tags' };
    const doc = { tags: ['a', 'b'] };
    const flat = flattenForTracking(doc, tracked);
    expect(flat.tags).toEqual(['a', 'b']);
  });
});

describe('diffTrackedFieldsLegacy — scalar fields', () => {
  const tracked = { name: 'Name', status: 'Status' };

  it('returns empty array when nothing changed', () => {
    const old = { name: 'X', status: 'active' };
    const next = { name: 'X', status: 'active' };
    expect(diffTrackedFieldsLegacy(old, next, tracked)).toEqual([]);
  });

  it('returns one change per modified scalar field', () => {
    const old = { name: 'X', status: 'active' };
    const next = { name: 'Y', status: 'active' };
    const changes = diffTrackedFieldsLegacy(old, next, tracked);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ field: 'name', oldValue: 'X', newValue: 'Y', label: 'Name' });
  });

  it('only considers fields present in the new doc (partial updates)', () => {
    const old = { name: 'X', status: 'active' };
    const next = { name: 'Y' };
    const changes = diffTrackedFieldsLegacy(old, next, tracked);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('name');
  });

  it('null → "" produces no change (both normalize to null)', () => {
    const old = { name: null };
    const next = { name: '' };
    expect(diffTrackedFieldsLegacy(old, next, tracked)).toEqual([]);
  });

  it('null → empty array produces no change', () => {
    const tagsTracked = { tags: 'Tags' };
    const old = { tags: null };
    const next = { tags: [] };
    expect(diffTrackedFieldsLegacy(old, next, tagsTracked)).toEqual([]);
  });

  it('null → object with all-empty fields produces no change', () => {
    const smTracked = { socialMedia: 'Social Media' };
    const old = { socialMedia: null };
    const next = { socialMedia: { facebook: '', twitter: '' } };
    expect(diffTrackedFieldsLegacy(old, next, smTracked)).toEqual([]);
  });

  it('detects sorted-key equivalence (key order insensitive)', () => {
    const objTracked = { commercial: 'Commercial' };
    const old = { commercial: { a: 1, b: 2 } };
    const next = { commercial: { b: 2, a: 1 } };
    expect(diffTrackedFieldsLegacy(old, next, objTracked)).toEqual([]);
  });
});

describe('diffTrackedFieldsLegacy — array fields (LEGACY behavior, current bug)', () => {
  // NOTE: These tests document the CURRENT behavior of the legacy diff.
  // The collection-aware engine introduced in a follow-up commit will produce
  // granular added/removed/modified entries instead of a single JSON blob.

  const tracked = { addresses: 'Διευθύνσεις' };

  it('records a single change when an array element is appended', () => {
    const old = { addresses: [{ id: '1', street: 'Α' }] };
    const next = { addresses: [{ id: '1', street: 'Α' }, { id: '2', street: 'Β' }] };
    const changes = diffTrackedFieldsLegacy(old, next, tracked);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('addresses');
    // legacy: monolithic JSON before/after
    expect(typeof changes[0].oldValue).toBe('string');
    expect(typeof changes[0].newValue).toBe('string');
  });
});

describe('diffTrackedFieldsLegacy — dot-notation fields', () => {
  const tracked = {
    'commercial.askingPrice': 'Asking Price',
    'commercial.finalPrice': 'Final Price',
  };

  it('detects changes to nested properties', () => {
    const old = { commercial: { askingPrice: 100, finalPrice: 90 } };
    const next = { commercial: { askingPrice: 110, finalPrice: 90 } };
    const changes = diffTrackedFieldsLegacy(old, next, tracked);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      field: 'commercial.askingPrice',
      oldValue: 100,
      newValue: 110,
    });
  });
});
