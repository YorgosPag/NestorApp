/**
 * ENTITY BODY-DRAG STORE — ADR (Entity Body-Drag: move / Ctrl-copy)
 *
 * Vanilla singleton SSoT for the AutoCAD/Figma-style **body drag** gesture:
 * grabbing an entity ANYWHERE on its body (not on a grip) in select mode and
 * dragging it. Without a modifier the gesture MOVES the entity; with Ctrl/⌘ held
 * at press it COPIES (clone-at-destination, original preserved).
 *
 * Lifecycle (per drag session):
 *   - mousedown over a selected/hovered entity body → `arm({ anchor, entityIds, copy })`
 *     (the `copy` flag is FROZEN at press time from `CtrlKeyTracker`, so releasing
 *     Ctrl mid-drag does not change the gesture — mirror of `GripAltMoveStore`)
 *   - mousemove → the live ghost (`useEntityBodyDragPreview`) reads `getActive()` +
 *     `getAnchor()` and draws the translated copies at `cursor − anchor`
 *   - mouseup → the commit (`mouse-handler-up`) reads the snapshot, builds the
 *     move/copy command, then `clear()`
 *   - ESC / cancel → `clear()` with no commit
 *
 * ADR-040 compliant: LOW-frequency transitions (one arm + one clear per drag).
 * The 60fps readers (ghost + commit) read via getters, NOT `useSyncExternalStore`.
 *
 * Sibling of {@link GripAltMoveStore} (grip "move-from-characteristic-point").
 *
 * @see hooks/tools/useEntityBodyDragPreview.ts — live ghost reader
 * @see systems/cursor/useCentralizedMouseHandlers.ts — arms on body mousedown
 * @see systems/cursor/mouse-handler-up.ts — commits move/copy on mouseup
 */

import type { Point2D } from '../../rendering/types/Types';
import { escapeBus } from '../escape-bus/EscapeCommandBus';
import { ESC_PRIORITY } from '../escape-bus/escape-priority';
// ADR-560 / ADR-357 — drag lifecycle SSoT: the body-drag AutoAlign traces end with the drag
// (commit / ESC / blur), mirror of GripDragStore.clearActiveDragGrip → clearGripAlignmentTracking.
import { clearGripAlignmentTracking } from '../cursor/GripAlignmentTrackingStore';

export interface EntityBodyDragSession {
  /** World-space base point captured at mousedown (the grabbed point on the body). */
  readonly anchor: Point2D;
  /** Entity IDs that travel together for this drag (selection or hovered entity). */
  readonly entityIds: readonly string[];
  /** Frozen at press: Ctrl/⌘ held → clone-at-destination instead of move. */
  readonly copy: boolean;
}

type Listener = () => void;

class EntityBodyDragStoreImpl {
  private session: EntityBodyDragSession | null = null;
  private listeners = new Set<Listener>();
  private installed = false;
  private unregisterEscape: (() => void) | null = null;

  /**
   * Subscribe to arm/clear transitions (LOW-frequency — one per drag). Used by
   * the ghost leaf's `useSyncExternalStore` to mount/unmount the preview. The
   * 60fps cursor follow does NOT go through here (the ghost reads `getAnchor()`
   * inside its draw delegate).
   */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Begin a body-drag session. Overwrites any stale session. */
  arm(session: EntityBodyDragSession): void {
    this.session = session;
    this.emit();
  }

  /** Is a body-drag currently in progress? Read by the ghost + commit (cheap getter). */
  getActive(): boolean {
    return this.session !== null;
  }

  /** Base point grabbed at mousedown, or null when idle. */
  getAnchor(): Point2D | null {
    return this.session?.anchor ?? null;
  }

  /** Entities travelling in the active drag (empty when idle). */
  getEntityIds(): readonly string[] {
    return this.session?.entityIds ?? [];
  }

  /** Whether the active drag is a copy (Ctrl held at press). */
  isCopy(): boolean {
    return this.session?.copy === true;
  }

  /** Full snapshot of the active session, or null when idle. */
  getSession(): EntityBodyDragSession | null {
    return this.session;
  }

  /** End the session (drag commit / cancel / reset). */
  clear(): void {
    if (this.session === null) return;
    this.session = null;
    // ADR-560 — end the AutoAlign traces with the drag so a stale result never lingers.
    clearGripAlignmentTracking();
    this.emit();
  }

  /**
   * Idempotent install of cancel listeners — ESC key and window blur abort an
   * in-progress body-drag with no commit (mirror of GripAltMoveStore's blur
   * safety). ESC goes through the centralized Escape Command Bus (ADR-364) at
   * `BODY_DRAG` priority — `canHandle` gates on an active session so it only
   * claims ESC mid-drag and falls through otherwise. SSR-safe via the
   * `typeof window` guard.
   */
  install(): void {
    if (this.installed) return;
    if (typeof window === 'undefined') return;
    this.unregisterEscape = escapeBus.register({
      id: 'entity-body-drag',
      priority: ESC_PRIORITY.BODY_DRAG,
      canHandle: () => this.getActive(),
      handle: () => {
        this.clear();
        return true;
      },
    });
    window.addEventListener('blur', this.onBlur);
    this.installed = true;
  }

  private onBlur = (): void => {
    this.clear();
  };

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const EntityBodyDragStore = new EntityBodyDragStoreImpl();
EntityBodyDragStore.install();
