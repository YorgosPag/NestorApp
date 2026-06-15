/**
 * MODAL PRESENCE DETECTION — pure DOM scan (SSoT, ADR-040 cursor-lag Φ6).
 *
 * A modal/dialog in this app is a full-screen overlay (`fixed inset-0`) portaled
 * to `document.body` with a high z-index (Radix `Dialog.Portal`, `PromptDialog`
 * `createPortal`). This detects whether any such overlay is currently open.
 *
 * Pure (takes `doc`/`win`), so it is unit-testable and has a single definition —
 * the previous copy-pasted scan lived inline in `CentralizedAutoSaveStatus`
 * (×2) and re-ran on EVERY body mutation (i.e. on every crosshair `style`
 * write), which was a per-mousemove `querySelectorAll` + `getComputedStyle`
 * reflow storm. The scan now runs only when a modal actually mounts/unmounts.
 *
 * @module systems/modal/modal-presence-detect
 */

/** Tailwind full-screen overlay signature shared by every modal backdrop. */
export const MODAL_OVERLAY_SELECTOR = '[class*="fixed"][class*="inset-0"]';

/** Minimum z-index that qualifies an overlay as a modal (not a passive layer). */
export const MODAL_Z_INDEX_THRESHOLD = 50;

/** True if any qualifying modal overlay is currently visible in the document. */
export function detectOpenModal(doc: Document, win: Window): boolean {
  const overlays = doc.querySelectorAll(MODAL_OVERLAY_SELECTOR);
  for (let i = 0; i < overlays.length; i++) {
    const style = win.getComputedStyle(overlays[i]);
    const zIndex = parseInt(style.zIndex || '0', 10);
    if (zIndex >= MODAL_Z_INDEX_THRESHOLD && style.display !== 'none') {
      return true;
    }
  }
  return false;
}
