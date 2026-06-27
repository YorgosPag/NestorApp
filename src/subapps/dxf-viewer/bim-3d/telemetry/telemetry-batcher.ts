/**
 * telemetry-batcher — ADR-366 §C.7.Q3
 *
 * Buffers anonymized samples client-side and flushes them in batches to keep
 * upload pressure low. Flush triggers (Q3 decision):
 *
 *   - buffer reaches `BATCH_SIZE` (5 samples)
 *   - `FLUSH_INTERVAL_MS` (5 min) elapsed since last flush
 *   - `flushNow()` called explicitly (session end / visibility change)
 *
 * Short-circuits to a no-op when `telemetryStore.optIn === false`, so the
 * collector hook can call `observe()` unconditionally without overhead.
 *
 * Pure-ish: no React, no DOM. Pulls the userAgent / userId from injected
 * deps so unit tests can drive without a browser.
 */

import { anonymizeSample, type AnonymizedTelemetrySample } from './anonymizer';
import { computeAnonymousSessionId } from './session-id-generator';
import { telemetryStore } from './telemetry-store';
import { uploadTelemetryBatch } from './telemetry-uploader';
import type { PerformanceMetricsSnapshot } from '../performance/PerformanceHUDStore';
import type { HudRenderMode } from '../performance/hud-render-mode';
import { DXF_TIMING } from '../../config/dxf-timing';

export const BATCH_SIZE = 5;
export const FLUSH_INTERVAL_MS = DXF_TIMING.lifecycle.TELEMETRY_FLUSH; // ADR-516

interface PendingSample {
  snapshot: PerformanceMetricsSnapshot;
  renderMode: HudRenderMode;
  now: number;
}

interface BatcherInternals {
  buffer: PendingSample[];
  lastFlushAt: number;
  flushInFlight: Promise<void> | null;
}

const internals: BatcherInternals = {
  buffer: [],
  lastFlushAt: 0,
  flushInFlight: null,
};

/** Read the current UA string with SSR fallback. */
function readUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent ?? '';
}

async function performFlush(): Promise<void> {
  const state = telemetryStore.getState();
  if (!state.optIn || !state.userIdContext) {
    internals.buffer = [];
    internals.lastFlushAt = Date.now();
    return;
  }
  if (internals.buffer.length === 0) {
    internals.lastFlushAt = Date.now();
    return;
  }

  const sessionId = await computeAnonymousSessionId(state.userIdContext);
  const ua = readUserAgent();
  const pending = internals.buffer.splice(0, internals.buffer.length);

  const samples: AnonymizedTelemetrySample[] = pending.map((p) =>
    anonymizeSample({
      sessionId,
      snapshot: p.snapshot,
      renderMode: p.renderMode,
      now: p.now,
      userAgent: ua,
      gpuTier: null,
    }),
  );

  internals.lastFlushAt = Date.now();
  await uploadTelemetryBatch({ sessionId, samples });
}

/**
 * Schedule a flush, coalescing concurrent callers behind a single in-flight
 * promise. Errors are swallowed at this layer — the uploader has its own
 * retry/backoff and individual failures must not block the render loop.
 */
function scheduleFlush(): void {
  if (internals.flushInFlight) return;
  internals.flushInFlight = performFlush()
    .catch(() => { /* uploader-owned retry */ })
    .finally(() => { internals.flushInFlight = null; });
}

export const telemetryBatcher = {
  /**
   * Observe one sample. Called from PerformanceCollector tick.
   * Returns true iff a flush was scheduled (for tests).
   */
  observe(
    snapshot: PerformanceMetricsSnapshot,
    renderMode: HudRenderMode,
    now: number = Date.now(),
  ): boolean {
    if (!telemetryStore.getState().optIn) return false;

    internals.buffer.push({ snapshot, renderMode, now });

    const elapsed = now - internals.lastFlushAt;
    if (internals.buffer.length >= BATCH_SIZE || elapsed >= FLUSH_INTERVAL_MS) {
      scheduleFlush();
      return true;
    }
    return false;
  },

  /** Force an immediate flush — used on session end / visibility change. */
  flushNow(): void {
    scheduleFlush();
  },

  /** Drop the in-memory buffer without uploading — used on opt-out. */
  reset(): void {
    internals.buffer = [];
    internals.lastFlushAt = Date.now();
  },
};
