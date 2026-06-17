/**
 * @module bim/grips/move-glyph-zone-store
 * @description SSoT for the move-handle arm currently under the cursor (ADR-397
 * Φ2, Giorgio 2026-06-17). When the cursor hovers ONE arm of an entity's 4-arrow
 * MOVE glyph, this store records WHICH entity + grip + zone, so the renderer can
 * light ONLY that arm (per-arm hover highlight) instead of warming the whole cross.
 *
 * Imperative module-singleton (mirrors `bim/grips/rotation-snap-store`, zero React):
 *  - Writer: `useUnifiedGripInteraction.handleMouseMove` classifies the cursor into
 *    a WORLD zone via `resolveMoveGlyphZoneForGrip` and calls `set(...)`; on leave
 *    it `clear()`s. It marks the DXF canvas dirty on every change so the highlight
 *    tracks the cursor between arms (the grip id does not change, so React hover
 *    state alone would not repaint).
 *  - Reader: `BaseEntityRenderer.renderGrips` reads `getHoveredZone(entityId,
 *    gripIndex)` and maps it to the drawn local arm (`worldZoneToLocalArm`).
 *
 * The stored zone is in the entity's WORLD frame (the canonical SSoT shared with
 * the directional-move click) — the renderer applies the screen Y-flip mapping.
 *
 * @see bim/grips/move-glyph-zones.ts — resolveMoveGlyphZoneForGrip / worldZoneToLocalArm
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md
 */

import type { MoveGlyphZone } from './move-glyph-zones';

interface HoveredMoveZone {
  readonly entityId: string;
  readonly gripIndex: number;
  /** Zone in the entity's WORLD frame (`'x+'`/`'x-'`/`'y+'`/`'y-'`/`'center'`). */
  readonly zone: MoveGlyphZone;
}

class MoveGlyphZoneStoreClass {
  private hovered: HoveredMoveZone | null = null;

  /**
   * Record the move-glyph zone under the cursor. Returns `true` when the value
   * actually changed (entity / grip / zone), so the caller repaints only on change.
   */
  set(entityId: string, gripIndex: number, zone: MoveGlyphZone): boolean {
    const h = this.hovered;
    if (h && h.entityId === entityId && h.gripIndex === gripIndex && h.zone === zone) {
      return false;
    }
    this.hovered = { entityId, gripIndex, zone };
    return true;
  }

  /** Drop the hover. Returns `true` if something was cleared (for change-gated repaint). */
  clear(): boolean {
    if (!this.hovered) return false;
    this.hovered = null;
    return true;
  }

  /**
   * The WORLD-frame zone hovered for `entityId`/`gripIndex`, or `null` when that
   * grip is not the one under the cursor.
   */
  getHoveredZone(entityId: string, gripIndex: number): MoveGlyphZone | null {
    const h = this.hovered;
    return h && h.entityId === entityId && h.gripIndex === gripIndex ? h.zone : null;
  }
}

/** Global singleton — one cursor, one hovered move arm at a time. */
export const MoveGlyphZoneStore = new MoveGlyphZoneStoreClass();
