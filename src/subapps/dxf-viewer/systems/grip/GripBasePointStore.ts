/**
 * GRIP BASE POINT STORE — ADR-357 Phase 12 / G10 extras
 *
 * Pub/sub micro-leaf SSoT for AutoCAD-style "Base Point" override during an
 * active grip drag. When the user selects "Base Point" from the right-click
 * grip context menu, the next canvas click sets `overrideAnchor` and the
 * commit math (`commitDxfGripDragModeAware`) uses it in place of
 * `grip.position` as the drag origin.
 *
 * Lifecycle (per drag session):
 *   - `armBasePointPick()` — user picks "Base Point" → `pickPhase = 'awaiting-click'`
 *   - next canvas click (handled in `useUnifiedGripInteraction`) → consumed as
 *     base-point pick → `overrideAnchor = clickPos`, `pickPhase = 'idle'`
 *   - subsequent mouseMove/mouseUp use `overrideAnchor` as anchor
 *   - drag ends or session resets → `clear()` zeroes everything
 *
 * ADR-040 compliant: LOW-frequency transitions (one per user action), the only
 * reader at 60fps is the commit math which reads via `getSnapshot()` not via
 * `useSyncExternalStore`. No React state, no orchestrator subscription.
 *
 * Industry reference: AutoCAD / BricsCAD / progeCAD `Base Point` grip extra —
 * re-anchors the drag origin without aborting the active grip mode.
 *
 * @see GripContextMenuStore — surfaces the "Base Point" menu entry
 * @see useUnifiedGripInteraction — intercepts the pick click
 * @see commitDxfGripDragModeAware — reads `overrideAnchor` at commit time
 */
import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

export type GripBasePointPickPhase = 'idle' | 'awaiting-click';

export interface GripBasePointSnapshot {
  readonly pickPhase: GripBasePointPickPhase;
  readonly overrideAnchor: Point2D | null;
}

const CLEARED_SNAPSHOT: GripBasePointSnapshot = Object.freeze({
  pickPhase: 'idle',
  overrideAnchor: null,
});

type Listener = () => void;

class GripBasePointStoreImpl {
  private readonly store = createExternalStore<GripBasePointSnapshot>(CLEARED_SNAPSHOT);

  getSnapshot = (): GripBasePointSnapshot => this.store.get();

  subscribe = (listener: Listener): (() => void) => this.store.subscribe(listener);

  /** User selected "Base Point" — arm the next-click capture. */
  armBasePointPick(): void {
    if (this.store.get().pickPhase === 'awaiting-click') return;
    this.store.set(Object.freeze({
      pickPhase: 'awaiting-click',
      overrideAnchor: this.store.get().overrideAnchor,
    }));
  }

  /** Pick consumed — record the new anchor and return to idle. */
  setOverrideAnchor(point: Point2D): void {
    this.store.set(Object.freeze({
      pickPhase: 'idle',
      overrideAnchor: { x: point.x, y: point.y },
    }));
  }

  /** Reset both pickPhase and overrideAnchor (drag end / session reset). */
  clear(): void {
    if (this.store.get() === CLEARED_SNAPSHOT) return;
    this.store.set(CLEARED_SNAPSHOT);
  }
}

export const GripBasePointStore = new GripBasePointStoreImpl();
