/**
 * ADR-612 — Opening Info Tag grip SSoT (pure helpers).
 *
 * The SINGLE source both grip paths consume so they can never diverge (mirror
 * `bim/scale-bar/scale-bar-grips.ts` ↔ its renderer / commit):
 *   - `computeDxfEntityGrips` (GRIP_PRODUCERS['opening-info-tag']) → interaction + hit-testing.
 *   - the on-canvas 2D grip painting.
 *
 * Wall-parity grips (Giorgio 2026-07-09 — «όπως ο τοίχος»), ALL positioned from
 * the DERIVED geometry (`computeOpeningInfoTagGeometry`) — never from raw params —
 * so the handles track the real box (grip positions read from geometry, ADR-587):
 *   0 → MOVE cross @ the box CENTRE (`'opening-info-tag-move'`, `movesEntity` →
 *       whole-entity translate of `position`; the SAME 4-arrow MOVE glyph a wall
 *       renders via `grip-glyph-registry`).
 *   1 → ROTATION handle @ the midpoint of the TOP long edge, ON the edge itself
 *       (`openingInfoTagFrameToWorld(entity, 0, halfHeight)`, curved glyph — same
 *       as the wall). Giorgio: «το σημάδι περιστροφής να πέφτει επάνω στη μέση
 *       μιας από τις 2 μεγάλες πλευρές». Drag writes `angleRad` ONLY (swept-angle
 *       SSoT, placement-agnostic).
 *   2..5 → SIZE handles @ the FOUR box corners (`worldCorners`, all tagged
 *       `'opening-info-tag-size'`, wall-parity corner resize — NO mid-edge
 *       handles). Dragging ANY corner re-derives `widthMm` from that corner's
 *       local `u`; height auto-derives from the LOCKED 3:2 aspect and the box
 *       stays centred on `position`.
 *
 * The commit / ghost drag math lives in {@link applyOpeningInfoTagGripDrag} (the
 * SAME helper the parametric commit + the live ghost run → preview ≡ commit by
 * identity).
 *
 * @see bim/scale-bar/scale-bar-grips.ts — the sibling grip template
 * @see bim/opening-info-tag/opening-info-tag-geometry.ts — the derived geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-612-opening-info-tag.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, OpeningInfoTagGripKind } from '../../hooks/grip-types';
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';
import {
  computeOpeningInfoTagGeometry,
  openingInfoTagFrameToWorld,
  openingInfoTagWorldToFrame,
} from './opening-info-tag-geometry';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotateEntityGripDrag } from '../grips/grip-math';

/** The opening-info-tag grip kinds (distinct literals routed by `PARAMETRIC_COMMIT_HANDLERS`). */
export const OPENING_INFO_TAG_MOVE_KIND: OpeningInfoTagGripKind = 'opening-info-tag-move';
export const OPENING_INFO_TAG_ROTATION_KIND: OpeningInfoTagGripKind = 'opening-info-tag-rotation';
export const OPENING_INFO_TAG_SIZE_KIND: OpeningInfoTagGripKind = 'opening-info-tag-size';

/** Minimum box width (world canonical-mm) — the size drag clamps to this. */
const MIN_OPENING_INFO_TAG_WIDTH_MM = 100;

/**
 * The wall-parity grips of an opening-info-tag — the SSoT both grip paths consume:
 * MOVE (centre) + ROTATION (top long-edge midpoint) + 4 corner SIZE handles.
 * Positions derive from `computeOpeningInfoTagGeometry` (world canonical-mm,
 * rotation-aware).
 */
