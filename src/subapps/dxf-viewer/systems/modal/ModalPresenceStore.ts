/**
 * MODAL PRESENCE STORE — SSoT for "is any modal/dialog open?" (ADR-040 cursor-lag Φ6).
 *
 * Zero-React singleton (same pattern as `HoverStore` / `ImmediatePositionStore`).
 * Components subscribe via `useModalPresence()`; the store owns detection.
 *
 * WHY THIS EXISTS — the cursor-lag root cause:
 * `CentralizedAutoSaveStatus` detected open modals with a `MutationObserver` on
 * `document.body` using `{ attributes: true, subtree: true }`. The compositor
 * crosshair writes `style.transform` on 6-8 promoted divs PER MOUSE MOVE, each an
 * attribute mutation inside the body subtree → the observer fired on every move,
 * re-running `querySelectorAll('.fixed.inset-0')` + `getComputedStyle()` (forced
 * reflow) + a React `setState`. That feedback loop — not the crosshair paint —
 * was the dominant per-move cost (profiler 2026-06-15: querySelectorAll 3.8%,
 * reflow ~4.3%, plus a React commit per move).
 *
 * THE FIX: every modal in this app is portaled to `document.body` (Radix
 * `Dialog.Portal`, `PromptDialog` `createPortal(_, document.body)`), so it mounts
 * / unmounts as a DIRECT child of `body`. Observing `body` with
 * `{ childList: true, subtree: false }` fires ONLY on modal open/close — never on
 * the crosshair `style` writes (attribute) or the coordinate readout
 * `textContent` writes (deep, not a direct body child). The scan therefore runs
 * a handful of times per session instead of ~60×/second.
 *
 * The observer is ref-counted: it attaches on the first subscriber and tears down
 * on the last, so it costs nothing when nothing is listening.
 *
 * @module systems/modal/ModalPresenceStore
 */

import { detectOpenModal } from './modal-presence-detect';

type ModalPresenceListener = () => void;

let isModalOpen = false;
const listeners = new Set<ModalPresenceListener>();
let observer: MutationObserver | null = null;

function setModalOpen(next: boolean): void {
  if (next === isModalOpen) return;
  isModalOpen = next;
  listeners.forEach((cb) => cb());
}

/** Re-detect modal presence. Runs on subscribe + on each body childList mutation. */
function scan(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  setModalOpen(detectOpenModal(document, window));
}

function startObserver(): void {
  if (observer || typeof document === 'undefined' || !document.body) return;
  scan();
  observer = new MutationObserver(scan);
  // subtree:false — modals portal to body as DIRECT children; this never fires
  // on the per-move crosshair/coordinate writes deeper in the tree.
  observer.observe(document.body, { childList: true, subtree: false });
}

function stopObserver(): void {
  observer?.disconnect();
  observer = null;
  isModalOpen = false;
}

/** Current snapshot — stable primitive, safe for `useSyncExternalStore`. */
export function getIsModalOpen(): boolean {
  return isModalOpen;
}

/** Subscribe to modal open/close. Lazily (de)activates the body observer. */
export function subscribeModalPresence(cb: ModalPresenceListener): () => void {
  if (listeners.size === 0) startObserver();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stopObserver();
  };
}

// ─── Test-only hooks (jsdom has no real portal lifecycle) ────────────────────
export function __setModalOpenForTest(next: boolean): void {
  setModalOpen(next);
}
export function __scanForTest(): void {
  scan();
}
export function __resetForTest(): void {
  stopObserver();
  listeners.clear();
  isModalOpen = false;
}
