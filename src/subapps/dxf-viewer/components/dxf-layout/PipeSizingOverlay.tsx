'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-422 L3 — Pipe-sizing overlay (Revit «Pipe Sizing» preview).
 *
 * Read-only overlay canvas που, όταν είναι ON το toggle «Διαστασιολόγηση
 * Σωληνώσεων», δείχνει στο μέσο κάθε σωλήνα θέρμανσης ένα badge με την προτεινόμενη
 * DN + ταχύτητα ροής (D5 velocity+friction). Οι διάμετροι **μικραίνουν προς τα
 * τερματικά** — ο κορμός κοντά στην πηγή = μεγάλο DN. Τα μεγέθη είναι **derived**
 * από τον L3 engine (`usePipeSizing`) — μηδέν persistence.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ (PipeSizingView store + ViewMode3DStore
 * mode + active-floor BIM scene via getLevelScene). Ο shell `CanvasLayerStack` δεν
 * αποκτά νέο `useSyncExternalStore` (CHECK 6C safe). Ξεχωριστό canvas +
 * `pointer-events-none` → καμία επίδραση σε selection/hit-test. Mirror του
 * {@link HeatLoadOverlay} (L1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L3)
 */

import { useEffect, useRef } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { usePipeSizingViewStore } from '../../state/pipe-sizing-view-store';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { usePipeSizing } from '../../hooks/data/usePipeSizing';
import { isMepSegmentEntity } from '../../types/entities';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { pillPath, PILL_BG_COLOR, contrastTextColor } from '../../rendering/utils/canvas-pill';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { PipeSizingMap } from '../../bim/thermal/sizing/pipe-network-sizing';

const DN_FONT = 'bold 12px sans-serif';
const FLOW_FONT = '10px sans-serif';
const LINE_HEIGHT_PX = 14;
const PILL_PAD_X = 6;
const PILL_PAD_Y = 4;
/** Pill φόντο όταν κανένας βαθμός DN δεν ικανοποιεί τα όρια (saturated). */
const SATURATED_BG_COLOR = '#b45309';

export interface PipeSizingOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

/** Μέσο (screen px) ενός σωλήνα από τα δύο άκρα του (world coords). */
function segmentMidScreen(
  start: { x: number; y: number },
  end: { x: number; y: number },
  transform: ViewTransform,
  viewport: Viewport,
): Point2D {
  const world = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return CoordinateTransforms.worldToScreen(world, transform, viewport);
}

/** Badge «DN… / …m/s» μέσα σε pill, κεντραρισμένο στο μέσο του σωλήνα. */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  centre: Point2D,
  dnLine: string,
  flowLine: string,
  saturated: boolean,
): void {
  ctx.font = DN_FONT;
  const dnW = ctx.measureText(dnLine).width;
  ctx.font = FLOW_FONT;
  const flowW = ctx.measureText(flowLine).width;

  const textW = Math.max(dnW, flowW);
  const boxW = textW + PILL_PAD_X * 2;
  const boxH = LINE_HEIGHT_PX * 2 + PILL_PAD_Y * 2;
  const x = centre.x - boxW / 2;
  const y = centre.y - boxH / 2;

  const bg = saturated ? SATURATED_BG_COLOR : PILL_BG_COLOR;
  pillPath(ctx, x, y, boxW, boxH, 4);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.fillStyle = contrastTextColor(bg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = DN_FONT;
  ctx.fillText(dnLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX / 2);
  ctx.font = FLOW_FONT;
  ctx.fillText(flowLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX + LINE_HEIGHT_PX / 2);
}

export function PipeSizingOverlay({ transform, viewport }: PipeSizingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscriptions (ADR-040): render mode + sizing-preview toggle.
  const mode = useViewMode3DStore((s) => s.mode);
  const showPipeSizing = usePipeSizingViewStore((s) => s.showPipeSizing);
  const active = showPipeSizing && mode === '2d';

  // Active-floor BIM scene — read DIRECTLY (no memo), mirror HeatLoadOverlay.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene =
    active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;

  const sizing: PipeSizingMap = usePipeSizing(scene, active);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = getDevicePixelRatio();
    const w = Math.max(1, Math.round(viewport.width * dpr));
    const h = Math.max(1, Math.round(viewport.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (!active || !scene || sizing.size === 0) return;

    ctx.save();
    ctx.setLineDash([]);
    for (const entity of scene.entities) {
      if (!isMepSegmentEntity(entity) || entity.params.domain !== 'pipe') continue;
      const result = sizing.get(entity.id);
      if (!result) continue;
      const centre = segmentMidScreen(entity.params.startPoint, entity.params.endPoint, transform, viewport);
      drawBadge(
        ctx,
        centre,
        `DN${result.dnMm}`,
        `${result.velocityMS.toFixed(2)} m/s`,
        result.saturated,
      );
    }
    ctx.restore();
  }, [active, scene, sizing, transform, viewport]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="pipe-sizing"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
      aria-hidden="true"
    />
  );
}
