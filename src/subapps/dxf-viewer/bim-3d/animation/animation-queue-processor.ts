'use client';

/**
 * ADR-366 Phase 9 / C.1.c — Animation Queue Processor (glue layer).
 *
 * Wires four SSoTs into a single end-to-end render pipeline:
 *
 *   RenderQueueStore  ── subscribe ──▶  pickNextQueuedJob()
 *           │                              │
 *           │                              ▼
 *           │                       AnimationStore (config snapshot)
 *           │                              │
 *           │                              ▼
 *           │                       buildWaypointPath()  → frames
 *           │                              │
 *           │                              ▼
 *           │                       exportAnimationMP4() → Blob
 *           │                              │
 *           │                              ▼
 *           │                       uploadBytes() → Firebase Storage
 *           │                              │
 *           │                              ▼
 *           ◀──── setJobStatus 'done' + BimAnimationsService.updateRenderJob ─┘
 *
 * Cancellation, retry, and failure paths are all owned here so the React
 * UI (RenderQueuePanel) stays a pure presentation surface.
 *
 * Mounting: `useAnimationQueueProcessor(ctx)` runs once inside BimViewport3D
 * after the scene manager finishes mounting. The processor subscribes
 * to RenderQueueStore changes; when the queue has a `queued` job and no
 * active job is in flight, it claims the next FIFO entry.
 *
 * Concurrent jobs = 1 (GPU bound — single WebGL context, single VideoEncoder).
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { ref as makeStorageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAnimationStore, selectAnimationConfig } from './AnimationStore';
import {
  registerAbortController,
  releaseAbortController,
  useRenderQueueStore,
} from './RenderQueueStore';
import { BimAnimationsService } from '../services/bim-animations.service';
import { detectSupportedCodec, exportAnimationMP4 } from './MP4Exporter';
import { buildWaypointPath } from './core/WaypointPathBuilder';
import { resumeFrameIndex, serializeCheckpoint } from './render-checkpoint';
import { buildBimAnimationRenderPath } from '@/services/upload/utils/storage-path';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { AnimationCodec } from './animation-types';
import { DXF_TIMING } from '../../config/dxf-timing';

export interface QueueProcessorCallbacks {
  readonly onRenderStarted?: (animationName: string) => void;
  readonly onRenderCompleted?: (animationName: string, blobUrl: string) => void;
  readonly onRenderFailed?: (animationName: string, reason: string) => void;
  readonly onRenderCancelled?: (animationName: string) => void;
}

export interface QueueProcessorContext {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly companyId: string | null;
  readonly projectId: string | null;
  readonly callbacks?: QueueProcessorCallbacks;
}

const PROGRESS_PERSIST_INTERVAL_MS = DXF_TIMING.persist.PROGRESS_INTERVAL; // ADR-516
const DEFAULT_RENDER_WIDTH = 1920;
const DEFAULT_RENDER_HEIGHT = 1080;

export function useAnimationQueueProcessor(ctx: QueueProcessorContext): void {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const inFlightRef = useRef(false);

  useEffect(() => {
    const tryClaim = (): void => {
      if (inFlightRef.current) return;
      const state = useRenderQueueStore.getState();
      if (state.activeJobId !== null) return;
      const next = state.jobs.find((j) => j.status === 'queued');
      if (!next) return;
      inFlightRef.current = true;
      void processJob(next.jobId, ctxRef).finally(() => {
        inFlightRef.current = false;
        // Re-check immediately: another job may have queued during the run.
        tryClaim();
      });
    };

    // Initial check (covers retry-then-mount case).
    tryClaim();

    // React to enqueue / status changes.
    const unsub = useRenderQueueStore.subscribe(
      (s) => `${s.activeJobId ?? ''}|${s.jobs.length}|${s.jobs.map((j) => j.status).join(',')}`,
      () => tryClaim(),
    );
    return () => { unsub(); };
  }, []);
}

// ---------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------

async function processJob(
  jobId: string,
  ctxRef: MutableRefObject<QueueProcessorContext>,
): Promise<void> {
  const queue = useRenderQueueStore.getState();
  const record = queue.jobs.find((j) => j.jobId === jobId);
  if (!record) return;

  const { managerRef, companyId, projectId, callbacks } = ctxRef.current;
  if (!managerRef.current || !companyId || !projectId) {
    queue.setJobStatus(jobId, 'failed', { errorMessage: 'context-missing' });
    callbacks?.onRenderFailed?.(record.animationName, 'context-missing');
    return;
  }

  const animationStore = useAnimationStore.getState();
  const animationConfig = selectAnimationConfig(animationStore);
  if (animationConfig.waypoints.length < 2) {
    queue.setJobStatus(jobId, 'failed', { errorMessage: 'no-waypoints' });
    callbacks?.onRenderFailed?.(record.animationName, 'no-waypoints');
    return;
  }

  const abortController = new AbortController();
  registerAbortController(jobId, abortController);
  queue.setActiveJob(jobId);
  queue.setJobStatus(jobId, 'rendering');
  callbacks?.onRenderStarted?.(record.animationName);

  let codec: AnimationCodec;
  try {
    codec = await detectSupportedCodec();
  } catch (err) {
    finalizeFailed(jobId, record.animationName, err, callbacks);
    return;
  }

  const startFrameIndex = await resolveStartFrame(record.animationId, jobId);
  const frames = buildWaypointPath(animationConfig.waypoints, animationConfig);
  if (frames.length === 0) {
    finalizeFailed(jobId, record.animationName, new Error('no-frames'), callbacks);
    return;
  }

  let lastProgressPersistAt = 0;

  try {
    const blob = await exportAnimationMP4({
      scene: managerRef.current.scene,
      frames,
      fps: animationConfig.fps,
      width: DEFAULT_RENDER_WIDTH,
      height: DEFAULT_RENDER_HEIGHT,
      codec,
      startFrameIndex,
      signal: abortController.signal,
      onProgress: (frameIndex, total) => {
        const pct = total === 0 ? 0 : (frameIndex / total) * 100;
        useRenderQueueStore.getState().setJobProgress(jobId, frameIndex, pct);

        const now = Date.now();
        if (now - lastProgressPersistAt > PROGRESS_PERSIST_INTERVAL_MS) {
          lastProgressPersistAt = now;
          void BimAnimationsService.updateRenderJob(record.animationId, jobId, {
            progress: pct,
            lastSampleCount: frameIndex,
          }).catch(() => { /* silent: queue UI is authoritative for in-session */ });
        }
      },
    });

    const { storagePath, downloadUrl } = await uploadRenderBlob({
      blob,
      companyId,
      animationId: record.animationId,
      jobId,
    });

    await BimAnimationsService.updateRenderJob(record.animationId, jobId, {
      status: 'done',
      progress: 100,
      outputAssetId: storagePath,
    });

    useRenderQueueStore.getState().setJobStatus(jobId, 'done', {
      blobUrl: downloadUrl,
      storagePath,
    });
    callbacks?.onRenderCompleted?.(record.animationName, downloadUrl);
  } catch (err) {
    if (isAbortError(err)) {
      handleCancelledResumable(jobId, record, callbacks);
      return;
    }
    finalizeFailed(jobId, record.animationName, err, callbacks);
  } finally {
    releaseAbortController(jobId);
    useRenderQueueStore.getState().setActiveJob(null);
  }
}

