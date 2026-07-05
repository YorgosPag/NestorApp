/**
 * GRIP REFERENCE STORE — ADR-357 Phase 12 / G10 extras
 *
 * Pub/sub micro-leaf SSoT for AutoCAD-style "Reference" picker driven from the
 * grip right-click context menu. When the user is in `scale` or `rotate` grip
 * mode and chooses "Reference", the store walks through a deterministic 3-step
 * flow:
 *
 *   idle
 *     → user clicks "Reference" in context menu
 *   pick-first   — prompt: "Pick first reference point" (status bar override)
 *     → canvas click captures `refStart`
 *   pick-second  — prompt: "Pick second reference point"
 *     → canvas click captures `refEnd`, computes reference length / angle
 *   awaiting-value — handoff to the downstream tool (Scale or Rotate) which
 *                    takes over via `GripHandoffStore` with `reference: true`
 *                    and reads `refStart` / `refEnd` to pre-fill its ref state.
 *
 * The downstream tool finishes the flow (asks for "new length" / "new angle"
 * via its existing DynamicInput / status bar) — this store only carries the
 * two picked points across the handoff.
 *
 * ADR-040 compliant: LOW-frequency transitions (one per click).
 *
 * Industry reference: AutoCAD `Reference` subcommand on Scale (`R`) and Rotate
 * (`R`) — accepts 2 picked points + 1 numeric to derive scale factor / angle.
 *
 * @see useUnifiedGripInteraction — intercepts pick clicks during phases ≠ idle
 * @see useScaleTool / useRotationTool — consume the handoff and finish the flow
 * @see GripHandoffStore — carries `reference: true` + the anchor across tools
 */
import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

export type GripReferenceMode = 'scale' | 'rotate';

export type GripReferencePhase =
  | 'idle'
  | 'pick-first'
  | 'pick-second'
  | 'awaiting-value';

export interface GripReferenceSnapshot {
  readonly phase: GripReferencePhase;
  readonly mode: GripReferenceMode | null;
  readonly refStart: Point2D | null;
  readonly refEnd: Point2D | null;
}

const IDLE_SNAPSHOT: GripReferenceSnapshot = Object.freeze({
  phase: 'idle',
  mode: null,
  refStart: null,
  refEnd: null,
});

type Listener = () => void;

class GripReferenceStoreImpl {
  private readonly store = createExternalStore<GripReferenceSnapshot>(IDLE_SNAPSHOT);

  getSnapshot = (): GripReferenceSnapshot => this.store.get();

  subscribe = (listener: Listener): (() => void) => this.store.subscribe(listener);

  /** Start the reference flow for the current grip mode (scale or rotate). */
  startPick(mode: GripReferenceMode): void {
    this.store.set(Object.freeze({
      phase: 'pick-first',
      mode,
      refStart: null,
      refEnd: null,
    }));
  }

  /** Capture the first reference point — advances to `pick-second`. */
  setRefStart(point: Point2D): void {
    if (this.store.get().phase !== 'pick-first') return;
    this.store.set(Object.freeze({
      phase: 'pick-second',
      mode: this.store.get().mode,
      refStart: { x: point.x, y: point.y },
      refEnd: null,
    }));
  }

  /** Capture the second reference point — advances to `awaiting-value`. */
  setRefEnd(point: Point2D): void {
    if (this.store.get().phase !== 'pick-second') return;
    this.store.set(Object.freeze({
      phase: 'awaiting-value',
      mode: this.store.get().mode,
      refStart: this.store.get().refStart,
      refEnd: { x: point.x, y: point.y },
    }));
  }

  /** Reset to idle (Escape / session end / handoff consumed). */
  clear(): void {
    if (this.store.get() === IDLE_SNAPSHOT) return;
    this.store.set(IDLE_SNAPSHOT);
  }
}

export const GripReferenceStore = new GripReferenceStoreImpl();
