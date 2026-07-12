/**
 * @jest-environment jsdom
 *
 * Tests — ADR-510 Φ2E #4: upsertUserLinetype (copy-on-write pattern editing).
 *
 * Covers the registry invariants the inline «Τμήματα Μοτίβου» editor relies on:
 *   - create a new per-line owned linetype (first edit)
 *   - update it IN PLACE, preserving id/origin (subsequent edits)
 *   - NEVER mutate a shared ISO baseline (immutability → returns null)
 *   - the READ derivation (name → def → segments) round-trips
 *   - deterministic per-line naming
 *
 * jsdom for a real `localStorage` (persistence runs at registry mutation time).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  resolveLinetype,
  registerUserLinetype,
  upsertUserLinetype,
  __resetLinetypeRegistryForTesting,
} from '../LinetypeRegistry';
import { resolveLinetypeDef } from '../../rendering/linetype-dash-resolver';
import {
  linePatternName,
  dashPatternToSegments,
  segmentsToComplex,
} from '../../config/line-pattern-segments';

const LS_KEY = 'dxf:custom-linetypes';

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
  localStorage.clear();
});

describe('upsertUserLinetype — create', () => {
  it('creates a new user-created linetype when the name is free', () => {
    const def = upsertUserLinetype('LTP-abc', [5, -2], '▬ ▬');
    expect(def).not.toBeNull();
    expect(def?.origin).toBe('user-created');
    expect(def?.pattern).toEqual([5, -2]);
    expect(resolveLinetype('LTP-abc')?.pattern).toEqual([5, -2]);
  });

  it('persists the created entry to localStorage', () => {
    upsertUserLinetype('LTP-persist', [0, -3], '· · ·');
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) as string);
    expect(parsed).toEqual([{ name: 'LTP-persist', description: '· · ·', pattern: [0, -3] }]);
  });
});

describe('upsertUserLinetype — update in place', () => {
  it('replaces pattern + description but preserves id/origin on re-upsert', () => {
    const first = upsertUserLinetype('LTP-x', [5, -2], 'a');
    const second = upsertUserLinetype('LTP-x', [8, -3, 0], 'b');
    expect(second?.id).toBe(first?.id); // stable id → no registry bloat per edit
    expect(second?.origin).toBe('user-created');
    expect(resolveLinetype('LTP-x')?.pattern).toEqual([8, -3, 0]);
    expect(resolveLinetype('LTP-x')?.description).toBe('b');
  });

  it('also updates an entry originally made by registerUserLinetype', () => {
    registerUserLinetype('LTP-y', [1, -1]);
    upsertUserLinetype('LTP-y', [9, -9]);
    expect(resolveLinetype('LTP-y')?.pattern).toEqual([9, -9]);
  });
});

describe('upsertUserLinetype — complex preservation (ADR-642 Edit-in-place)', () => {
  const complexSegments = [
    { kind: 'dash', lengthMm: 5 },
    { kind: 'gap', lengthMm: 2 },
    {
      kind: 'symbol' as const,
      glyphId: 'cross',
      role: 'side' as const,
      scale: 1,
      rotationDeg: 0,
      offsetXMm: 0,
      offsetYMm: 0,
    },
  ];

  it('carries the complex def when CREATING via upsert (free name → register path)', () => {
    const complex = segmentsToComplex('GAS', complexSegments, '▬ ✳');
    const def = upsertUserLinetype('GAS', [5, -2], '▬ ✳', complex);
    expect(def?.complex).toBeDefined();
    expect(def?.complex?.layers[0].elements.some((el) => el.kind === 'symbol')).toBe(true);
    expect(resolveLinetype('GAS')?.complex).toEqual(complex);
  });

  it('does NOT flatten the complex when EDITING in place (existing name → replace path)', () => {
    const complex = segmentsToComplex('GAS', complexSegments, '▬ ✳');
    upsertUserLinetype('GAS', [5, -2], '▬ ✳', complex);
    // Re-upsert the same name with the complex def (the in-place edit path the dialog drives).
    const edited = upsertUserLinetype('GAS', [5, -2], '▬ ✳', complex);
    expect(edited?.complex?.layers[0].elements.some((el) => el.kind === 'symbol')).toBe(true);
    expect(resolveLinetype('GAS')?.complex).toEqual(complex);
  });

  it('leaves complex undefined for a simple in-place edit (backward-safe)', () => {
    upsertUserLinetype('LTP-simple', [5, -2], '▬ ▬');
    const edited = upsertUserLinetype('LTP-simple', [8, -3], '▬ ▬');
    expect(edited?.complex).toBeUndefined();
  });
});

describe('upsertUserLinetype — ISO immutability (COW safety)', () => {
  it('refuses to overwrite a shared ISO baseline and leaves it untouched', () => {
    const original = resolveLinetype('Dashed')?.pattern;
    expect(original).toBeDefined();
    const result = upsertUserLinetype('Dashed', [999, -999]);
    expect(result).toBeNull();
    expect(resolveLinetype('Dashed')?.pattern).toEqual(original);
  });
});

describe('linePatternName', () => {
  it('is deterministic + ASCII per entity id', () => {
    expect(linePatternName('ent_42')).toBe('LTP-ent_42');
    expect(linePatternName('ent_42')).toBe(linePatternName('ent_42'));
    expect(linePatternName('ent_7')).not.toBe(linePatternName('ent_8'));
  });
});

describe('COW read derivation (name → def → segments)', () => {
  it('round-trips an owned pattern back into editable segments', () => {
    const name = linePatternName('ent_read');
    upsertUserLinetype(name, [5, -2, 0]);
    const pattern = resolveLinetypeDef(name)?.pattern ?? [];
    expect(dashPatternToSegments(pattern)).toEqual([
      { kind: 'dash', lengthMm: 5 },
      { kind: 'gap', lengthMm: 2 },
      { kind: 'dot', lengthMm: 0 },
    ]);
  });
});
