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
  private snapshot: GripSessionUndoSnapshot = CLEARED_SNAPSHOT;
  private listeners = new Set<Listener>();

  getSnapshot = (): GripSessionUndoSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Begin a grip-hot session — record the baseline history size. */
  markSessionStart(initialHistorySize: number): void {
    if (this.snapshot.sessionStartSize !== null) {
      // Already active — only refresh currentSize so the resolver re-evaluates.
      if (this.snapshot.currentSize === initialHistorySize) return;
      this.snapshot = Object.freeze({
        sessionStartSize: this.snapshot.sessionStartSize,
        currentSize: initialHistorySize,
      });
      this.emit();
      return;
    }
    this.snapshot = Object.freeze({
      sessionStartSize: initialHistorySize,
      currentSize: initialHistorySize,
    });
    this.emit();
  }

  /** Notify the store of a new history size (after a commit or external undo). */
  reportHistorySize(currentSize: number): void {
    if (this.snapshot.currentSize === currentSize) return;
    this.snapshot = Object.freeze({
      sessionStartSize: this.snapshot.sessionStartSize,
      currentSize,
    });
    this.emit();
  }

  /** Whether a session-level undo is available (commands produced this session). */
  canSessionUndo(): boolean {
    const s = this.snapshot;
    return s.sessionStartSize !== null && s.currentSize > s.sessionStartSize;
  }

  /** End the session (selection change / Escape to idle). */
  clear(): void {
    if (this.snapshot === CLEARED_SNAPSHOT) return;
    this.snapshot = CLEARED_SNAPSHOT;
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const GripSessionUndoStore = new GripSessionUndoStoreImpl();
