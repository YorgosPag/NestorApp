/**
 * GRIP GHOST PREVIEW — pure draw helpers
 *
 * Self-contained canvas-drawing utilities used by `useGripGhostPreview`'s draw
 * callback: dashed rubber-band leaders, the move-distance readout leader, the
 * endpoint-reshape angle arc, the live gradient-origin marker, and the ADR-543
 * co-move partner ghosts. Extracted from `useGripGhostPreview` (file-size SRP
 * split) — these are stateless renderers, distinct from the hook orchestration.
 *
 * @module hooks/tools/grip-ghost-preview-draw-helpers
 * @see hooks/tools/useGripGhostPreview — the consuming hook
 * @see ADR-040 — Preview Canvas Performance
 * @see ADR-363 / ADR-507 / ADR-543 — the individual readout/co-move behaviours
 */

import type { ViewTransform } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isLineEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { drawGhostEntity, GHOST_DEFAULTS } from '../../rendering/ghost';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { buildCoincidentPartnerGhostEntities } from '../../systems/stretch/coincident-endpoint-comove';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
// ADR-449 — LIVE finish-skin (σοβάς) preview reuses the committed scene-level pass.
import { drawStructuralFinishSkin2D } from '../../canvas-v2/dxf-canvas/dxf-renderer-structural-overlays';

// ── Constants ──────────────────────────────────────────────────────────────────

/** ADR-363 Phase 1G — dash pattern for the corner hot-grip rubber-band leader. */
const HOT_GRIP_RUBBER_BAND_DASH: readonly number[] = [6, 4];

/**
 * ADR-363 — discreet neutral colour for the live move-distance readout leader (Revit-grade).
 * Semi-transparent WHITE so it stays subtle yet visible on the pure-black AutoCAD canvas
 * (`CANVAS_BACKGROUND #000`) — a black leader would be invisible.
 */
const MOVE_READOUT_LEADER_COLOR = 'rgba(255,255,255,0.5)';

/** ADR-363 — angular-dimension arc (endpoint reshape readout): screen radius + neutral colour. */
const ANGLE_ARC_RADIUS_PX = 22;
const ANGLE_ARC_LABEL_GAP_PX = 12;
const ANGLE_ARC_COLOR = 'rgba(255,255,255,0.7)';

/** ADR-507 Φ5 A3b — half-size (CSS px) του live gradient-origin grip-marker (fixed on-screen). */
const GRADIENT_ORIGIN_MARKER_HALF_PX = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ADR-363 Phase 1G.3 — draw one dashed world-space segment on the preview canvas. */
export function drawDashedSegment(
  ctx: CanvasRenderingContext2D,
  fromW: { x: number; y: number },
  toW: { x: number; y: number },
  transform: ViewTransform,
  vp: { width: number; height: number },
): void {
  const fromS = CoordinateTransforms.worldToScreen(fromW, transform, vp);
  const toS = CoordinateTransforms.worldToScreen(toW, transform, vp);
  ctx.save();
  ctx.setLineDash([...HOT_GRIP_RUBBER_BAND_DASH]);
  ctx.strokeStyle = GHOST_DEFAULTS.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fromS.x, fromS.y);
  ctx.lineTo(toS.x, toS.y);
  ctx.stroke();
  ctx.restore();
}

/** ADR-363 — draw the discreet neutral base→current leader for the move-distance readout. */
export function drawMoveReadoutLeader(
  ctx: CanvasRenderingContext2D,
  fromS: { x: number; y: number },
  toS: { x: number; y: number },
): void {
  ctx.save();
  ctx.setLineDash([...HOT_GRIP_RUBBER_BAND_DASH]);
  ctx.strokeStyle = MOVE_READOUT_LEADER_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fromS.x, fromS.y);
  ctx.lineTo(toS.x, toS.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * ADR-363 — AutoCAD-style angular-dimension arc for the endpoint-reshape readout. Draws a
 * short +X baseline tick at the fixed vertex (`centerS`) and an arc to the segment direction
 * (`segAngleRad`, SCREEN space so it hugs the visible segment). Returns the label anchor on
 * the arc bisector so the angle value sits just outside the arc.
 */
export function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  centerS: { x: number; y: number },
  segAngleRad: number,
): { x: number; y: number } {
  ctx.save();
  ctx.strokeStyle = ANGLE_ARC_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerS.x, centerS.y);
  ctx.lineTo(centerS.x + ANGLE_ARC_RADIUS_PX, centerS.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerS.x, centerS.y, ANGLE_ARC_RADIUS_PX, 0, segAngleRad, segAngleRad < 0);
  ctx.stroke();
  ctx.restore();
  const bisector = segAngleRad / 2;
  const r = ANGLE_ARC_RADIUS_PX + ANGLE_ARC_LABEL_GAP_PX;
  return { x: centerS.x + r * Math.cos(bisector), y: centerS.y + r * Math.sin(bisector) };
}

/**
 * ADR-507 Φ5 A3b — live gradient-origin grip-marker. Ζωγραφίζει το «τετράγωνο» της λαβής
 * στη ΖΩΝΤΑΝΗ θέση (κέρσορας) στο preview canvas, full-opacity, ώστε να ΑΚΟΛΟΥΘΕΙ ορατά το
 * drag (το committed grip κρύβεται από το main canvas — `HatchRenderer.getGrips`). Ghost-cyan
 * γέμισμα + λευκό περίγραμμα = «η λαβή που σέρνεις», fixed on-screen size σε κάθε zoom.
 */
