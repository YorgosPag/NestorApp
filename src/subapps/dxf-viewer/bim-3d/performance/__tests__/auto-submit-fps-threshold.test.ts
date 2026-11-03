/**
 * auto-submit FSM — ADR-366 §C.7.Q4
 *
 * Detector (sustained FPS<10 for 5s, cooldown, opt-out, telemetry skip, hidden
 * tab) + store (guarded, idempotent transitions). Wall-clock `now` throughout:
 * the cooldown is persisted and compared across page loads.
 */

import {
  autoSubmitFpsThreshold,
  LOW_FPS_THRESHOLD,
  MAX_SAMPLE_GAP_MS,
  PROMPT_COOLDOWN_MS,
  SUSTAINED_LOW_MS,
  setPageVisibleProbe,
  setTelemetryOptInProbe,
} from '../auto-submit-fps-threshold';
import { autoSubmitStore } from '../auto-submit-store';
import type { PerformanceMetricsSnapshot } from '../PerformanceHUDStore';

const T0 = 1_793_700_000_000; // wall-clock epoch ms
const LOW = LOW_FPS_THRESHOLD - 4;

const SNAPSHOT: PerformanceMetricsSnapshot = {
  fps: LOW, frameTimeMs: 166.7, triangles: 1000, vertices: 3000, drawCalls: 40,
  objectsVisible: 10, objectsTotal: 12, gpuMemoryMb: 50, cpuMemoryMb: 300, samplesPerSec: null,
};

/** Feed low samples every 250ms from `start` for `durationMs`; returns trigger times. */
function feedLow(start: number, durationMs: number): number[] {
  const hits: number[] = [];
  for (let t = start; t <= start + durationMs; t += 250) {
    if (autoSubmitFpsThreshold.observe(LOW, t)) hits.push(t);
  }
  return hits;
}

function resetStore(): void {
  autoSubmitStore.setState({
    phase: 'idle', triggerFps: null, triggerAt: null, triggerSnapshot: null,
    lastDeclinedAt: null, permanentOptOut: false,
  });
}

describe('autoSubmitFpsThreshold', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
    autoSubmitFpsThreshold.reset();
    setTelemetryOptInProbe(() => false);
    setPageVisibleProbe(() => true);
  });

  afterAll(() => setPageVisibleProbe(null));

  it('fires once after FPS stays low for the full sustained window', () => {
    const hits = feedLow(T0, SUSTAINED_LOW_MS + 1000);
    expect(hits).toEqual([T0 + SUSTAINED_LOW_MS]);
  });

  it('a transient dip shorter than the window never fires', () => {
    expect(feedLow(T0, SUSTAINED_LOW_MS - 500)).toEqual([]);
    expect(autoSubmitFpsThreshold.observe(60, T0 + SUSTAINED_LOW_MS)).toBe(false);
    expect(feedLow(T0 + SUSTAINED_LOW_MS + 250, SUSTAINED_LOW_MS - 500)).toEqual([]);
  });

  it('a hidden tab resets the window — no alarm from a backgrounded page', () => {
    feedLow(T0, SUSTAINED_LOW_MS - 1000);
    setPageVisibleProbe(() => false);
    expect(feedLow(T0 + SUSTAINED_LOW_MS - 750, 2000)).toEqual([]);
    setPageVisibleProbe(() => true);
    const resumeAt = T0 + SUSTAINED_LOW_MS + 1500;
    expect(feedLow(resumeAt, SUSTAINED_LOW_MS)).toEqual([resumeAt + SUSTAINED_LOW_MS]);
  });

  it('a gap in sampling breaks the window — a stale low reading is not 5s of evidence', () => {
    feedLow(T0, SUSTAINED_LOW_MS - 1000); // low, then the collector goes quiet (2D view…)
    const back = T0 + 60_000;
    expect(autoSubmitFpsThreshold.observe(LOW, back)).toBe(false); // first sample after the gap
    expect(feedLow(back + 250, SUSTAINED_LOW_MS)).toEqual([back + SUSTAINED_LOW_MS]);
    expect(MAX_SAMPLE_GAP_MS).toBeLessThan(SUSTAINED_LOW_MS);
  });

  it('never re-prompts while a prompt or a review is open', () => {
    autoSubmitStore.getState().openPrompt(LOW, T0, SNAPSHOT);
    expect(feedLow(T0, SUSTAINED_LOW_MS * 2)).toEqual([]);
    autoSubmitStore.getState().beginReview();
    expect(feedLow(T0, SUSTAINED_LOW_MS * 2)).toEqual([]);
  });

  it('respects the 30-minute cooldown after a decline, then asks again', () => {
    autoSubmitStore.getState().openPrompt(LOW, T0, SNAPSHOT);
    autoSubmitStore.getState().recordDeclined('prompted', T0);
    expect(feedLow(T0 + 1000, SUSTAINED_LOW_MS * 2)).toEqual([]);
    const later = T0 + PROMPT_COOLDOWN_MS + 1000;
    expect(feedLow(later, SUSTAINED_LOW_MS)).toEqual([later + SUSTAINED_LOW_MS]);
  });

  it('permanent opt-out and telemetry opt-in both suppress the prompt', () => {
    autoSubmitStore.getState().setPermanentOptOut(true);
    expect(feedLow(T0, SUSTAINED_LOW_MS * 2)).toEqual([]);
    autoSubmitStore.getState().setPermanentOptOut(false);
    setTelemetryOptInProbe(() => true);
    expect(feedLow(T0, SUSTAINED_LOW_MS * 2)).toEqual([]);
  });
});

