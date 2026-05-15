/**
 * ADR-349 Phase 1c-B2: Grip → Tool Handoff Store
 *
 * When a grip drag ends in rotate/scale/mirror mode, the grip system pre-seeds
 * the target tool's first required point (base-point / first-axis-point) so the
 * user does not have to click it again.  Each entry is consumed exactly once by
 * the tool hook on activation.
 */
import type { Point2D } from '../../rendering/types/Types';

type HandoffTool = 'rotate' | 'scale' | 'mirror';

let _pending: { tool: HandoffTool; point: Point2D } | null = null;

export const GripHandoffStore = {
  set(tool: HandoffTool, point: Point2D): void {
    _pending = { tool, point };
  },

  consume(tool: HandoffTool): Point2D | null {
    if (_pending?.tool !== tool) return null;
    const pt = _pending.point;
    _pending = null;
    return pt;
  },

  /** Clear any stale entry (e.g. on Escape before tool activates). */
  clear(): void {
    _pending = null;
  },
} as const;
