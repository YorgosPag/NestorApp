/**
 * ADR-501 Slice 2 — Grip marquee arming (pure).
 *
 * AutoCAD/Revit "hot grips": when an entity is selected (its grips are visible),
 * dragging a window/marquee over the grips ARMS the ones that fall inside (orange)
 * instead of selecting new entities. This module is the pure classifier + arm step
 * invoked by the marquee mouse-up handler.
 *
 * SSoT reuse — zero new geometry or arm logic:
 *  - {@link selectItemsInMarquee} classifies which grips fall in the screen box.
 *    Each grip is a POINT → passed as a 1-vertex item with `isCrossing = false`:
 *    for a point, window-containment IS point-in-rect, and that is the correct
 *    semantic for both window and crossing (a point cannot be "partially crossed";
 *    the polygon crossing path also requires ≥3 vertices, so it must not be used).
 *  - {@link GripArmedStore} holds the armed set: Shift = add to the set
 *    (`armMany`), plain = replace it (`clear` + `armMany`) — mirrors the Slice 1
 *    click semantics (plain = setOnly, Shift = toggle/add).
 *
 * Precedence: returns `true` (caller consumes the marquee) ONLY when ≥1 armable
 * grip is inside the box. With none inside, returns `false` so the caller falls
 * through to the unchanged entity-marquee — the box never "steals" an entity
 * selection the user intended elsewhere.
 *
 * @see systems/grip/ArmableGripsStore.ts — source of `armable`
 * @see systems/selection/universal-marquee-geometry.ts — `selectItemsInMarquee`
 * @see docs/centralized-systems/reference/adrs/ADR-501-dxf-grip-multi-arm-group-move.md
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { gripKey, type GripRef } from '../../rendering/grips/grip-temperature';
import { selectItemsInMarquee } from '../selection/universal-marquee-geometry';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { GripArmedStore } from './GripArmedStore';
import type { ArmableGrip } from './ArmableGripsStore';

/**
 * Classify which armable grips fall inside the marquee box and arm them.
 *
 * @param startScreen  marquee drag start (SCREEN coords — `cursor.selectionStart`)
 * @param endScreen    marquee drag end (SCREEN coords — `cursor.position`)
 * @param transform    active view transform (world↔screen)
 * @param viewport     canvas size (for world→screen of each grip)
 * @param isShift      Shift held → add to the armed set; else replace it
 * @param armable      current armable grips (from `ArmableGripsStore.getSnapshot()`)
 * @returns `true` when ≥1 grip was armed (consume the marquee); `false` otherwise.
 */
export function runGripMarqueeArm(
  startScreen: Point2D,
  endScreen: Point2D,
  transform: ViewTransform,
  viewport: Viewport,
  isShift: boolean,
  armable: readonly ArmableGrip[],
): boolean {
  if (armable.length === 0) return false;

  const screenBounds = {
    min: { x: Math.min(startScreen.x, endScreen.x), y: Math.min(startScreen.y, endScreen.y) },
    max: { x: Math.max(startScreen.x, endScreen.x), y: Math.max(startScreen.y, endScreen.y) },
  };

  const items = armable.map((g) => ({
    id: gripKey(g.entityId, g.gripIndex),
    vertices: [g.position],
  }));

  const hitKeys = new Set(
    selectItemsInMarquee(
      items,
      screenBounds,
      /* isCrossing */ false,
      TOLERANCE_CONFIG.HIT_TEST_FALLBACK,
      'GRIP',
      /* enableDebugLogs */ false,
      transform,
      viewport,
    ),
  );
  if (hitKeys.size === 0) return false;

  const refs: GripRef[] = armable
    .filter((g) => hitKeys.has(gripKey(g.entityId, g.gripIndex)))
    .map((g) => ({ entityId: g.entityId, gripIndex: g.gripIndex }));
  if (refs.length === 0) return false;

  if (!isShift) GripArmedStore.clear();
  GripArmedStore.armMany(refs);
  return true;
}
