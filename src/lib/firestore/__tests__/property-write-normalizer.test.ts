/**
 * Tests for the property write-time SSoT normalizer.
 * @see src/lib/firestore/property-write-normalizer.ts
 */

import { normalizePropertyWritePayload } from '../property-write-normalizer';
import type { PropertyLevel } from '@/types/property';

const LEVELS: PropertyLevel[] = [
  { floorId: 'flr_a', floorNumber: 0, name: 'Ισόγειο', isPrimary: true },
  { floorId: 'flr_b', floorNumber: 1, name: '1ος', isPrimary: false },
];

describe('normalizePropertyWritePayload · status mirror', () => {
  it('defaults a created unit to unavailable and mirrors legacy status', () => {
    const payload: Record<string, unknown> = { name: 'A' };
    normalizePropertyWritePayload(payload, { mode: 'create' });
    expect(payload.commercialStatus).toBe('unavailable');
    expect(payload.status).toBe('unavailable');
  });

  it('mirrors legacy status from an explicit commercialStatus on create', () => {
    const payload: Record<string, unknown> = { commercialStatus: 'for-sale' };
    normalizePropertyWritePayload(payload, { mode: 'create' });
    expect(payload.status).toBe('for-sale');
  });

  it('mirrors legacy status when commercialStatus changes on update', () => {
    const payload: Record<string, unknown> = { commercialStatus: 'reserved' };
    normalizePropertyWritePayload(payload, { mode: 'update', existing: {} });
    expect(payload.status).toBe('reserved');
  });

  it('reverse-heals the SSoT commercialStatus from a legacy-only `status` write', () => {
    // Older flows (e.g. bulk mark-as-sold) set legacy `status` without commercialStatus.
    const payload: Record<string, unknown> = { status: 'sold', soldTo: 'cont_x' };
    normalizePropertyWritePayload(payload, {
      mode: 'update',
      existing: { commercialStatus: 'for-sale', status: 'for-sale' },
    });
    expect(payload.commercialStatus).toBe('sold');
    expect(payload.status).toBe('sold');
  });

  it('leaves legacy status untouched on an update without a status change', () => {
    const payload: Record<string, unknown> = { name: 'renamed' };
    normalizePropertyWritePayload(payload, {
      mode: 'update',
      existing: { commercialStatus: 'sold', status: 'sold' },
    });
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('commercialStatus');
  });
});

describe('normalizePropertyWritePayload · multi-level seed', () => {
  it('seeds levelData for all levels WITHOUT clobbering provided totals (create)', () => {
    const payload: Record<string, unknown> = {
      levels: LEVELS,
      areas: { gross: 130 },
      area: 130,
    };
    normalizePropertyWritePayload(payload, { mode: 'create' });
    const levelData = payload.levelData as Record<string, unknown>;
    expect(Object.keys(levelData).sort()).toEqual(['flr_a', 'flr_b']);
    // No per-level content → must NOT zero-out the user's unit-level totals.
    expect((payload.areas as { gross: number }).gross).toBe(130);
  });

  it('aggregates + derives flat area when per-level content exists', () => {
    const payload: Record<string, unknown> = {
      levels: LEVELS,
      levelData: {
        flr_a: { areas: { gross: 90 } },
        flr_b: {}, // empty → seeded, contributes 0
      },
    };
    normalizePropertyWritePayload(payload, { mode: 'update', existing: {} });
    expect((payload.areas as { gross: number }).gross).toBe(90);
    expect(payload.area).toBe(90); // legacy flat field derived from areas.gross
  });

  it('is a no-op for single-level units', () => {
    const payload: Record<string, unknown> = { floorId: 'flr_a' };
    normalizePropertyWritePayload(payload, { mode: 'create' });
    expect(payload).not.toHaveProperty('levelData');
  });
});

describe('normalizePropertyWritePayload · legacy flat-area derivation', () => {
  it('mirrors legacy area from areas.gross (fixes area:0 drift)', () => {
    const payload: Record<string, unknown> = { areas: { gross: 130 }, area: 0 };
    normalizePropertyWritePayload(payload, { mode: 'update', existing: {} });
    expect(payload.area).toBe(130);
  });

  it('does not override area when areas.gross is missing or zero', () => {
    const payload: Record<string, unknown> = { area: 75 };
    normalizePropertyWritePayload(payload, { mode: 'update', existing: {} });
    expect(payload.area).toBe(75);
  });
});
