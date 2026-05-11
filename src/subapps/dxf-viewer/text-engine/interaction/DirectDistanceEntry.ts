/**
 * ADR-344 Phase 6.C — Direct Distance Entry (DDE).
 *
 * AutoCAD-style numeric input during a grip drag. The user starts
 * dragging, presses digits / '.' / '-' / Backspace; on Enter or
 * commit() the typed value replaces the cursor-derived magnitude.
 *
 * Scope-narrow by design: the DDE manages only the buffered string and
 * its parsed value. The TextGripHandler interprets the value contextually
 * — distance for 'move', angle for 'rotation', size for 'resize-*'.
 *
 * Search confirmed: no pre-existing `DirectDistanceEntry` module in the
 * dxf-viewer subapp (grep checked `src/subapps/dxf-viewer/`).
 */

export type DDEStatus = 'idle' | 'buffering' | 'committed';

export interface DDESnapshot {
  readonly status: DDEStatus;
  readonly buffer: string;
  readonly value: number | null;
}

/**
 * Validate one keystroke against the digit alphabet. Returns the next
 * buffer string (or `null` if the keystroke should be rejected).
 */
function applyKey(buffer: string, key: string): string | null {
  if (key === 'Backspace') return buffer.slice(0, -1);
  if (key === '-') {
    if (buffer.length === 0) return '-';
    return null;
  }
  if (key === '.') {
    if (buffer.includes('.')) return null;
    return buffer + '.';
  }
  if (/^\d$/.test(key)) return buffer + key;
  return null;
}

function parseBuffer(buffer: string): number | null {
  if (!buffer || buffer === '-' || buffer === '.' || buffer === '-.') return null;
  const n = Number(buffer);
  return Number.isFinite(n) ? n : null;
}

export class DirectDistanceEntry {
  private buffer = '';
  private status: DDEStatus = 'idle';

  /** Begin a fresh buffering session. Resets any prior state. */
  begin(): void {
    this.buffer = '';
    this.status = 'buffering';
  }

  /**
   * Apply one keystroke. Returns `true` when the key was consumed
   * (the caller should `event.preventDefault()`), `false` otherwise.
   * No-op while in 'idle' status.
   */
  pressKey(key: string): boolean {
    if (this.status !== 'buffering') return false;
    const next = applyKey(this.buffer, key);
    if (next === null) return false;
    this.buffer = next;
    return true;
  }

  /**
   * Snapshot the current state. Safe to call any time; never throws.
   */
  snapshot(): DDESnapshot {
    return {
      status: this.status,
      buffer: this.buffer,
      value: parseBuffer(this.buffer),
    };
  }

  /**
   * Lock the buffer's value in. Returns the parsed numeric value, or
   * `null` if the buffer is empty / unparseable.
   */
  commit(): number | null {
    const value = parseBuffer(this.buffer);
    this.status = 'committed';
    return value;
  }

  /** Abandon the buffered session without committing. */
  cancel(): void {
    this.buffer = '';
    this.status = 'idle';
  }

  /** Reset to a clean idle state. */
  reset(): void {
    this.buffer = '';
    this.status = 'idle';
  }
}
