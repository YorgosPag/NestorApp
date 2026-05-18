// Time-windowed multi-char key chord dispatcher (AutoCAD command-line pattern).
// Pure class — no React, fully unit-testable.
// Used by useDxfToolbarShortcuts to handle 2-char tool shortcuts (SL, OP, CL, BM).

export interface ChordDefinition {
  /** First key (uppercase), e.g. 'S', 'O', 'C', 'B' */
  firstKey: string;
  /** Second key (uppercase) that completes the chord, e.g. 'L', 'P', 'T', 'M' */
  secondKey: string;
  /** Action identifier dispatched when chord completes, e.g. 'tool:slab' */
  action: string;
}

export interface FallbackDefinition {
  /** First key (uppercase) */
  firstKey: string;
  /** Action dispatched when first key times out with no matching second key */
  action: string;
}

export type FeedResult =
  | { kind: 'chord-started' }
  | { kind: 'chord-completed'; action: string }
  /** Pending chord cancelled; fallbackAction dispatched (may be null). Caller should
   *  dispatch fallbackAction then fall-through to process the current key normally. */
  | { kind: 'fallback-fired'; fallbackAction: string | null }
  | { kind: 'miss' };

/**
 * Manages one pending first-key at a time.
 * onTimeout fires when a first-key window expires with no matching second key.
 */
export class MultiCharKeySequence {
  private pending: { firstKey: string; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(
    private readonly chords: readonly ChordDefinition[],
    private readonly fallbacks: readonly FallbackDefinition[],
    private readonly windowMs: number,
    /** Called on timer expiry — reads latest callbacks via a stable ref in the caller. */
    private readonly onTimeout: (action: string | null) => void,
  ) {}

  /**
   * Feed an uppercase key into the sequencer.
   * Returns a FeedResult describing what the caller should do next.
   */
  feed(key: string): FeedResult {
    // ── Pending chord resolution ──────────────────────────────────────────────
    if (this.pending) {
      const { firstKey } = this.pending;
      clearTimeout(this.pending.timer);
      this.pending = null;

      const chord = this.chords.find(c => c.firstKey === firstKey && c.secondKey === key);
      if (chord) {
        return { kind: 'chord-completed', action: chord.action };
      }

      // Key didn't complete the chord — return fallback for caller to dispatch
      const fb = this.fallbacks.find(f => f.firstKey === firstKey);
      return { kind: 'fallback-fired', fallbackAction: fb?.action ?? null };
    }

    // ── New chord start ───────────────────────────────────────────────────────
    const isLeader = this.chords.some(c => c.firstKey === key);
    if (!isLeader) return { kind: 'miss' };

    const firstKey = key;
    this.pending = {
      firstKey,
      timer: setTimeout(() => {
        if (this.pending?.firstKey !== firstKey) return;
        this.pending = null;
        const fb = this.fallbacks.find(f => f.firstKey === firstKey);
        this.onTimeout(fb?.action ?? null);
      }, this.windowMs),
    };
    return { kind: 'chord-started' };
  }

  hasPending(): boolean {
    return this.pending !== null;
  }

  destroy(): void {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending = null;
    }
  }
}
