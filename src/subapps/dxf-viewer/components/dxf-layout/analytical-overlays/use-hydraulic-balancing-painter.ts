/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 *
 * ADR-422 L4 — hydraulic-balancing badges (ΔP + kv), ως analytical painter (ADR-552
 * dispatch). Πηγή λογικής: ο πρώην `HydraulicBalancingOverlay.tsx` (verbatim paint).
 *
 * Όταν ON το toggle «Υδραυλική Εξισορρόπηση»: κάθε καλοριφέρ badge με ΔP κυκλώματος +
 * απαιτ. kv balancing valve· index circuit highlighted· στην πηγή το μανομετρικό (Hp).
 * Derived (`useHydraulicBalancing`), μηδέν persistence. Gate: `showBalancing && 2d`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L4)
 */

import { useMemo } from 'react';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { useHydraulicBalancingViewStore } from '../../../state/hydraulic-balancing-view-store';
import { useCurrentLevelScene } from '../../../systems/levels';
import { useHydraulicBalancing } from '../../../hooks/data/useHydraulicBalancing';
import { isMepRadiatorEntity } from '../../../types/entities';
import { isPipeNetworkSourceEntity } from '../../../bim/mep-systems/pipe-network-source';
import { getConnectorHostPlanTransform } from '../../../bim/mep-systems/connector-access';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { pillPath, PILL_BG_COLOR, contrastTextColor } from '../../../rendering/utils/canvas-pill';
import type { ViewTransform, Viewport, Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { HydraulicBalancingResult } from '../../../bim/thermal/balancing/circuit-balancing';
import type { AnalyticalPainter } from './analytical-painter';

const HEAD_FONT = 'bold 12px sans-serif';
const SUB_FONT = '10px sans-serif';
const LINE_HEIGHT_PX = 14;
const PILL_PAD_X = 6;
const PILL_PAD_Y = 4;
/** Pill φόντο για το index circuit (δυσμενέστερο — δεν στραγγαλίζεται). */
const INDEX_BG_COLOR = '#dc2626';
/** Pill φόντο για το μανομετρικό κυκλοφορητή στην πηγή. */
const PUMP_BG_COLOR = '#0f766e';

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

/** Hydraulic-balancing analytical painter (`null` όταν ανενεργό/κενό). */
export function useHydraulicBalancingPainter(): AnalyticalPainter | null {
  // Leaf subscriptions (ADR-040): render mode + balancing-preview toggle.
  const mode = useViewMode3DStore((s) => s.mode);
  const showBalancing = useHydraulicBalancingViewStore((s) => s.showBalancing);
  const active = showBalancing && mode === '2d';

  // Active-floor BIM scene — SSoT hook (ADR-557).
  const liveScene = useCurrentLevelScene();
  const scene = active ? liveScene : null;

  const result = useHydraulicBalancing(scene, active);

  return useMemo<AnalyticalPainter | null>(() => {
    if (!active || !scene || result.terminals.size === 0) return null;
    const entities = scene.entities;
    return (ctx, transform, viewport) => {
      ctx.save();
      ctx.setLineDash([]);
      drawBalancing(ctx, entities, result, transform, viewport);
      ctx.restore();
    };
  }, [active, scene, result]);
}
