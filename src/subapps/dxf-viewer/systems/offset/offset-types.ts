/**
 * OFFSET TYPES — ADR-510 Φ4d
 *
 * Shared types for the AutoCAD-style OFFSET modify tool. Mirrors the trim-types
 * pattern (discriminated state) but the offset tool is simpler: it only ever
 * ADDS one parallel copy per commit (optionally erasing the source), so there is
 * no per-pick operation union — the command carries the finished copy directly.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4d
 */

import type { Entity } from '../../types/entities';

/** Below this the offset copy is considered degenerate (collapsed radius / zero-length). */
export const OFFSET_MIN_DIMENSION = 1e-6;

/**
 * Tool phases (Revit/Figma-style «άμεσο» UX, Giorgio 2026-07-04):
 *   picking-source → user hovers/clicks the entity to offset
 *   picking-side   → live ghost follows the cursor; click commits, ENTER/ESC exits
 */
export type OffsetPhase = 'picking-source' | 'picking-side';

/** Non-React tool state held in the OffsetToolStore (mirror of TrimToolStore). */
export interface OffsetToolState {
  readonly phase: OffsetPhase;
  /**
   * The picked source entity snapshot (null while picking-source). Held as the
   * whole entity — the preview offsets it against the live cursor at 60fps and
   * the command needs it for erase-mode undo, so a scene lookup per frame is avoided.
   */
  readonly source: Entity | null;
  /**
   * Locked numeric distance typed by the user (absolute value, world units).
   * `null` ⇒ distance is cursor-driven. The SIDE always comes from the cursor.
   */
  readonly typedDistance: number | null;
  /** In-progress digit buffer for numeric distance entry (e.g. "20", "20.5"). */
  readonly typedBuffer: string;
  /** AutoCAD OFFSET «Erase» option — delete the source after offsetting. */
  readonly eraseSource: boolean;
  /** Last committed absolute distance, remembered as the default for the next pick. */
  readonly lastDistance: number;
}
