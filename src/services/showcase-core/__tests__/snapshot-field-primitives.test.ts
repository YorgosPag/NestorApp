/**
 * Showcase snapshot field primitives (ADR-700).
 *
 * The load-bearing test here is the **picker contract** pair: four surfaces
 * serialise absent values as `null`, the property showcase serialises them by
 * omitting the key. Same-name/different-contract was the trap that kept the
 * two families of pickers from being unified for three ADRs; these assertions
 * exist so a future "cleanup" that collapses them fails loudly instead of
 * silently rewriting every showcase payload.
 */

import type { Firestore } from 'firebase-admin/firestore';
import {
  buildShowcaseIdentityFields,
  buildShowcaseMetricFields,
  createShowcaseRelationLoader,
  formatShowcaseFloorLabel,
  pickShowcaseNumber,
  pickShowcaseNumberOrUndefined,
  pickShowcaseString,
  pickShowcaseStringOrUndefined,
} from '../snapshot-field-primitives';

// ============================================================================
// Test doubles
// ============================================================================

/** Minimal Firestore stub: one collection → id → data (or absent). */
function fakeDb(collections: Record<string, Record<string, unknown>>): Firestore {
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = collections[name]?.[id];
          return {
            exists: data !== undefined,
            data: () => data as Record<string, unknown> | undefined,
          };
        },
      }),
    }),
  } as unknown as Firestore;
}

// ============================================================================
// Picker contracts — the two families must stay distinguishable
// ============================================================================

describe('picker contracts', () => {
  const absent = [undefined, null, '', '   ', 42, {}, []];

  it('null family returns null for every absent-ish input', () => {
    for (const value of absent) {
      expect(pickShowcaseString(value)).toBeNull();
    }
  });

  it('undefined family returns undefined for the same inputs', () => {
    for (const value of absent) {
      expect(pickShowcaseStringOrUndefined(value)).toBeUndefined();
    }
  });

  it('the two families serialise differently — this is the whole point', () => {
    expect(JSON.stringify({ code: pickShowcaseString(undefined) })).toBe('{"code":null}');
    expect(JSON.stringify({ code: pickShowcaseStringOrUndefined(undefined) })).toBe('{}');
  });

  it('both trim and preserve non-empty strings identically', () => {
    expect(pickShowcaseString('  A-1  ')).toBe('A-1');
    expect(pickShowcaseStringOrUndefined('  A-1  ')).toBe('A-1');
  });

  it('number pickers accept finite numbers and reject the rest', () => {
    expect(pickShowcaseNumber(0)).toBe(0);
    expect(pickShowcaseNumberOrUndefined(0)).toBe(0);
    expect(pickShowcaseNumber(-12.5)).toBe(-12.5);

    for (const value of [NaN, Infinity, -Infinity, '5', null, undefined]) {
      expect(pickShowcaseNumber(value)).toBeNull();
      expect(pickShowcaseNumberOrUndefined(value)).toBeUndefined();
    }
  });

  it('does not coerce numeric strings — the typeof guard is load-bearing', () => {
    expect(pickShowcaseNumber('42')).toBeNull();
  });
});

// ============================================================================
// Floor labels — pinned against the pre-ADR-700 parking/storage output
// ============================================================================

describe('formatShowcaseFloorLabel', () => {
  it('formats Greek floors', () => {
    expect(formatShowcaseFloorLabel('0', 'el')).toBe('Ισόγειο');
    expect(formatShowcaseFloorLabel('-1', 'el')).toBe('Υπόγειο');
    expect(formatShowcaseFloorLabel('-2', 'el')).toBe('2ο Υπόγειο');
    expect(formatShowcaseFloorLabel('1', 'el')).toBe('1ος Όροφος');
    expect(formatShowcaseFloorLabel('7', 'el')).toBe('7ος Όροφος');
  });

  it('formats English floors with ordinal suffixes', () => {
    expect(formatShowcaseFloorLabel('0', 'en')).toBe('Ground Floor');
    expect(formatShowcaseFloorLabel('-1', 'en')).toBe('Basement');
    expect(formatShowcaseFloorLabel('1', 'en')).toBe('1st Floor');
    expect(formatShowcaseFloorLabel('2', 'en')).toBe('2nd Floor');
    expect(formatShowcaseFloorLabel('3', 'en')).toBe('3rd Floor');
    expect(formatShowcaseFloorLabel('4', 'en')).toBe('4th Floor');
    expect(formatShowcaseFloorLabel('11', 'en')).toBe('11th Floor');
  });

  it('keeps the inherited "3nd Basement" wording (ADR-700 §8 — known, deferred)', () => {
    expect(formatShowcaseFloorLabel('-3', 'en')).toBe('3nd Basement');
  });

  it('passes free-text floors through trimmed', () => {
    expect(formatShowcaseFloorLabel('  Δώμα  ', 'el')).toBe('Δώμα');
    expect(formatShowcaseFloorLabel('1A', 'en')).toBe('1A');
  });

  it('returns null for absent input', () => {
    expect(formatShowcaseFloorLabel(undefined, 'el')).toBeNull();
    expect(formatShowcaseFloorLabel('   ', 'el')).toBeNull();
  });
});

