/**
 * resolveRepeatedClickCycle — ADR-659 D1/D2 (ArchiCAD-style repeated-click disambiguation).
 *
 * SSoT «brain» for overlap disambiguation on a plain left-click. Keeps the mouse-up
 * handler thin (mirror of `handleStairClickInto2D`): a boolean gate that runs BEFORE the
 * normal top-1 `onEntitySelect`.
 *
 *   1st click on a stack (≥2 under cursor) → ARM (record point + candidates), return false
 *     → caller proceeds with the normal top-1 selection (fast path untouched).
 *   2nd+ click on the SAME point            → advance the cycle, select that candidate,
 *     open the popover synced to it, pre-highlight it on the canvas, return true (consume).
 *
 * ADR-040: pre-highlight goes through `HoverStore` (zero-React-state); `hitTestAll` runs
 * only at click time (never a high-freq path).
 */

// ADR-659 fix — use the LIVE registry hit-testing instance (fed by the render loop's
// updateScene), NOT the zombie exported singleton which never receives a scene.
import { serviceRegistry } from '../../services/ServiceRegistry';
import { SelectionCyclingStore, buildCandidatesFromHits, type EntityResolver } from './SelectionCyclingStore';
import { setHoveredEntity } from '../hover/HoverStore';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

/** Max pointer travel (px) for two clicks to count as the «same point» (AutoCAD pickbox-grade). */
export const SAME_POINT_THRESHOLD_PX = 4;

export interface RepeatedClickCycleParams {
  /** Canvas-relative screen position of the click (cursor.position). */
  readonly screenPos: Point2D;
  /** Page-level client coords for the popover anchor. */
  readonly clientX: number;
  readonly clientY: number;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  /** Shift/Ctrl/Cmd click → multi-select; bypass cycling entirely. */
  readonly additive: boolean;
  /** Canonical replace-select-by-id (wired to `replaceEntitySelection`). */
  readonly selectEntityById: (id: string) => void;
  /**
   * Optional entity lookup (`scene.entities.find` by id) so the popover row can show
   * a semantic label (slab role/thickness/elevation) instead of the raw entity-type +
   * internal level id. Threaded straight into `buildCandidatesFromHits` — ADR-040:
   * the lookup happens ONCE here, at click time, never per popover render.
   */
  readonly resolveEntity?: EntityResolver;
}

/**
 * @returns true when the click was consumed as a cycle step (2nd+ click same point);
 *          false → caller runs the normal top-1 selection (1st click / new point / <2 hits).
 */
export function resolveRepeatedClickCycle(p: RepeatedClickCycleParams): boolean {
  if (p.additive) {
    SelectionCyclingStore.clearArmed();
    return false;
  }

  const hits = serviceRegistry.get('hit-testing').hitTestAll(p.screenPos, p.transform, p.viewport);
  const candidates = buildCandidatesFromHits(hits, p.resolveEntity);

  // Not a stack → nothing to disambiguate. Let the normal top-1 path run.
  if (candidates.length < 2) {
    SelectionCyclingStore.clearArmed();
    return false;
  }

  // 2nd+ click on the same point → advance + open popover + pre-highlight + select.
  if (SelectionCyclingStore.matchesArmedPoint(p.screenPos.x, p.screenPos.y, SAME_POINT_THRESHOLD_PX)) {
    const current = SelectionCyclingStore.advanceArmed();
    if (current) {
      SelectionCyclingStore.startCycling(
        SelectionCyclingStore.getArmedCandidates(),
        p.clientX,
        p.clientY,
        SelectionCyclingStore.getArmedIndex(),
      );
      setHoveredEntity(current.id);
      p.selectEntityById(current.id);
      return true;
    }
  }

  // 1st click on this stack → arm for a potential 2nd click; normal top-1 select proceeds.
  SelectionCyclingStore.armFromClick(candidates, p.screenPos.x, p.screenPos.y);
  return false;
}
