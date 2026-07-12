/**
 * ACTIVE-BLOCK-EDIT STORE — AutoCAD «Block Editor» (BEDIT) session state (SSoT, zero React state).
 *
 * Structural mirror of {@link ActiveGroupStore} (ADR-575), but **single-level** (ADR-641): entering
 * a block replaces the whole canvas with that block's local-space members (an EXCLUSIVE editor), and
 * — unlike GROUP drill-in — blocks do NOT nest (import flattens nested INSERTs to primitives, ADR-640),
 * so there is ONE active block at a time, not a stack.
 *
 * Follows the {@link HoverStore}/{@link ActiveGroupStore} pattern: a mutable singleton with an optional
 * React subscription via useSyncExternalStore (see {@link useActiveBlockEdit}). Event-time consumers
 * (hit-test / click / Esc handlers) read the getters directly — never a stale React snapshot (ADR-040
 * dual-access invariant). Entering/exiting is plain state, NOT an undoable command (mirror
 * enterGroup/exitActiveGroup) — only the member EDITS inside the editor go through CommandHistory.
 *
 * ADR-641 §2 (exclusive scene-scope swap).
 */

// SSoT pub/sub cell (N.12 / ADR-294 module `create-external-store`) — no hand-rolled listener Set.
import { createExternalStore } from '../../stores/createExternalStore';

/**
 * The id of the currently-entered BlockEntity (its own container id), or null at the top level;
 * `name` is cached alongside so the breadcrumb/status leaf renders «Επεξεργασία μπλοκ «name»»
 * without re-resolving the block from the scene on every subscriber tick.
 */
interface ActiveBlockEditState {
  readonly id: string | null;
  readonly name: string | null;
}

const store = createExternalStore<ActiveBlockEditState>({ id: null, name: null });

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Enter the Block Editor for BlockEntity `blockId` (name `blockName` for the breadcrumb). No-op when
 * that block is already the active one, so a repeat double-click doesn't churn subscribers.
 */
export function enterBlockEdit(blockId: string, blockName: string): void {
  if (!blockId) return;
  if (store.get().id === blockId) return;
  store.set({ id: blockId, name: blockName });
}

/** Exit the Block Editor — back to the top scene level. No-op when not inside any block editor. */
export function exitBlockEdit(): void {
  if (store.get().id === null) return;
  store.set({ id: null, name: null });
}

// ─── Getters (snapshot-compatible for useSyncExternalStore) ──────────────────

/** The currently-entered block's container id, or `null` at the top scene level. */
export function getActiveBlockEditId(): string | null {
  return store.get().id;
}

/** The currently-entered block's name (for the breadcrumb), or `null` at the top level. */
export function getActiveBlockEditName(): string | null {
  return store.get().name;
}

/** True while a Block Editor session is open (exclusive canvas active). */
export function isBlockEditActive(): boolean {
  return store.get().id !== null;
}

// ─── Subscription (for useSyncExternalStore) ─────────────────────────────────

export function subscribeBlockEdit(cb: () => void): () => void {
  return store.subscribe(cb);
}