// ============================================================================
// Field groups
// ============================================================================

describe('buildShowcaseIdentityFields', () => {
  it('maps the identity quartet and preserves key order', () => {
    const fields = buildShowcaseIdentityFields('S-1', {
      code: 'AP-01',
      name: '  Αποθήκη Α  ',
      description: 'desc',
    });
    expect(Object.keys(fields)).toEqual(['id', 'code', 'name', 'description']);
    expect(fields).toEqual({
      id: 'S-1',
      code: 'AP-01',
      name: 'Αποθήκη Α',
      description: 'desc',
    });
  });

  it('falls back to the entity id when name is blank, but not for code', () => {
    const fields = buildShowcaseIdentityFields('S-2', { name: '  ' });
    expect(fields.name).toBe('S-2');
    expect(fields.code).toBeNull();
  });
});

describe('buildShowcaseMetricFields', () => {
  it('maps area/price/floor together', () => {
    expect(buildShowcaseMetricFields({ area: 12.5, price: 9000, floor: '-1' }, 'el')).toEqual({
      area: 12.5,
      price: 9000,
      floor: 'Υπόγειο',
    });
  });

  it('nulls every metric that is absent', () => {
    expect(buildShowcaseMetricFields({}, 'en')).toEqual({
      area: null,
      price: null,
      floor: null,
    });
  });
});

// ============================================================================
// Relation loader
// ============================================================================

describe('createShowcaseRelationLoader', () => {
  const loadBuildingName = createShowcaseRelationLoader({
    foreignKeyField: 'buildingId',
    collection: 'buildings',
    resultKey: 'buildingName',
    nameFields: ['name'],
  });

  const loadProjectName = createShowcaseRelationLoader({
    foreignKeyField: 'projectId',
    collection: 'projects',
    resultKey: 'projectName',
    nameFields: ['name', 'title'],
  });

  it('resolves the related document name', async () => {
    const db = fakeDb({ buildings: { 'B-1': { name: 'Κτήριο Α' } } });
    await expect(loadBuildingName(db, 'S-1', { buildingId: 'B-1' })).resolves.toEqual({
      buildingName: 'Κτήριο Α',
    });
  });

  it('tries nameFields in order — first non-empty wins', async () => {
    const db = fakeDb({ projects: { 'P-1': { name: '  ', title: 'Έργο Τίτλος' } } });
    await expect(loadProjectName(db, 'B-1', { projectId: 'P-1' })).resolves.toEqual({
      projectName: 'Έργο Τίτλος',
    });
  });

  it('degrades to null on a missing foreign key', async () => {
    const db = fakeDb({ buildings: {} });
    await expect(loadBuildingName(db, 'S-1', {})).resolves.toEqual({ buildingName: null });
  });

  it('degrades to null on a dangling reference rather than throwing', async () => {
    const db = fakeDb({ buildings: {} });
    await expect(loadBuildingName(db, 'S-1', { buildingId: 'GONE' })).resolves.toEqual({
      buildingName: null,
    });
  });

  it('degrades to null when the related doc has no usable name', async () => {
    const db = fakeDb({ projects: { 'P-2': { name: '', title: '   ' } } });
    await expect(loadProjectName(db, 'B-1', { projectId: 'P-2' })).resolves.toEqual({
      projectName: null,
    });
  });
});