// ---------------------------------------------------------------------------
// Storage upload
// ---------------------------------------------------------------------------

interface UploadInput {
  readonly blob: Blob;
  readonly companyId: string;
  readonly animationId: string;
  readonly jobId: string;
}

async function uploadRenderBlob(input: UploadInput): Promise<{
  storagePath: string;
  downloadUrl: string;
}> {
  const storagePath = buildBimAnimationRenderPath({
    companyId: input.companyId,
    animationId: input.animationId,
    jobId: input.jobId,
    ext: 'mp4',
  });
  const fileRef = makeStorageRef(storage, storagePath);
  await uploadBytes(fileRef, input.blob, { contentType: 'video/mp4' });
  const downloadUrl = await getDownloadURL(fileRef);
  return { storagePath, downloadUrl };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveStartFrame(animationId: string, jobId: string): Promise<number> {
  try {
    const animation = await BimAnimationsService.getAnimation(animationId);
    if (!animation) return 0;
    // RenderJobDoc lives in subcollection — fetch via reading existing record
    // from RenderQueueStore (hydrated from Firestore subscription).
    const job = useRenderQueueStore.getState().jobs.find((j) => j.jobId === jobId);
    if (!job) return 0;
    return resumeFrameIndex({
      id: job.jobId,
      animationId: job.animationId,
      companyId: '',
      status: job.status,
      progress: job.progress,
      lastSampleCount: job.currentFrame,
      createdAt: { seconds: 0, nanoseconds: 0 } as never,
      updatedAt: { seconds: 0, nanoseconds: 0 } as never,
    });
  } catch {
    return 0;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function handleCancelledResumable(
  jobId: string,
  record: { animationId: string; animationName: string; currentFrame: number },
  callbacks?: QueueProcessorCallbacks,
): void {
  const queue = useRenderQueueStore.getState();
  const job = queue.jobs.find((j) => j.jobId === jobId);
  if (!job) return;
  const checkpoint = serializeCheckpoint({
    lastFrameIndex: job.currentFrame,
    lastWaypointIndex: 0,
  });
  queue.setJobStatus(jobId, 'cancelled-resumable');
  void BimAnimationsService.updateRenderJob(record.animationId, jobId, {
    status: 'cancelled-resumable',
    ...checkpoint,
  }).catch(() => { /* silent */ });
  callbacks?.onRenderCancelled?.(record.animationName);
}

function finalizeFailed(
  jobId: string,
  animationName: string,
  err: unknown,
  callbacks?: QueueProcessorCallbacks,
): void {
  const reason = err instanceof Error ? err.message : String(err);
  useRenderQueueStore.getState().setJobStatus(jobId, 'failed', { errorMessage: reason });
  callbacks?.onRenderFailed?.(animationName, reason);
}
