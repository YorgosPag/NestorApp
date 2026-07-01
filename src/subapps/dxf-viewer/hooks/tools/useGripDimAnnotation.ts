/**
 * ADR-363 Phase 4.5c.5 — Live dimension annotation during column/beam grip drag.
 *
 * Mirrors `useGripGhostPreview` (ADR-049): RAF-based, draws to PreviewCanvas,
 * no React re-renders inside this hook. Clears the annotation on drag end.
 *
 * When a dimensional column grip (width/depth/arm/flange) or beam grip
 * (width/depth) is dragged, a floating "w=350mm" label appears near the grip
 * handle on the preview canvas — Revit/AutoCAD live-dim convention.
 *
 * ADR-508 §wall-hud — ο ΤΟΙΧΟΣ ΔΕΝ χειρίζεται εδώ: το live Wall HUD (γωνία/μήκος/πάχος/ύψος)
 * ζωγραφίζεται στο ΙΔΙΟ RAF/frame με το grip ghost μέσα στο `useGripGhostPreview` (μετά το ghost,
 * πριν το επόμενο clear) → ΣΤΑΘΕΡΟ, χωρίς race μεταξύ δύο ανεξάρτητων RAF leaves (αλλιώς τρεμοπαίζει).
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + canonical viewport/transform ζουν πλέον ΜΙΑ φορά στο harness·
 * εδώ μένει ΜΟΝΟ η draw logic (label pill).
 *
 * `cursorMode: 'none'` — cursor έρχεται μέσω `dragPreview.anchorPos + delta`.
 * `clearMode: 'skip-clear'` — ζωγραφίζει LAYERED πάνω στο frame του
 * useGripGhostPreview· ΔΕΝ κάνει per-frame clear (αλλιώς σβήνει το grip ghost).
 * Clear-on-exit γίνεται κανονικά από το harness.
 *
 * @module hooks/tools/useGripDimAnnotation
 * @see ADR-363 Phase 4.5c.5
 * @see ADR-040 — Preview Canvas Performance
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

'use client';

import { useCallback } from 'react';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { useLevels } from '../../systems/levels';
import type { DxfGripDragPreview } from '../grip-computation';
import type { ColumnParams } from '../../bim/types/column-types';
import type { BeamParams } from '../../bim/types/beam-types';
import type { FoundationParams } from '../../bim/types/foundation-types';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { applyFoundationGripDrag } from '../../bim/foundations/foundation-grips';
import { isColumnEntity, isBeamEntity, isFoundationEntity } from '../../types/entities';
// ADR-508 §column-hud — ορθογώνιες κολόνες παίρνουν το πλούσιο HUD (useGripGhostPreview)· εδώ κρατάμε
// τα pills ΜΟΝΟ για μη-ορθογώνιες (κύκλος/Γ/Τ/Π) → μηδέν διπλή ένδειξη. Κοινό SSoT «είναι box;».
import { isRectFootprint } from '../../bim/framing/rect-frame';
import {
  PILL_DIM_FONT,
  PILL_TEXT_COLOR,
  PILL_BG_COLOR,
  PILL_PADDING,
  PILL_RADIUS,
  pillPath,
} from '../../rendering/utils/canvas-pill';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

// ── Types ────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
>;

export interface UseGripDimAnnotationProps {
  dragPreview: DxfGripDragPreview | null;
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LABEL_OFFSET_X = 12;
const LABEL_OFFSET_Y = -4;

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawLabelPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  sx: number,
  sy: number,
): void {
  ctx.save();
  ctx.font = PILL_DIM_FONT;
  const metrics = ctx.measureText(text);
  const w = metrics.width + PILL_PADDING * 2;
  const h = 16;
  const x = sx + LABEL_OFFSET_X;
  const y = sy + LABEL_OFFSET_Y - h + PILL_PADDING;
  pillPath(ctx, x, y, w, h, PILL_RADIUS);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();
  ctx.fillStyle = PILL_TEXT_COLOR;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x + PILL_PADDING, y + PILL_PADDING);
  ctx.restore();
}

function buildColumnLabel(
  preview: DxfGripDragPreview,
  originalParams: ColumnParams,
): string | null {
  const { columnGripKind } = preview;
  if (!columnGripKind) return null;
  if (columnGripKind === 'column-center' || columnGripKind === 'column-rotation') return null;

  const p = applyColumnGripDrag(columnGripKind, { originalParams, delta: preview.delta });

  switch (columnGripKind) {
    case 'column-width':
      return `w=${Math.round(p.width)}`;
    case 'column-depth':
      return `d=${Math.round(p.depth)}`;
    // ADR-363 Slice C — rect/shear-wall corners are 2-DOF: show both dimensions.
    case 'column-corner-ne':
    case 'column-corner-nw':
    case 'column-corner-sw':
    case 'column-corner-se':
      return `w=${Math.round(p.width)} d=${Math.round(p.depth)}`;
    case 'column-arm-length':
      return `al=${Math.round(p.lshape?.armLength ?? p.depth / 3)}`;
    case 'column-arm-width':
      return `aw=${Math.round(p.lshape?.armWidth ?? p.width / 3)}`;
    case 'column-flange-length':
      return `fl=${Math.round(p.tshape?.flangeLength ?? p.width)}`;
    case 'column-web-thickness':
      return `wt=${Math.round(p.tshape?.webThickness ?? p.depth / 3)}`;
    case 'column-i-flange-thickness':
      return `tf=${Math.round(p.ishape?.flangeThickness ?? 20)}`;
    case 'column-i-web-thickness':
      return `tw=${Math.round(p.ishape?.webThickness ?? 15)}`;
    case 'column-leg-thickness':
      return `lt=${Math.round(p.ushape?.legThickness ?? p.width / 4)}`;
    case 'column-base-thickness':
      return `bt=${Math.round(p.ushape?.baseThickness ?? p.depth / 3)}`;
    default:
      // ADR-363 Phase 2b — `column-poly-vertex-${n}` per-vertex drags show no
      // scalar dimension label (the moved vertex is free-form).
      return null;
  }
}

function buildBeamLabel(
  preview: DxfGripDragPreview,
  originalParams: BeamParams,
): string | null {
  const { beamGripKind } = preview;
  if (!beamGripKind) return null;
  if (
    beamGripKind === 'beam-start' ||
    beamGripKind === 'beam-end' ||
    beamGripKind === 'beam-midpoint' ||
    beamGripKind === 'beam-curve'
  ) return null;

  const p = applyBeamGripDrag(beamGripKind, { originalParams, delta: preview.delta });
  const beamLen = Math.round(Math.hypot(p.endPoint.x - p.startPoint.x, p.endPoint.y - p.startPoint.y));

  switch (beamGripKind) {
    case 'beam-width':
      return `w=${Math.round(p.width)}`;
    case 'beam-edge-length':
      return `l=${beamLen}`;
    // ADR-363 (2026-06-11) — axis-box corners are 2-DOF: show both width + length.
    case 'beam-corner-start-pos':
    case 'beam-corner-start-neg':
    case 'beam-corner-end-pos':
    case 'beam-corner-end-neg':
      return `w=${Math.round(p.width)} l=${beamLen}`;
    case 'beam-depth':
      return `d=${Math.round(p.depth)}`;
    default:
      return null;
  }
}

/**
 * ADR-436 Slice 1b — live "w=350" / "l=400" label for foundation pad resize grips.
 * Rotation / Alt-move show no scalar dimension (mirror column center/rotation).
 */
