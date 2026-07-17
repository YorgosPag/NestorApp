/**
 * GRIP → TOOL HANDOFF STORE — ADR-349 Phase 1c-B2 (base) + ADR-357 Phase 12 (extras)
 *
 * When a grip drag ends in `rotate` / `scale` / `mirror` mode, the grip system
 * pre-seeds the target tool's first required point (base point / first axis
 * point) so the user does not have to click it again. Each entry is consumed
 * exactly once by the tool hook on activation.
 *
 * ADR-357 Phase 12 — handoff payload extended with two optional modifiers:
 *   - `copyMode`  — when `true`, the downstream tool arms its copy intent and commits
 *                   through `createRotate/Scale/MirrorCommand({copy: true})`, which
 *                   routes to `CloneWithTransformCommand` (ADR-507 §8). This is UI
 *                   intent only — the transform commands themselves have no copy flag.
 *   - `refStart` / `refEnd` — when both present, the downstream tool fast-forwards
 *                             past its "Pick reference points" phases and lands
 *                             directly on the "Enter new length / angle" input
 *                             with the picked vector pre-loaded.
 *
 * These modifiers are produced by the grip right-click context menu actions
 * (`bindContextMenuAction` → `actionCopyToggle` / `actionReference`) before the
 * mode handoff fires, and consumed by `useScaleTool` / `useRotationTool` /
 * `useMirrorTool` on activation.
 *
 * @see GripCopyModeStore   — toggle SSoT
 * @see GripReferenceStore  — reference-pick SSoT (carries refStart/refEnd)
 * @see useScaleTool        — consumes `{ copyMode, refStart, refEnd }`
 * @see useRotationTool     — consumes `{ copyMode, refStart, refEnd }`
 * @see useMirrorTool       — consumes `{ copyMode }` (no reference for Mirror)
 */
import type { Point2D } from '../../rendering/types/Types';

type HandoffTool = 'rotate' | 'scale' | 'mirror';

export interface GripHandoffOptions {
  /** Start the downstream tool with its copy intent armed (→ `{copy: true}` at commit). */
  readonly copyMode?: boolean;
  /** First reference point (world space) — pre-loaded into the downstream tool's ref state. */
  readonly refStart?: Point2D;
  /** Second reference point (world space) — pre-loaded into the downstream tool's ref state. */
  readonly refEnd?: Point2D;
}

export interface GripHandoffPayload {
  readonly point: Point2D;
  readonly options: GripHandoffOptions;
}

let _pending: { tool: HandoffTool; payload: GripHandoffPayload } | null = null;

const EMPTY_OPTIONS: GripHandoffOptions = Object.freeze({});

export const GripHandoffStore = {
  /** Register a pending handoff. `options` defaults to no modifiers. */
  set(tool: HandoffTool, point: Point2D, options: GripHandoffOptions = EMPTY_OPTIONS): void {
    _pending = { tool, payload: { point, options } };
  },

  /**
   * Consume the pending handoff for `tool`. Returns `null` when no handoff is
   * registered or it targets a different tool. Returns the full payload
   * (`{ point, options }`) on hit so callers can read both the base point and
   * the Phase 12 modifiers (`copyMode`, `refStart`, `refEnd`).
   */
  consume(tool: HandoffTool): GripHandoffPayload | null {
    if (_pending?.tool !== tool) return null;
    const payload = _pending.payload;
    _pending = null;
    return payload;
  },

  /** Clear any stale entry (e.g. on Escape before tool activates). */
  clear(): void {
    _pending = null;
  },
} as const;
