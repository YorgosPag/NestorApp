/**
 * USE BEAM-BETWEEN-MEMBERS PREVIEW — ADR-569 (live ghost of the beam-to-be).
 *
 * Draws, on the shared PreviewCanvas, το rubber-band δοκάρι-φάντασμα της εντολής «Δοκάρι ανάμεσα
 * σε μέλη»:
 *   • ένα ημιδιαφανές ορθογώνιο (πλάτος = default beam width) κατά μήκος της **πιο σύντομης
 *     διαδρομής** από την παρειά του anchor-μέλους προς το μέλος κάτω από τον κέρσορα (ή, όσο δεν
 *     υπάρχει μέλος, προς τον κέρσορα),
 *   • persistent «επιλεγμένο» highlight ΜΟΝΟ στο anchor-μέλος (locked). Ο φωτισμός του μέλους κάτω
 *     από τον κέρσορα (hover) έρχεται από το native HoverStore (`entityPickingActive`), όχι από εδώ.
 * Η γεωμετρία είναι ΙΔΙΑ με το commit (`shortestSegmentBetweenPolygons`) → preview ≡ commit.
 *
 * Reuses το shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF lifecycle, DPR-clear,
 * canonical viewport/transform και ο live world cursor ζουν στο harness — μόνο το `draw` delegate
 * ζει εδώ. Zero React state στο mouse-move path (ADR-040).
 *
 * @see hooks/tools/useWallSplitKnifePreview.ts — το πρότυπο
 * @see bim/beams/beam-between-members.ts — pick + connector (SSoT commit geometry)
 * @see docs/centralized-systems/reference/adrs/ADR-569-beam-between-members.md
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
import type { useLevels } from '../../systems/levels';
import type { BeamBetweenAnchor } from '../../systems/beam-between-members/BeamBetweenMembersStore';
import { pickStructuralMemberAt, computeBeamAxisBetweenMembers } from '../../bim/beams/beam-between-members';
// 🏢 ADR-571: tool-anchor cyan SSoT + hexToRgba SSoT (color-math.ts)
import { TOOL_ANCHOR_CYAN } from '../../config/color-config';
import { hexToRgba } from '../../config/color-math';
import { closestPointOnPolygonOutline } from '../../bim/geometry/shared/polygon-nearest';
import { DEFAULT_BEAM_WIDTH_MM } from '../../bim/types/beam-types';
import { mmToSceneUnits, resolveSceneUnits } from '../../utils/scene-units';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseBeamBetweenMembersPreviewProps {
  /** Anchor member (last picked), or null while awaiting the first click. */
  anchor: BeamBetweenAnchor | null;
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// Styling (canvas literals, consistent με τα sibling ghost hooks).
const GHOST_FILL = 'rgba(255, 179, 0, 0.28)';
const GHOST_STROKE = '#FFB300';
// Persistent «selected/locked» highlight του anchor-μέλους (το native HoverStore αναλαμβάνει
// τον φωτισμό κάτω-από-τον-κέρσορα μέσω `entityPickingActive` — εδώ μένει ΜΟΝΟ το κλειδωμένο μέλος).
const ANCHOR_STROKE = TOOL_ANCHOR_CYAN;
const ANCHOR_FILL = hexToRgba(TOOL_ANCHOR_CYAN, 0.22);

// ── Draw helpers (pure canvas, screen-space) ────────────────────────────────────

/** Γεμισμένο + περιγραμμένο footprint (persistent «επιλεγμένο» look του anchor-μέλους). */
function highlightMember(
  ctx: CanvasRenderingContext2D,
  pts: readonly Point2D[],
  toScreen: (p: Point2D) => Point2D,
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.beginPath();
  const s0 = toScreen(pts[0]);
  ctx.moveTo(s0.x, s0.y);
  for (let i = 1; i < pts.length; i++) {
    const s = toScreen(pts[i]);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
  ctx.fillStyle = ANCHOR_FILL;
  ctx.fill();
  ctx.strokeStyle = ANCHOR_STROKE;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/** Ημιδιαφανές ορθογώνιο δοκαριού (πλάτος 2·`half`) κατά μήκος `a → b` + κεντρική γραμμή. */
function drawBeamGhost(
  ctx: CanvasRenderingContext2D,
  a: Point2D,
  b: Point2D,
  half: number,
  toScreen: (p: Point2D) => Point2D,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  const corners: Point2D[] = [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ];
  ctx.save();
  ctx.beginPath();
  const c0 = toScreen(corners[0]);
  ctx.moveTo(c0.x, c0.y);
  for (let i = 1; i < corners.length; i++) {
    const c = toScreen(corners[i]);
    ctx.lineTo(c.x, c.y);
  }
  ctx.closePath();
  ctx.fillStyle = GHOST_FILL;
  ctx.fill();
  ctx.strokeStyle = GHOST_STROKE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Centerline (dashed).
  const sa = toScreen(a);
  const sb = toScreen(b);
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBeamBetweenMembersPreview(props: UseBeamBetweenMembersPreviewProps): void {
  const { anchor, levelManager, transform, getCanvas, getViewportElement } = props;

  const getEntities = useCallback((): readonly Entity[] => {
    if (!levelManager.currentLevelId) return [];
    return levelManager.getLevelScene(levelManager.currentLevelId)?.entities ?? [];
  }, [levelManager]);

  const getUnits = useCallback(() => {
    if (!levelManager.currentLevelId) return 'mm' as const;
    return resolveSceneUnits(levelManager.getLevelScene(levelManager.currentLevelId));
  }, [levelManager]);

  const draw = useCallback(
    ({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
      if (!anchor || !effectiveCursor) return;
      const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);

      // Μέλος κάτω από τον κέρσορα (εκτός του anchor) → connector παρειά→παρειά· αλλιώς προς κέρσορα.
      const picked = pickStructuralMemberAt(effectiveCursor, getEntities(), TOLERANCE_CONFIG.HIT_TEST_FALLBACK);
      const hovered = picked && picked.entity.id !== anchor.id ? picked : null;

      const half = (DEFAULT_BEAM_WIDTH_MM * mmToSceneUnits(getUnits())) / 2;

      // Πάνω σε μέλος → ΙΔΙΟΣ άξονας με το commit (face-to-face span + lateral flush)· αλλιώς
      // απλό rubber-band από την παρειά του anchor προς τον κέρσορα. preview ≡ commit.
      let a: Point2D | null = null;
      let b: Point2D | null = null;
      if (hovered) {
        const axis = computeBeamAxisBetweenMembers(anchor.footprint, hovered.footprint, half);
        if (axis) {
          a = axis.a;
          b = axis.b;
        }
      }
      if (!a || !b) {
        a = closestPointOnPolygonOutline(anchor.footprint, effectiveCursor);
        b = { x: effectiveCursor.x, y: effectiveCursor.y };
      }

      // Persistent «επιλεγμένο» highlight ΜΟΝΟ του anchor (locked). Ο φωτισμός του μέλους κάτω από
      // τον κέρσορα (hover) έρχεται από το native HoverStore (`entityPickingActive`), όχι από εδώ.
      highlightMember(ctx, anchor.footprint, toScreen);

      drawBeamGhost(ctx, a, b, half, toScreen);
    },
    [anchor, getEntities, getUnits],
  );

  useCanvasGhostPreview({
    isActive: anchor !== null,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: false, // members are large hit areas — raw world cursor picks them; preview ≡ commit (raw worldPoint)
    draw,
  });
}
