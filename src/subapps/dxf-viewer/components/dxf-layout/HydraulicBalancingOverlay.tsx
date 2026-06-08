'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-422 L4 — Hydraulic-balancing overlay (Revit «System Inspector» preview).
 *
 * Read-only overlay canvas που, όταν είναι ON το toggle «Υδραυλική Εξισορρόπηση»,
 * δείχνει σε κάθε καλοριφέρ θέρμανσης ένα badge με την πτώση πίεσης του κυκλώματός του
 * (ΔP, kPa) + την απαιτούμενη προρρύθμιση kv της balancing valve. Το **index circuit**
 * (δυσμενέστερο) είναι highlighted (κόκκινο pill, kv «—» = πλήρως ανοιχτή). Στην πηγή
 * (λέβητας/συλλέκτης) δείχνει το απαιτ. μανομετρικό κυκλοφορητή (Hp). Τα μεγέθη είναι
 * **derived** από τον L4 engine (`useHydraulicBalancing`) — μηδέν persistence.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ (HydraulicBalancingView store + ViewMode3D
 * mode + active-floor BIM scene via getLevelScene). Ο shell `CanvasLayerStack` δεν
 * αποκτά νέο `useSyncExternalStore` (CHECK 6C safe). Ξεχωριστό canvas +
 * `pointer-events-none` → καμία επίδραση σε selection/hit-test. Mirror του
 * {@link PipeSizingOverlay} (L3).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L4)
 */

import { useEffect, useRef } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useHydraulicBalancingViewStore } from '../../state/hydraulic-balancing-view-store';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useHydraulicBalancing } from '../../hooks/data/useHydraulicBalancing';
import { isMepRadiatorEntity } from '../../types/entities';
import { isPipeNetworkSourceEntity } from '../../bim/mep-systems/pipe-network-source';
import { getConnectorHostPlanTransform } from '../../bim/mep-systems/connector-access';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { pillPath, PILL_BG_COLOR, contrastTextColor } from '../../rendering/utils/canvas-pill';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { HydraulicBalancingResult } from '../../bim/thermal/balancing/circuit-balancing';

const HEAD_FONT = 'bold 12px sans-serif';
const SUB_FONT = '10px sans-serif';
const LINE_HEIGHT_PX = 14;
const PILL_PAD_X = 6;
const PILL_PAD_Y = 4;
/** Pill φόντο για το index circuit (δυσμενέστερο — δεν στραγγαλίζεται). */
const INDEX_BG_COLOR = '#dc2626';
/** Pill φόντο για το μανομετρικό κυκλοφορητή στην πηγή. */
const PUMP_BG_COLOR = '#0f766e';

export interface HydraulicBalancingOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

/** Screen-px θέση του insertion point ενός host (radiator/source). */
function hostCentreScreen(
  entity: Entity,
  transform: ViewTransform,
  viewport: Viewport,
): Point2D {
  const { position } = getConnectorHostPlanTransform(entity);
  return CoordinateTransforms.worldToScreen({ x: position.x, y: position.y }, transform, viewport);
}

/** Δίγραμμο badge μέσα σε pill, κεντραρισμένο. */
function drawBadge(
  ctx: CanvasRenderingContext2D,
  centre: Point2D,
  headLine: string,
  subLine: string,
  bg: string,
): void {
  ctx.font = HEAD_FONT;
  const headW = ctx.measureText(headLine).width;
  ctx.font = SUB_FONT;
  const subW = ctx.measureText(subLine).width;

  const textW = Math.max(headW, subW);
  const boxW = textW + PILL_PAD_X * 2;
  const boxH = LINE_HEIGHT_PX * 2 + PILL_PAD_Y * 2;
  const x = centre.x - boxW / 2;
  const y = centre.y - boxH / 2;

  pillPath(ctx, x, y, boxW, boxH, 4);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.fillStyle = contrastTextColor(bg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = HEAD_FONT;
  ctx.fillText(headLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX / 2);
  ctx.font = SUB_FONT;
  ctx.fillText(subLine, centre.x, y + PILL_PAD_Y + LINE_HEIGHT_PX + LINE_HEIGHT_PX / 2);
}

/** kv readout: «—» όταν null (index / πλήρως ανοιχτή), αλλιώς «kv N.NN». */
function kvLabel(kv: number | null): string {
  return kv === null ? 'kv —' : `kv ${kv.toFixed(2)}`;
}

/** Ζωγράφισε τα balancing badges ανά σώμα + το μανομετρικό στην πηγή. */
function drawBalancing(
  ctx: CanvasRenderingContext2D,
  entities: readonly Entity[],
  result: HydraulicBalancingResult,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  for (const entity of entities) {
    if (!isMepRadiatorEntity(entity)) continue;
    const tb = result.terminals.get(entity.id);
    if (!tb) continue;
    const centre = hostCentreScreen(entity, transform, viewport);
    const head = `ΔP ${(tb.circuitDropPa / 1000).toFixed(1)} kPa`;
    drawBadge(ctx, centre, head, kvLabel(tb.requiredKv), tb.isIndex ? INDEX_BG_COLOR : PILL_BG_COLOR);
  }
  if (result.pumpHeadPa <= 0) return;
  for (const entity of entities) {
    if (!isPipeNetworkSourceEntity(entity)) continue;
    const centre = hostCentreScreen(entity, transform, viewport);
    drawBadge(ctx, centre, 'Hp', `${(result.pumpHeadPa / 1000).toFixed(1)} kPa`, PUMP_BG_COLOR);
  }
}

export function HydraulicBalancingOverlay({ transform, viewport }: HydraulicBalancingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscriptions (ADR-040): render mode + balancing-preview toggle.
  const mode = useViewMode3DStore((s) => s.mode);
  const showBalancing = useHydraulicBalancingViewStore((s) => s.showBalancing);
  const active = showBalancing && mode === '2d';

  // Active-floor BIM scene — read DIRECTLY (no memo), mirror PipeSizingOverlay.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene =
    active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;

  const result = useHydraulicBalancing(scene, active);

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

    if (!active || !scene || result.terminals.size === 0) return;

    ctx.save();
    ctx.setLineDash([]);
    drawBalancing(ctx, scene.entities, result, transform, viewport);
    ctx.restore();
  }, [active, scene, result, transform, viewport]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="hydraulic-balancing"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
      aria-hidden="true"
    />
  );
}
