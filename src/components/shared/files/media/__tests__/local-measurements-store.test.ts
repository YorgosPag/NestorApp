/**
 * Unit tests — local-measurements-store (ephemeral scratch layer).
 *
 * Covers the two things the transient-measure accumulation feature relies on:
 * accumulation (commit piles up, immutable + stable snapshots) and clear-all
 * (wipe + clearToken bump), plus per-floorplan scoping isolation.
 */

import {
  subscribeLocalMeasurements,
  getLocalMeasurements,
  getClearToken,
  commitLocalMeasurement,
  clearLocalMeasurements,
  __resetLocalMeasurementsForTest,
  type LocalMeasurement,
} from '../local-measurements-store';

const SAMPLE: Omit<LocalMeasurement, 'id'> = {
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  mode: 'distance',
  value: 10,
  unit: 'm',
};

describe('local-measurements-store', () => {
  beforeEach(() => __resetLocalMeasurementsForTest());

  it('starts empty with a stable EMPTY snapshot reference', () => {
    expect(getLocalMeasurements('a')).toHaveLength(0);
    expect(getLocalMeasurements('a')).toBe(getLocalMeasurements('b')); // same frozen EMPTY
    expect(getClearToken('a')).toBe(0);
  });

  it('accumulates measurements and notifies subscribers', () => {
    const listener = jest.fn();
    const unsub = subscribeLocalMeasurements(listener);

    commitLocalMeasurement('a', SAMPLE);
    commitLocalMeasurement('a', { ...SAMPLE, mode: 'area', value: 25, unit: 'm²' });

    expect(getLocalMeasurements('a')).toHaveLength(2);
    expect(getLocalMeasurements('a')[0].mode).toBe('distance');
    expect(getLocalMeasurements('a')[1].mode).toBe('area');
    expect(listener).toHaveBeenCalledTimes(2);
    unsub();
  });

  it('assigns unique local ids and copies the points array (no aliasing)', () => {
    const pts = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
    commitLocalMeasurement('a', { ...SAMPLE, points: pts });
    commitLocalMeasurement('a', SAMPLE);
    const list = getLocalMeasurements('a');
    expect(list[0].id).not.toBe(list[1].id);
    expect(list[0].points).not.toBe(pts); // defensive copy
    pts.push({ x: 9, y: 9 });
    expect(list[0].points).toHaveLength(2); // mutation of source does not leak in
  });

  it('produces a NEW array reference on commit (immutable update)', () => {
    const before = getLocalMeasurements('a');
    commitLocalMeasurement('a', SAMPLE);
    expect(getLocalMeasurements('a')).not.toBe(before);
  });

  it('clearAll wipes the scope and bumps the clear token', () => {
    commitLocalMeasurement('a', SAMPLE);
    commitLocalMeasurement('a', SAMPLE);
    expect(getLocalMeasurements('a')).toHaveLength(2);

    clearLocalMeasurements('a');
    expect(getLocalMeasurements('a')).toHaveLength(0);
    expect(getClearToken('a')).toBe(1);

    clearLocalMeasurements('a');
    expect(getClearToken('a')).toBe(2); // token bumps even when already empty
  });

  it('scopes measurements per floorplan key (no bleed)', () => {
    commitLocalMeasurement('floor-A', SAMPLE);
    expect(getLocalMeasurements('floor-A')).toHaveLength(1);
    expect(getLocalMeasurements('floor-B')).toHaveLength(0);

    clearLocalMeasurements('floor-A');
    commitLocalMeasurement('floor-B', SAMPLE);
    expect(getLocalMeasurements('floor-A')).toHaveLength(0);
    expect(getLocalMeasurements('floor-B')).toHaveLength(1);
  });

  it('treats null / empty key as one shared default scope', () => {
    commitLocalMeasurement(null, SAMPLE);
    expect(getLocalMeasurements(undefined)).toHaveLength(1);
    expect(getLocalMeasurements('')).toHaveLength(1);
  });
});
