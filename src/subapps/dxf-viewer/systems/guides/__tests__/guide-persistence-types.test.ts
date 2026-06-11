/**
 * ADR-441 Slice 1 — Grid persistence serialization tests (pure, no mocks).
 *
 * Verifies guide↔snapshot round-trip, temporary-guide exclusion, undefined-key
 * omission (Firestore-safety).
 */

import {
  guideToSnapshot,
  guidesToSnapshots,
  snapshotToGuide,
} from '../guide-persistence-types';
import type { Guide } from '../guide-types';

const xGuide: Guide = {
  id: 'guide_X_001',
  axis: 'X',
  offset: 4000,
  label: 'A',
  style: null,
  visible: true,
  locked: false,
  createdAt: '2026-06-11T00:00:00.000Z',
  parentId: null,
  groupId: null,
};

const diagonalGuide: Guide = {
  ...xGuide,
  id: 'guide_XZ_001',
  axis: 'XZ',
  offset: 0,
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 1000, y: 500 },
};

describe('guideToSnapshot', () => {
  it('serializes an axis-aligned guide without start/end keys', () => {
    const snap = guideToSnapshot(xGuide);
    expect(snap).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(snap, 'startPoint')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(snap, 'endPoint')).toBe(false);
    expect(snap).toMatchObject({ id: 'guide_X_001', axis: 'X', offset: 4000, label: 'A' });
  });

  it('keeps start/end for diagonal (XZ) guides', () => {
    const snap = guideToSnapshot(diagonalGuide);
    expect(snap?.startPoint).toEqual({ x: 0, y: 0 });
    expect(snap?.endPoint).toEqual({ x: 1000, y: 500 });
  });

  it('returns null for temporary guides (not persisted)', () => {
    expect(guideToSnapshot({ ...xGuide, temporary: true })).toBeNull();
  });

  it('never emits an undefined value (Firestore-safe)', () => {
    const snap = guideToSnapshot(xGuide)!;
    for (const v of Object.values(snap)) expect(v).not.toBeUndefined();
  });
});

describe('guidesToSnapshots', () => {
  it('filters out temporary guides', () => {
    const result = guidesToSnapshots([xGuide, { ...xGuide, id: 't', temporary: true }, diagonalGuide]);
    expect(result.map((g) => g.id)).toEqual(['guide_X_001', 'guide_XZ_001']);
  });
});

describe('snapshotToGuide round-trip', () => {
  it('reconstructs an axis-aligned guide identically', () => {
    expect(snapshotToGuide(guideToSnapshot(xGuide)!)).toEqual(xGuide);
  });

  it('reconstructs a diagonal guide with endpoints', () => {
    expect(snapshotToGuide(guideToSnapshot(diagonalGuide)!)).toEqual(diagonalGuide);
  });
});
