/**
 * @module systems/prompt-dialog/prompt-dialog-store
 * @description Centralized store for a reusable numeric/text input dialog.
 *
 * Follows the same singleton + observer pattern as `GuideStore` and `CursorStore`.
 * Any tool or hook can call `PromptDialogStore.prompt(options)` to show
 * a dialog and receive the result as a `Promise<string | null>`.
 *
 * The dialog is rendered once at the top of the canvas tree — only the
 * overlay component subscribes to state changes via `useSyncExternalStore`.
 *
 * @see ADR-189 (Construction Grid & Guide System — parallel guide distance input)
 * @since 2026-02-20
 */

import { createExternalStore } from '../../stores/createExternalStore';

// ============================================================================
// TYPES
// ============================================================================

/** Options for opening a prompt dialog */
export interface PromptDialogOptions {
  /** Window title */
  title: string;
  /** Input field label */
  label: string;
  /** Placeholder text inside the input */
  placeholder?: string;
  /** Default value pre-filled in the input */
  defaultValue?: string;
  /** Unit suffix displayed after the input (e.g. "mm", "°", "m") */
  unit?: string;
  /** Input type — 'number' validates numeric, 'text' allows anything */
  inputType?: 'number' | 'text';
  /** Confirm button text override */
  confirmText?: string;
  /** Cancel button text override */
  cancelText?: string;
  /**
   * Optional validation function.
   * Returns `null` if value is valid, or an error message string if invalid.
   */
  validate?: (value: string) => string | null;
}

/** Internal state snapshot exposed to React */
export interface PromptDialogSnapshot {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Current options (null when closed) */
  options: PromptDialogOptions | null;
}

type Listener = () => void;

// ============================================================================
// STORE
// ============================================================================

/**
 * Singleton store managing a single prompt dialog instance.
 *
 * Usage from any hook:
 * ```ts
 * const store = getPromptDialogStore();
 * const result = await store.prompt({ title: '...', label: '...' });
 * if (result !== null) { ... }
 * ```
 */
export class PromptDialogStore {
  // ── State ──
  private _isOpen = false;
  private _options: PromptDialogOptions | null = null;
  private _resolve: ((value: string | null) => void) | null = null;

  // ── Snapshot (immutable per change for useSyncExternalStore) — SSoT pub/sub via
  // createExternalStore (WAVE 2.6). No `equals` — the store always publishes a
  // fresh snapshot object, matching the hand-rolled store's unconditional notify.
  private readonly _store = createExternalStore<PromptDialogSnapshot>({ isOpen: false, options: null });

  // ── Public API ──

  /**
   * Open a prompt dialog and return the user's input.
   * Resolves with the entered string, or `null` if cancelled.
   *
   * Only one dialog can be open at a time — calling `prompt()` while
   * another is open will cancel the previous one (resolves `null`).
   */
  prompt(options: PromptDialogOptions): Promise<string | null> {
    // Cancel any existing dialog
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }

    return new Promise<string | null>((resolve) => {
      this._resolve = resolve;
      this._isOpen = true;
      this._options = options;
      this._publishSnapshot();
    });
  }

  /**
   * Confirm the dialog with the given value.
   * Called by the PromptDialog component when user presses Enter or clicks OK.
   */
  confirm(value: string): void {
    if (this._resolve) {
      this._resolve(value);
      this._resolve = null;
    }
    this._close();
  }

  /**
   * Cancel the dialog (Escape or backdrop click).
   * Resolves the promise with `null`.
   */
  cancel(): void {
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
    this._close();
  }

  // ── Subscription (useSyncExternalStore compatible) ──

  subscribe(listener: Listener): () => void {
    return this._store.subscribe(listener);
  }

  getSnapshot(): PromptDialogSnapshot {
    return this._store.get();
  }

  // ── Internals ──

  private _close(): void {
    this._isOpen = false;
    this._options = null;
    this._publishSnapshot();
  }

  private _publishSnapshot(): void {
    this._store.set({
      isOpen: this._isOpen,
      options: this._options,
    });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _instance: PromptDialogStore | null = null;

/** Get the global PromptDialogStore singleton */
export function getPromptDialogStore(): PromptDialogStore {
  if (!_instance) {
    _instance = new PromptDialogStore();
  }
  return _instance;
}
