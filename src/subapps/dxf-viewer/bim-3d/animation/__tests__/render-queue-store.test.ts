/**
 * ADR-366 §C.1.c — RenderQueueStore FSM + selectors tests.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAbortSignal,
  registerAbortController,
  releaseAbortController,
  selectActiveJob,
  selectAllJobs,
  selectAnyJobs,
  selectCompletedJobs,
  selectFailedJobs,
  selectJobById,
  selectNextQueuedJob,
  selectQueuedJobs,
  useRenderQueueStore,
} from '../RenderQueueStore';
import type { RenderJobDoc } from '../animation-types';
import type { Timestamp } from 'firebase/firestore';

const TS = { seconds: 0, nanoseconds: 0 } as unknown as Timestamp;

function freshStore(): void {
  useRenderQueueStore.getState().reset();
}

function enqueueFixture(jobId = 'rnj_bim_test1'): void {
  useRenderQueueStore.getState().enqueue({
    jobId,
    animationId: 'anm_bim_test',
    animationName: 'Untitled 14:30',
    totalFrames: 240,
  });
}

describe('RenderQueueStore — enqueue', () => {
  beforeEach(freshStore);

  it('starts with empty jobs + no active job', () => {
    const s = useRenderQueueStore.getState();
    expect(s.jobs).toHaveLength(0);
    expect(s.activeJobId).toBeNull();
    expect(selectAnyJobs(s)).toBe(false);
  });

  it('appends a queued job', () => {
    enqueueFixture();
    const s = useRenderQueueStore.getState();
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0]!.status).toBe('queued');
    expect(s.jobs[0]!.progress).toBe(0);
    expect(s.jobs[0]!.currentFrame).toBe(0);
    expect(s.jobs[0]!.totalFrames).toBe(240);
    expect(selectAnyJobs(s)).toBe(true);
  });

  it('is idempotent for duplicate jobId', () => {
    enqueueFixture();
    enqueueFixture();
    expect(useRenderQueueStore.getState().jobs).toHaveLength(1);
  });

  it('preserves FIFO order', () => {
    enqueueFixture('rnj_a');
    enqueueFixture('rnj_b');
    enqueueFixture('rnj_c');
    const ids = useRenderQueueStore.getState().jobs.map((j) => j.jobId);
    expect(ids).toEqual(['rnj_a', 'rnj_b', 'rnj_c']);
  });
});

describe('RenderQueueStore — FSM transitions', () => {
  beforeEach(freshStore);

  it('queued → rendering sets startedAt timestamp', () => {
    enqueueFixture();
    const before = Date.now();
    useRenderQueueStore.getState().setJobStatus('rnj_bim_test1', 'rendering');
    const job = selectJobById('rnj_bim_test1')(useRenderQueueStore.getState());
    expect(job?.status).toBe('rendering');
    expect(job?.startedAt).toBeGreaterThanOrEqual(before);
  });

  it('progress updates clamp to [0,100]', () => {
    enqueueFixture();
    const api = useRenderQueueStore.getState();
    api.setJobProgress('rnj_bim_test1', 120, 105);
    const job = selectJobById('rnj_bim_test1')(useRenderQueueStore.getState());
    expect(job?.progress).toBe(100);
    expect(job?.currentFrame).toBe(120);

    api.setJobProgress('rnj_bim_test1', -3, -10);
    const job2 = selectJobById('rnj_bim_test1')(useRenderQueueStore.getState());
    expect(job2?.progress).toBe(0);
    expect(job2?.currentFrame).toBe(0);
  });

  it('cancel flips status to cancelled-resumable + clears active', () => {
    enqueueFixture();
    const api = useRenderQueueStore.getState();
    api.setActiveJob('rnj_bim_test1');
    api.setJobStatus('rnj_bim_test1', 'rendering');
    api.cancel('rnj_bim_test1');
    const s = useRenderQueueStore.getState();
    expect(selectJobById('rnj_bim_test1')(s)?.status).toBe('cancelled-resumable');
    expect(s.activeJobId).toBeNull();
  });

  it('cancel calls abort() on the registered controller', () => {
    enqueueFixture();
    const ac = new AbortController();
    registerAbortController('rnj_bim_test1', ac);
    useRenderQueueStore.getState().cancel('rnj_bim_test1');
    expect(ac.signal.aborted).toBe(true);
  });

  it('retry re-queues a failed job + clears error', () => {
    enqueueFixture();
    const api = useRenderQueueStore.getState();
    api.setJobStatus('rnj_bim_test1', 'failed', { errorMessage: 'boom' });
    api.retry('rnj_bim_test1');
    const job = selectJobById('rnj_bim_test1')(useRenderQueueStore.getState());
    expect(job?.status).toBe('queued');
    expect(job?.errorMessage).toBeNull();
  });

  it('setJobStatus done stores blobUrl + storagePath extras', () => {
    enqueueFixture();
    useRenderQueueStore.getState().setJobStatus('rnj_bim_test1', 'done', {
      blobUrl: 'https://storage.example/x.mp4',
      storagePath: 'companies/co1/bim_animations/a/renders/x.mp4',
    });
    const job = selectJobById('rnj_bim_test1')(useRenderQueueStore.getState());
    expect(job?.status).toBe('done');
    expect(job?.blobUrl).toBe('https://storage.example/x.mp4');
    expect(job?.storagePath).toBe('companies/co1/bim_animations/a/renders/x.mp4');
  });
});

describe('RenderQueueStore — selectors', () => {
  beforeEach(freshStore);

  it('selectNextQueuedJob returns first queued when idle, null when active', () => {
    enqueueFixture('rnj_a');
    enqueueFixture('rnj_b');
    const api = useRenderQueueStore.getState();
    expect(selectNextQueuedJob(useRenderQueueStore.getState())?.jobId).toBe('rnj_a');
    api.setActiveJob('rnj_a');
    expect(selectNextQueuedJob(useRenderQueueStore.getState())).toBeNull();
  });

  it('selectQueuedJobs + selectCompletedJobs + selectFailedJobs partition correctly', () => {
    enqueueFixture('rnj_a');
    enqueueFixture('rnj_b');
    enqueueFixture('rnj_c');
    enqueueFixture('rnj_d');
    const api = useRenderQueueStore.getState();
    api.setJobStatus('rnj_b', 'done');
    api.setJobStatus('rnj_c', 'failed', { errorMessage: 'e' });
    api.setJobStatus('rnj_d', 'cancelled-resumable');
    const s = useRenderQueueStore.getState();
    expect(selectQueuedJobs(s).map((j) => j.jobId)).toEqual(['rnj_a']);
    expect(selectCompletedJobs(s).map((j) => j.jobId)).toEqual(['rnj_b']);
    expect(selectFailedJobs(s).map((j) => j.jobId)).toEqual(['rnj_c', 'rnj_d']);
    expect(selectAllJobs(s)).toHaveLength(4);
  });

  it('selectActiveJob returns null when no active id', () => {
    enqueueFixture();
    expect(selectActiveJob(useRenderQueueStore.getState())).toBeNull();
  });
});

describe('RenderQueueStore — hydrateFromFirestore', () => {
  beforeEach(freshStore);

  function makeDoc(partial: Partial<RenderJobDoc>): RenderJobDoc {
    return {
      id: 'rnj_bim_test1',
      animationId: 'anm_bim_test',
      companyId: 'co_test',
      status: 'queued',
      progress: 0,
      createdAt: TS,
      updatedAt: TS,
      ...partial,
    };
  }

  it('hydrates an empty store from Firestore docs', () => {
    useRenderQueueStore.getState().hydrateFromFirestore([
      makeDoc({ id: 'rnj_a' }),
      makeDoc({ id: 'rnj_b', status: 'done', progress: 100 }),
    ]);
    const jobs = useRenderQueueStore.getState().jobs;
    expect(jobs).toHaveLength(2);
    expect(jobs[1]!.status).toBe('done');
    expect(jobs[1]!.progress).toBe(100);
  });

  it('equality guard skips identical hydration', () => {
    const before = useRenderQueueStore.getState().jobs;
    useRenderQueueStore.getState().hydrateFromFirestore([]);
    expect(useRenderQueueStore.getState().jobs).toBe(before); // same reference
  });

  it('preserves local runtime fields (blobUrl) across hydration', () => {
    enqueueFixture();
    useRenderQueueStore.getState().setJobStatus('rnj_bim_test1', 'done', {
      blobUrl: 'blob:local',
    });
    useRenderQueueStore.getState().hydrateFromFirestore([
      makeDoc({ id: 'rnj_bim_test1', status: 'done', progress: 100 }),
    ]);
    expect(
      selectJobById('rnj_bim_test1')(useRenderQueueStore.getState())?.blobUrl,
    ).toBe('blob:local');
  });
});

describe('RenderQueueStore — abort controller registry', () => {
  beforeEach(() => {
    freshStore();
    releaseAbortController('rnj_bim_test1');
  });

  it('register + retrieve signal', () => {
    const ac = new AbortController();
    registerAbortController('rnj_bim_test1', ac);
    expect(getAbortSignal('rnj_bim_test1')).toBe(ac.signal);
  });

  it('release removes from registry', () => {
    const ac = new AbortController();
    registerAbortController('rnj_bim_test1', ac);
    releaseAbortController('rnj_bim_test1');
    expect(getAbortSignal('rnj_bim_test1')).toBeNull();
  });
});
