/**
 * OneShotScheduler — ADR-065 SRP split
 * One-shot RAF scheduling for non-continuous operations (fit-to-view, layout stabilization).
 * Extracted from UnifiedFrameScheduler.ts.
 */

import { dlog, derr } from '../../debug';
import type { SchedulerConfig } from './frame-scheduler-types';

export class OneShotScheduler {
  private callbacks: Map<string, () => void> = new Map();
  private rafId: number | null = null;
  private config: SchedulerConfig;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /** Update config reference */
  setConfig(config: SchedulerConfig): void {
    this.config = config;
  }

  /**
   * Schedule a one-shot callback for next frame.
   * If same ID is scheduled multiple times, only last callback runs.
   */
  schedule(id: string, callback: () => void): void {
    this.callbacks.set(id, callback);

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.executeCallbacks());
    }

    if (this.config.debug) {
      dlog('FrameScheduler', `scheduleOnce: ${id}`);
    }
  }

  /**
   * Schedule a one-shot callback with delay (layout stabilization).
   * Uses RAF -> setTimeout -> RAF pattern.
   * @returns Cancel function
   */
  scheduleDelayed(id: string, callback: () => void, delayMs: number): () => void {
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        rafId = requestAnimationFrame(() => {
          if (cancelled) return;
          try {
            callback();
          } catch (error) {
            derr('FrameScheduler', `Error in scheduleOnceDelayed "${id}":`, error);
          }
        });
      }, delayMs);
    });

    if (this.config.debug) {
      dlog('FrameScheduler', `scheduleOnceDelayed: ${id} (${delayMs}ms)`);
    }

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }

  /** Cancel a pending one-shot callback */
  cancel(id: string): boolean {
    const existed = this.callbacks.delete(id);
    if (this.callbacks.size === 0 && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    return existed;
  }

  /** Cleanup all pending callbacks */
  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callbacks.clear();
  }

  private executeCallbacks(): void {
    this.rafId = null;
    const entries = Array.from(this.callbacks.entries());
    this.callbacks.clear();

    for (const [id, callback] of entries) {
      try {
        callback();
      } catch (error) {
        derr('FrameScheduler', `Error in scheduleOnce "${id}":`, error);
      }
    }

    if (this.config.debug && entries.length > 0) {
      dlog('FrameScheduler', `Executed ${entries.length} one-shot callbacks`);
    }
  }
}
