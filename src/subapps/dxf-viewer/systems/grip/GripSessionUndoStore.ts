/**
 * GRIP SESSION UNDO STORE — ADR-357 Phase 12 / G10 extras
 *
 * Pub/sub micro-leaf SSoT for AutoCAD-style session-scoped "Undo" inside the
 * grip right-click context menu. Distinct from the global `Ctrl+Z`:
 *
 *   - Global Ctrl+Z (`useCommandHistory`) — unrestricted, can undo work from
 *     any time in the canvas lifetime, including pre-grip-session work.
 *   - Session Undo (this store)            — bounded to commands produced
 *     during the current grip-hot session (from the moment the user first
 *     grabs a hot grip on the current selection to the moment they exit
 *     grip mode via Escape / selection change).
 *
 * The store does NOT maintain its own command stack. Instead it records the
 * `CommandHistory` undo-stack size when the session begins. Session Undo is
 * "available" iff `currentSize > sessionStartSize`, and "undo" just delegates
 * to `CommandHistory.undo()` (which already knows how to rewind the last
 * command). This avoids any duplication of the audited Command pattern.
 *
 * Lifecycle:
 *   - First grip-hot drag of a selection → `markSessionStart(initialSize)`
 *   - Each commit pushes to CommandHistory; `currentHistorySize` advances
 *   - Session Undo button enabled while `currentSize > sessionStartSize`
 *   - Selection change / Escape-to-idle → `clear()`
 *
 * ADR-040 compliant: LOW-frequency transitions (session start / Escape).
 *
 * Industry reference: AutoCAD grip-extra `Undo` — multi-step rollback within
 * the active grip-hot session, not the global drawing undo.
 *
 * @see useCommandHistory       — global command undo/redo
 * @see useUnifiedGripInteraction — calls markSessionStart on first drag
 * @see grip-context-menu-actions — wires `sessionUndo` to `CommandHistory.undo`
 */

import { createExternalStore } from '../../stores/createExternalStore';

export interface GripSessionUndoSnapshot {
  /** History size at session start — null when no session is active. */
  readonly sessionStartSize: number | null;
  /** Current history size — used by resolver to decide `disabled` state. */
  readonly currentSize: number;
}

const CLEARED_SNAPSHOT: GripSessionUndoSnapshot = Object.freeze({
  sessionStartSize: null,
  currentSize: 0,
});

type Listener = () => void;

class GripSessionUndoStoreImpl {
  private readonly store = createExternalStore<GripSessionUndoSnapshot>(CLEARED_SNAPSHOT);

  getSnapshot = (): GripSessionUndoSnapshot => this.store.get();

  subscribe = (listener: Listener): (() => void) => this.store.subscribe(listener);

  /** Begin a grip-hot session — record the baseline history size. */
  markSessionStart(initialHistorySize: number): void {
    if (this.store.get().sessionStartSize !== null) {
      // Already active — only refresh currentSize so the resolver re-evaluates.
      if (this.store.get().currentSize === initialHistorySize) return;
      this.store.set(Object.freeze({
        sessionStartSize: this.store.get().sessionStartSize,
        currentSize: initialHistorySize,
      }));
      return;
    }
    this.store.set(Object.freeze({
      sessionStartSize: initialHistorySize,
      currentSize: initialHistorySize,
    }));
  }

  /** Notify the store of a new history size (after a commit or external undo). */
  reportHistorySize(currentSize: number): void {
    if (this.store.get().currentSize === currentSize) return;
    this.store.set(Object.freeze({
      sessionStartSize: this.store.get().sessionStartSize,
      currentSize,
    }));
  }

  /** Whether a session-level undo is available (commands produced this session). */
  canSessionUndo(): boolean {
    const s = this.store.get();
    return s.sessionStartSize !== null && s.currentSize > s.sessionStartSize;
  }

  /** End the session (selection change / Escape to idle). */
  clear(): void {
    if (this.store.get() === CLEARED_SNAPSHOT) return;
    this.store.set(CLEARED_SNAPSHOT);
  }
}

export const GripSessionUndoStore = new GripSessionUndoStoreImpl();