export function getOpeningInfoTagGrips(entity: OpeningInfoTagEntity): GripInfo[] {
  const geo = computeOpeningInfoTagGeometry(entity);
  // ROTATION handle: midpoint of the TOP long edge, ON the edge (v = +halfHeight),
  // folded through the entity rotation by the SHARED `openingInfoTagFrameToWorld`
  // SSoT (N.18) — Giorgio 2026-07-09 «επάνω στη μέση μιας από τις 2 μεγάλες πλευρές».
  const rotationHandle = openingInfoTagFrameToWorld(entity, 0, geo.halfHeight);

  const grips: GripInfo[] = [
    {
      entityId: entity.id, gripIndex: 0, type: 'center',
      position: entity.position, movesEntity: true,
      gripKind: { on: 'opening-info-tag', kind: OPENING_INFO_TAG_MOVE_KIND },
    },
    {
      entityId: entity.id, gripIndex: 1, type: 'vertex',
      position: rotationHandle, movesEntity: false,
      gripKind: { on: 'opening-info-tag', kind: OPENING_INFO_TAG_ROTATION_KIND },
    },
  ];

  // SIZE handles at ALL 4 corners (`worldCorners` = [BL, BR, TR, TL]) — wall-parity
  // corner resize with NO mid-edge handles. Every corner shares `-size`, so the SAME
  // `applyOpeningInfoTagGripDrag` re-derives `widthMm` from whichever corner is
  // dragged (box stays centred on `position`; height auto-derives from the 3:2 lock).
  geo.worldCorners.forEach((corner, i) => {
    grips.push({
      entityId: entity.id, gripIndex: 2 + i, type: 'vertex',
      position: corner, movesEntity: false,
      gripKind: { on: 'opening-info-tag', kind: OPENING_INFO_TAG_SIZE_KIND },
    });
  });

  return grips;
}

/**
 * Pure drag transform — the params patch for an opening-info-tag grip drag (the SSoT
 * the commit AND the live ghost both run, so preview ≡ commit by identity).
 * `gripWorldPos` = the grabbed grip's world anchor; `delta` = the cursor displacement.
 *   - move     → translate the whole tag (`position += delta`).
 *   - rotation → ADR-612 wall-parity (Giorgio 2026-07-09 «όπως ο τοίχος»): when a rotation
 *                centre is picked (hot-grip flow → `rotate` ctx), the box ORBITS that pivot —
 *                BOTH `position` and `angleRad` sweep by the same angle via the shared
 *                `sweptAngleDegAboutPivot` SSoT (parity με scale-bar/wall). With no picked centre
 *                (`rotate` absent) it falls back to the legacy swept angle about the box's own
 *                origin (`position`), placement-agnostic, no-op at zero delta → `angleRad` only.
 *   - size     → re-derive `widthMm` from the dragged corner's local `u` (via the
 *                inverse-rotation SSoT); height auto-derives from the LOCKED 3:2 aspect.
 * The DERIVED `geometry` cache is never written — it is recomputed on the next render.
 */
export function applyOpeningInfoTagGripDrag(
  kind: OpeningInfoTagGripKind,
  entity: OpeningInfoTagEntity,
  gripWorldPos: Point2D,
  delta: Point2D,
  rotate?: { readonly pivot: Point2D; readonly anchor: Point2D },
): Partial<OpeningInfoTagEntity> {
  switch (kind) {
    case 'opening-info-tag-move':
      return { position: translatePoint(entity.position, delta) };
    case 'opening-info-tag-rotation':
      // ADR-612 (Giorgio 2026-07-09 «όπως ο τοίχος») — hot-grip orbit about a picked centre,
      // else legacy own-origin spin. Shared with scale-bar via the `rotateEntityGripDrag` SSoT
      // (N.18) so the two annotation rotations can never diverge.
      return rotateEntityGripDrag(entity, gripWorldPos, delta, rotate);
    case 'opening-info-tag-size': {
      // Project the dragged corner back into the box frame (angle/position unchanged
      // during the drag) → the half-width is `|u|`, so `widthMm = 2·|u|`. Clamp to a
      // readable minimum. Height is DERIVED (`openingInfoTagHeightMm`), never stored.
      const newCorner = translatePoint(gripWorldPos, delta);
      const { u } = openingInfoTagWorldToFrame(entity, newCorner);
      return { widthMm: Math.max(2 * Math.abs(u), MIN_OPENING_INFO_TAG_WIDTH_MM) };
    }
  }
}
