/**
 * ADR-364 — Escape Command Bus Types (DXF Viewer)
 *
 * Public type surface for the centralized Escape key dispatcher.
 * See `EscapeCommandBus.ts` for the singleton implementation.
 */

/**
 * Handler contract for a single ESC consumer.
 *
 * Registration is idempotent by `id` — re-registering with the same id
 * replaces the previous entry (lets React strict-mode double-effects
 * settle to a single live handler).
 */
export interface EscapeHandler {
  /** Stable identifier (kebab-case, namespaced — e.g. `modify-tool/trim`). */
  readonly id: string;

  /**
   * Priority — higher value runs first.
   * Use constants from `escape-priority.ts` (ESC_PRIORITY.*) — never raw numbers.
   */
  readonly priority: number;

  /**
   * Gate: return true when this handler is currently the rightful owner of ESC.
   * MUST be cheap and side-effect free (called inside the keydown hot path).
   */
  readonly canHandle: () => boolean;

  /**
   * Side-effect: consume the ESC press.
   * Return `true` when the press was consumed (bus calls preventDefault +
   * stopPropagation, lower-priority handlers do NOT run); return `false` to
   * fall through to the next eligible handler.
   */
  readonly handle: () => boolean;

  /**
   * When true, the handler still runs even if focus is in an editable element
   * (INPUT / TEXTAREA / contentEditable). Defaults to false — the bus
   * defers to native browser behaviour for editable focus targets.
   *
   * Used by Dynamic Input + Canvas Numeric Input which OWN editable-time ESC.
   */
  readonly allowWhenEditable?: boolean;
}

/**
 * Debug snapshot returned by `escapeBus.inspect()` (dev tooling).
 */
export interface EscapeBusInspection {
  readonly handlerCount: number;
  readonly handlers: ReadonlyArray<{
    readonly id: string;
    readonly priority: number;
    readonly allowWhenEditable: boolean;
  }>;
}

/**
 * Result of an internal dispatch — exposed for the test suite.
 * `consumedBy` is the handler id that returned true, or `null` if no handler
 * consumed the press.
 */
export interface EscapeDispatchResult {
  readonly consumed: boolean;
  readonly consumedBy: string | null;
}