export function drawGradientOriginMarker(ctx: CanvasRenderingContext2D, screenPt: { x: number; y: number }): void {
  const h = GRADIENT_ORIGIN_MARKER_HALF_PX;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = GHOST_DEFAULTS.color;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(screenPt.x - h, screenPt.y - h, h * 2, h * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * ADR-543 — articulated joint: when a single line endpoint is reshaped and another selected
 * line shares that endpoint, draw the partner line(s) reshaping by the same delta (live preview
 * matching the co-move commit). The `startMoved === endMoved` guard keeps this to single-endpoint
 * reshapes only (excludes whole-entity move where both ends shift, and zero-delta). Reuses the
 * SSoT `buildCoincidentPartnerGhostEntities` so the preview geometry equals the commit.
 */
export function drawComovePartnerGhosts(
  ctx: CanvasRenderingContext2D,
  origEntity: Entity,
  transformed: Entity,
  getEntity: (id: string) => Entity | undefined,
  t: ViewTransform,
  vp: { width: number; height: number },
): void {
  if (!isLineEntity(origEntity) || !isLineEntity(transformed)) return;
  const startMoved = transformed.start.x !== origEntity.start.x || transformed.start.y !== origEntity.start.y;
  const endMoved = transformed.end.x !== origEntity.end.x || transformed.end.y !== origEntity.end.y;
  if (startMoved === endMoved) return; // both (whole move) or neither (idle) → not a single-endpoint reshape
  const kind = startMoved ? 'line-start' : 'line-end';
  const origMoved = startMoved ? origEntity.start : origEntity.end;
  const newMoved = startMoved ? transformed.start : transformed.end;
  const ghosts = buildCoincidentPartnerGhostEntities({
    draggedEntity: origEntity,
    draggedRefs: [{ entityId: origEntity.id, kind }],
    selectedEntityIds: SelectedEntitiesStore.getSelectedEntityIds(),
    getEntity,
    delta: { x: newMoved.x - origMoved.x, y: newMoved.y - origMoved.y },
  });
  for (const ghost of ghosts) {
    drawGhostEntity(ctx, ghost as unknown as DxfEntityUnion, t, vp);
  }
}

/**
 * ADR-449 — pure entity list for the live finish-skin (σοβάς) preview: the full scene with
 * the dragged wall (and its live-mitered neighbours) swapped for their PREVIEW versions, so
 * the merged plaster silhouette re-forms around the wall's NEW position. The silhouette is
 * scene-wide (exterior/interior classifier + union with stationary walls), so we must feed the
 * whole scene — not just the moving wall — with only the affected entities replaced by id.
 */
export function buildFinishSkinPreviewEntities<E extends { readonly id: string }>(
  sceneEntities: readonly E[],
  ghostWall: E,
  neighbours: readonly E[],
): E[] {
  const byId = new Map<string, E>();
  byId.set(ghostWall.id, ghostWall);
  for (const n of neighbours) byId.set(n.id, n);
  return sceneEntities.map((e) => byId.get(e.id) ?? e);
}

/**
 * ADR-449 / ADR-363 — LIVE finish-skin (σοβάς) preview while moving/rotating/resizing a
 * structural member (WALL / COLUMN / BEAM).
 *
 * Ζητούμενο (Giorgio): με ενεργή τη «Σοβατισμένη όψη», κατά την επεξεργασία δομικού μέλους η
 * προεπισκόπηση να δείχνει και τον σοβά live — πώς ακριβώς θα τυλίγει τη ΝΕΑ θέση στο επόμενο κλικ.
 * (Αρχικά μόνο τοίχος· επεκτάθηκε σε κολώνα/δοκάρι — ίδιος SSoT μηχανισμός.)
 *
 * SSoT reuse (μηδέν νέα geometry): καλεί τον ΙΔΙΟ scene-level pass που ζωγραφίζει τον committed σοβά
 * (`drawStructuralFinishSkin2D`), τροφοδοτημένο με τη σκηνή όπου το dragged μέλος (+ οι mitered γείτονες
 * ενός τοίχου) είναι στη θέση προεπισκόπησης → το merged silhouette (`computeStructuralFinishSilhouette`)
 * ξαναχτίζεται στη νέα θέση. Ο κάθε τύπος τροφοδοτεί ήδη φρέσκο footprint στο ghost του
 * (`applyEntityPreview`: computeWallGeometry / computeColumnGeometry / beam outline). No-op όταν ο
 * διακόπτης σοβά είναι κλειστός (gate ανά στοιχείο). ADR-040: pure draw, μηδέν subscriptions. Καλείται
 * ΜΕΤΑ το σώμα-φάντασμα (mirror της committed σειράς).
 */
export function drawStructuralFinishSkinPreview(
  ctx: CanvasRenderingContext2D,
  sceneEntities: readonly { readonly id: string }[],
  ghostMember: DxfEntityUnion,
  neighbours: readonly { readonly id: string }[],
  t: ViewTransform,
  vp: { width: number; height: number },
): void {
  const preview = buildFinishSkinPreviewEntities<{ readonly id: string }>(sceneEntities, ghostMember, neighbours);
  drawStructuralFinishSkin2D(ctx, preview as unknown as readonly DxfEntityUnion[], t, vp);
}