describe('autoSubmitStore transitions', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('openPrompt freezes the detection-time snapshot; a second open is a no-op', () => {
    autoSubmitStore.getState().openPrompt(LOW, T0, SNAPSHOT);
    autoSubmitStore.getState().openPrompt(1, T0 + 1, { ...SNAPSHOT, fps: 1 });
    const s = autoSubmitStore.getState();
    expect(s.phase).toBe('prompted');
    expect(s.triggerAt).toBe(T0);
    expect(s.triggerSnapshot).toBe(SNAPSHOT);
  });

  it('a toast dismissal AFTER «Αναφορά…» cannot cancel the review (no false decline)', () => {
    autoSubmitStore.getState().openPrompt(LOW, T0, SNAPSHOT);
    autoSubmitStore.getState().beginReview();
    autoSubmitStore.getState().recordDeclined('prompted', T0 + 10); // sonner onDismiss
    const s = autoSubmitStore.getState();
    expect(s.phase).toBe('reviewing');
    expect(s.lastDeclinedAt).toBeNull();
  });

  it('a successful send clears the prompt with NO cooldown, and a late close is a no-op', () => {
    autoSubmitStore.getState().openPrompt(LOW, T0, SNAPSHOT);
    autoSubmitStore.getState().beginReview();
    autoSubmitStore.getState().recordSubmitted();
    autoSubmitStore.getState().recordDeclined('reviewing', T0 + 10); // dialog onOpenChange(false)
    const s = autoSubmitStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.triggerSnapshot).toBeNull();
    expect(s.lastDeclinedAt).toBeNull();
  });

  it('cancelling the review records a persisted cooldown', () => {
    autoSubmitStore.getState().openPrompt(LOW, T0, SNAPSHOT);
    autoSubmitStore.getState().beginReview();
    autoSubmitStore.getState().recordDeclined('reviewing', T0 + 10);
    expect(autoSubmitStore.getState().lastDeclinedAt).toBe(T0 + 10);
    expect(localStorage.getItem('bim3d.autoSubmit.lastDeclinedAt')).toBe(String(T0 + 10));
  });

  it('permanent opt-out closes an open prompt and persists', () => {
    autoSubmitStore.getState().openPrompt(LOW, T0, SNAPSHOT);
    autoSubmitStore.getState().setPermanentOptOut(true);
    expect(autoSubmitStore.getState().phase).toBe('idle');
    expect(localStorage.getItem('bim3d.autoSubmit.permanentOptOut')).toBe('true');
  });
});
