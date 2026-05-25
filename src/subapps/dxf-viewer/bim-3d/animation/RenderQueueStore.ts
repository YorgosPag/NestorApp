'use client';

/**
 * ADR-366 Phase 9 / C.1.c — RenderQueueStore (Zustand SSoT).
 *
 * In-session FIFO queue for MP4 render jobs. Concurrent limit = 1 (GPU bound).
 * Sources of truth:
 *  - `jobs`         : insertion-ordered list (FIFO; newest at end)
 *  - `activeJobId`  : jobId currently rendering (null when idle)
 *
 * Non-serializable per-job state (AbortControllers) lives in a module-scope
 * Map — never inside the Zustand state. The processor wires the controller
 * into the encoder loop; cancel() flips status + signals abort.
 *
 * Firestore hydration (`hydrateFromFirestore`) keeps the local snapshot in
 * sync with persisted RenderJobDoc shape so cross-tab visibility eventually
 * reflects the same queue — runtime-only fields (blobUrl, startedAt) are
 * preserved across updates.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { RenderJobDoc, RenderJobStatus } from './animation-types';

export interface JobRecord {
  readonly jobId: string;
  readonly animationId: string;
  readonly animationName: string;
  readonly status: RenderJobStatus;
  readonly progress: number;
  readonly totalFrames: number;
  readonly currentFrame: number;
  readonly startedAt: number | null;
  readonly blobUrl: string | null;
  readonly storagePath: string | null;
  readonly errorMessage: string | null;
}

export type EnqueueInput = Pick<
  JobRecord,
  'jobId' | 'animationId' | 'animationName' | 'totalFrames'
>;

export type StatusExtras = {
  readonly errorMessage?: string;
  readonly blobUrl?: string;
  readonly storagePath?: string;
};

interface RenderQueueState {
  readonly jobs: ReadonlyArray<JobRecord>;
  readonly activeJobId: string | null;
}

interface RenderQueueActions {
  enqueue(input: EnqueueInput): void;
  setJobProgress(jobId: string, currentFrame: number, progress: number): void;
  setJobStatus(jobId: string, status: RenderJobStatus, extras?: StatusExtras): void;
  setActiveJob(jobId: string | null): void;
  cancel(jobId: string): void;
  retry(jobId: string): void;
  removeJob(jobId: string): void;
  clearCompleted(): void;
  hydrateFromFirestore(jobs: ReadonlyArray<RenderJobDoc>): void;
  reset(): void;
}

type RenderQueueStore = RenderQueueState & RenderQueueActions;

// ---------------------------------------------------------------------------
// Module-scope AbortControllers — non-serializable, never in Zustand state.
// ---------------------------------------------------------------------------

const abortControllers = new Map<string, AbortController>();

export function registerAbortController(jobId: string, ac: AbortController): void {
  abortControllers.set(jobId, ac);
}

export function releaseAbortController(jobId: string): void {
  abortControllers.delete(jobId);
}

export function getAbortSignal(jobId: string): AbortSignal | null {
  return abortControllers.get(jobId)?.signal ?? null;
}

function abortJob(jobId: string): void {
  const ac = abortControllers.get(jobId);
  if (ac && !ac.signal.aborted) ac.abort();
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectAllJobs = (s: RenderQueueStore): ReadonlyArray<JobRecord> => s.jobs;

export const selectAnyJobs = (s: RenderQueueStore): boolean => s.jobs.length > 0;

export const selectActiveJob = (s: RenderQueueStore): JobRecord | null => {
  if (s.activeJobId === null) return null;
  return s.jobs.find((j) => j.jobId === s.activeJobId) ?? null;
};

export const selectQueuedJobs = (s: RenderQueueStore): ReadonlyArray<JobRecord> =>
  s.jobs.filter((j) => j.status === 'queued');

export const selectCompletedJobs = (s: RenderQueueStore): ReadonlyArray<JobRecord> =>
  s.jobs.filter((j) => j.status === 'done');

export const selectFailedJobs = (s: RenderQueueStore): ReadonlyArray<JobRecord> =>
  s.jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled-resumable');

export const selectNextQueuedJob = (s: RenderQueueStore): JobRecord | null => {
  if (s.activeJobId !== null) return null;
  return s.jobs.find((j) => j.status === 'queued') ?? null;
};

export function selectJobById(jobId: string): (s: RenderQueueStore) => JobRecord | undefined {
  return (s) => s.jobs.find((j) => j.jobId === jobId);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: RenderQueueState = {
  jobs: [],
  activeJobId: null,
};

function makeJobRecord(input: EnqueueInput): JobRecord {
  return {
    jobId: input.jobId,
    animationId: input.animationId,
    animationName: input.animationName,
    status: 'queued',
    progress: 0,
    totalFrames: input.totalFrames,
    currentFrame: 0,
    startedAt: null,
    blobUrl: null,
    storagePath: null,
    errorMessage: null,
  };
}

type MutableJobPatch = { -readonly [K in keyof JobRecord]?: JobRecord[K] };

function patchJob(
  jobs: ReadonlyArray<JobRecord>,
  jobId: string,
  patch: MutableJobPatch,
): ReadonlyArray<JobRecord> {
  let changed = false;
  const next = jobs.map((j) => {
    if (j.jobId !== jobId) return j;
    changed = true;
    return { ...j, ...patch };
  });
  return changed ? next : jobs;
}

export const useRenderQueueStore = create<RenderQueueStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      enqueue: (input) =>
        set((s) => {
          const existing = s.jobs.find((j) => j.jobId === input.jobId);
          if (existing) return s;
          return { ...s, jobs: [...s.jobs, makeJobRecord(input)] };
        }),

      setJobProgress: (jobId, currentFrame, progress) =>
        set((s) => ({
          ...s,
          jobs: patchJob(s.jobs, jobId, {
            currentFrame: Math.max(0, Math.floor(currentFrame)),
            progress: Math.max(0, Math.min(100, progress)),
          }),
        })),

      setJobStatus: (jobId, status, extras) =>
        set((s) => {
          const patch: { -readonly [K in keyof JobRecord]?: JobRecord[K] } = { status };
          if (status === 'rendering' && !s.jobs.find((j) => j.jobId === jobId)?.startedAt) {
            patch.startedAt = Date.now();
          }
          if (extras?.errorMessage !== undefined) patch.errorMessage = extras.errorMessage;
          if (extras?.blobUrl !== undefined) patch.blobUrl = extras.blobUrl;
          if (extras?.storagePath !== undefined) patch.storagePath = extras.storagePath;
          return { ...s, jobs: patchJob(s.jobs, jobId, patch) };
        }),

      setActiveJob: (jobId) => set((s) => ({ ...s, activeJobId: jobId })),

      cancel: (jobId) => {
        abortJob(jobId);
        set((s) => ({
          ...s,
          jobs: patchJob(s.jobs, jobId, { status: 'cancelled-resumable' }),
          activeJobId: s.activeJobId === jobId ? null : s.activeJobId,
        }));
      },

      retry: (jobId) => {
        releaseAbortController(jobId);
        set((s) => ({
          ...s,
          jobs: patchJob(s.jobs, jobId, { status: 'queued', errorMessage: null }),
        }));
      },

      removeJob: (jobId) => {
        releaseAbortController(jobId);
        set((s) => ({
          ...s,
          jobs: s.jobs.filter((j) => j.jobId !== jobId),
          activeJobId: s.activeJobId === jobId ? null : s.activeJobId,
        }));
      },

      clearCompleted: () => {
        const removable = get().jobs.filter(
          (j) => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled',
        );
        for (const j of removable) releaseAbortController(j.jobId);
        const removableIds = new Set(removable.map((j) => j.jobId));
        set((s) => ({ ...s, jobs: s.jobs.filter((j) => !removableIds.has(j.jobId)) }));
      },

      hydrateFromFirestore: (docs) =>
        set((s) => {
          const sameShape =
            s.jobs.length === docs.length &&
            docs.every((d, i) => {
              const local = s.jobs[i];
              if (!local) return false;
              return (
                local.jobId === d.id &&
                local.status === d.status &&
                Math.round(local.progress) === Math.round(d.progress)
              );
            });
          if (sameShape) return s;

          const byId = new Map(s.jobs.map((j) => [j.jobId, j] as const));
          const nextJobs: JobRecord[] = docs.map((d) => {
            const existing = byId.get(d.id);
            return {
              jobId: d.id,
              animationId: d.animationId,
              animationName: existing?.animationName ?? d.id,
              status: d.status,
              progress: d.progress,
              totalFrames: existing?.totalFrames ?? 0,
              currentFrame: existing?.currentFrame ?? Math.floor(d.lastSampleCount ?? 0),
              startedAt: existing?.startedAt ?? null,
              blobUrl: existing?.blobUrl ?? null,
              storagePath: existing?.storagePath ?? null,
              errorMessage: existing?.errorMessage ?? d.errorMessage ?? null,
            };
          });
          return { ...s, jobs: nextJobs };
        }),

      reset: () => {
        for (const j of get().jobs) abortJob(j.jobId);
        abortControllers.clear();
        set((s) => ({ ...s, jobs: [], activeJobId: null }));
      },
    })),
    { name: 'RenderQueueStore' }
  )
);