function buildFoundationLabel(
  preview: DxfGripDragPreview,
  originalParams: FoundationParams,
): string | null {
  const { foundationGripKind } = preview;
  if (!foundationGripKind) return null;
  if (foundationGripKind === 'foundation-center' || foundationGripKind === 'foundation-rotation') return null;

  const p = applyFoundationGripDrag(foundationGripKind, { originalParams, delta: preview.delta });

  // ADR-436 (2026-06-11) — line-based (strip / tie-beam) axis-box grips: width +
  // length from the axis (wall/beam parity). Handled before the pad guard.
  if (p.kind === 'strip' || p.kind === 'tie-beam') {
    const lineLen = Math.round(Math.hypot(p.end.x - p.start.x, p.end.y - p.start.y));
    switch (foundationGripKind) {
      case 'foundation-line-width':
        return `w=${Math.round(p.width)}`;
      case 'foundation-line-length':
        return `l=${lineLen}`;
      case 'foundation-corner-start-pos':
      case 'foundation-corner-start-neg':
      case 'foundation-corner-end-pos':
      case 'foundation-corner-end-neg':
        return `w=${Math.round(p.width)} l=${lineLen}`;
      default:
        return null;
    }
  }
  if (p.kind !== 'pad') return null;

  switch (foundationGripKind) {
    case 'foundation-width':
      return `w=${Math.round(p.width)}`;
    case 'foundation-length':
      return `l=${Math.round(p.length)}`;
    // ADR-436 Slice 1c — corners are 2-DOF: show both dimensions (Revit parity).
    case 'foundation-corner-ne':
    case 'foundation-corner-nw':
    case 'foundation-corner-sw':
    case 'foundation-corner-se':
      return `w=${Math.round(p.width)} l=${Math.round(p.length)}`;
    default:
      return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGripDimAnnotation(props: UseGripDimAnnotationProps): void {
  const { dragPreview, levelManager, transform, getCanvas, getViewportElement } = props;

  const isDimPreview =
    dragPreview !== null &&
    (dragPreview.columnGripKind !== undefined ||
      dragPreview.beamGripKind !== undefined ||
      dragPreview.foundationGripKind !== undefined);

  // cursorMode: 'none' — cursor comes via dragPreview.anchorPos + delta, not
  // useCursorWorldPosition. effectiveCursor will be null (unused below).
  // clearMode: 'skip-clear' — draws LAYERED on top of useGripGhostPreview's frame.
  // The harness still clears on gate-exit (isDimPreview → false).
  const draw = useCallback(({ ctx, viewport, transform: t }: GhostDrawFrame) => {
    // NOTE: Do NOT clear here — GripDragPreviewMount (mounted before this
    // leaf in PreviewCanvasMounts) schedules its RAF first, clears the canvas,
    // then draws the ghost. This RAF runs second, drawing the label on top of
    // the already-cleared canvas. Two clears in the same frame = label wipe.
    if (!dragPreview?.anchorPos) return;

    const { columnGripKind, beamGripKind, foundationGripKind, anchorPos, delta, entityId } = dragPreview;
    if (!columnGripKind && !beamGripKind && !foundationGripKind) return;

    const lid = levelManager.currentLevelId;
    if (!lid) return;
    const scene = levelManager.getLevelScene(lid);
    const entity = scene?.entities?.find(e => e.id === entityId);
    if (!entity) return;

    const gripWorld: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    // BUG FIX (Y-flip): use the canonical CoordinateTransforms.worldToScreen SSoT
    // (Y-inversion + margins) — the previous local helper omitted the Y-flip, so
    // the label tracked the cursor vertically inverted. Viewport derived from the
    // same element the ghost uses (`getGhostPreview` pattern) for 1:1 placement.
    const { x: sx, y: sy } = CoordinateTransforms.worldToScreen(gripWorld, t, viewport);

    let label: string | null = null;
    if (columnGripKind && isColumnEntity(entity)) {
      // ADR-508 §column-hud — ΟΡΘΟΓΩΝΙΑ & ΚΥΚΛΙΚΗ κολόνα → πλούσιο HUD (aligned dims / Ø) στο
      // `useGripGhostPreview`· εδώ pill ΜΟΝΟ για Γ/Τ/Π/I/πολύγωνο (per-sub-dim feedback: arm/flange/leg).
      const hasRichHud = isRectFootprint(entity.geometry.footprint.vertices) || entity.params.kind === 'circular';
      if (!hasRichHud) {
        label = buildColumnLabel(dragPreview, entity.params);
      }
    } else if (beamGripKind && isBeamEntity(entity)) {
      label = buildBeamLabel(dragPreview, entity.params);
    } else if (foundationGripKind && isFoundationEntity(entity)) {
      label = buildFoundationLabel(dragPreview, entity.params);
    }

    if (label) drawLabelPill(ctx, label, sx, sy);
  }, [dragPreview, levelManager]);

  useCanvasGhostPreview({
    isActive: isDimPreview,
    getCanvas,
    getViewportElement,
    transform,
    cursorMode: 'none',
    clearMode: 'skip-clear',
    draw,
  });
}
