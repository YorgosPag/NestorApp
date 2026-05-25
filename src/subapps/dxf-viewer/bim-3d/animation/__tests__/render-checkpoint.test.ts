/**
 * ADR-366 §C.1.c — render-checkpoint round-trip tests.
 */

import { describe, expect, it } from 'vitest';
import {
  deserializeCheckpoint,
  resumeFrameIndex,
  serializeCheckpoint,
} from '../render-checkpoint';
import type { RenderJobDoc } from '../animation-types';
import type { Timestamp } from 'firebase/firestore';

const TS = { seconds: 0, nanoseconds: 0 } as unknown as Timestamp;

function makeJob(partial: Partial<RenderJobDoc>): RenderJobDoc {
  return {
    id: 'rnj_bim_test',
    animationId: 'anm_bim_test',
    companyId: 'co_test',
    status: 'queued',
    progress: 0,
    createdAt: TS,
    updatedAt: TS,
    ...partial,
  };
}

describe('serializeCheckpoint', () => {
  it('packs both fields into the patch shape', () => {
    expect(serializeCheckpoint({ lastFrameIndex: 42, lastWaypointIndex: 3 })).toEqual({
      lastSampleCount: 42,
      lastWaypointIndex: 3,
    });
  });

  it('clamps negative values to zero', () => {
    expect(serializeCheckpoint({ lastFrameIndex: -5, lastWaypointIndex: -2 })).toEqual({
      lastSampleCount: 0,
      lastWaypointIndex: 0,
    });
  });

  it('floors fractional values (frame index must be integer)', () => {
    expect(serializeCheckpoint({ lastFrameIndex: 7.9, lastWaypointIndex: 1.3 })).toEqual({
      lastSampleCount: 7,
      lastWaypointIndex: 1,
    });
  });
});

describe('deserializeCheckpoint', () => {
  it('returns null when no checkpoint fields present', () => {
    const job = makeJob({});
    expect(deserializeCheckpoint(job)).toBeNull();
  });

  it('extracts a checkpoint when fields present', () => {
    const job = makeJob({ lastSampleCount: 120, lastWaypointIndex: 5 });
    expect(deserializeCheckpoint(job)).toEqual({
      lastFrameIndex: 120,
      lastWaypointIndex: 5,
    });
  });

  it('defaults missing single field to zero when the other is set', () => {
    const job = makeJob({ lastSampleCount: 10 });
    expect(deserializeCheckpoint(job)).toEqual({
      lastFrameIndex: 10,
      lastWaypointIndex: 0,
    });
  });

  it('round-trips a serialized checkpoint', () => {
    const original = { lastFrameIndex: 88, lastWaypointIndex: 2 };
    const patch = serializeCheckpoint(original);
    const job = makeJob({
      lastSampleCount: patch.lastSampleCount,
      lastWaypointIndex: patch.lastWaypointIndex,
    });
    expect(deserializeCheckpoint(job)).toEqual(original);
  });
});

describe('resumeFrameIndex', () => {
  it('returns 0 for fresh job without checkpoint', () => {
    expect(resumeFrameIndex(makeJob({}))).toBe(0);
  });

  it('returns checkpointed frame index for resumable job', () => {
    expect(
      resumeFrameIndex(makeJob({ lastSampleCount: 47, lastWaypointIndex: 1 })),
    ).toBe(47);
  });
});
