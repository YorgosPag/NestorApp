/**
 * ADR-476 — 2Δ σχεδίαση οπλισμού πλάκας (κάτοψη): shared pure-ctx helper.
 *
 * Universal για ΟΛΑ τα είδη πλάκας (εδαφόπλακα + αναρτημένη). Σχεδιάζει τις σχάρες ως
 * δι-διευθυντικές γραμμές μέσα στο `outline` (bbox − cover), clip-αρισμένες στο πολύγωνο
 * ώστε να δουλεύουν σε μη-ορθογώνιες πλάκες (Revit-grade). Σύμβαση κάτοψης:
 *   - **κάτω σχάρα** → συμπαγείς γραμμές (κύριος οπλισμός ανοίγματος/raft).
 *   - **άνω σχάρα**  → διακεκομμένες γραμμές (στηρίξεων/hogging — Revit «top mark»).
 * `*MeshX` = ράβδοι // X (βήμα μετρημένο κατά Y)· `*MeshY` = ράβδοι // Y.
 *
 * Χρώμα από το ΕΝΑ SSoT (`rebar-catalog`, crimson — ίδια σύμβαση με κολώνα/δοκό/πέδιλο).
 * auto-aware: ο ενεργός οπλισμός re-derive-άρεται από την τρέχουσα γεωμετρία. Pure ctx,
 * ZERO subscriptions (ADR-040 — ο orchestrator το καλεί στο cached normal-state pass).
 *
 * @see ./footing-rebar-2d.ts — ο δίδυμος του πεδίλου (mesh bars SSoT pattern)
 * @see ../structural/active-reinforcement.ts — resolveActiveSlabReinforcementForEntity
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity } from '../types/slab-types';
import type { RebarMesh } from '../structural/reinforcement/slab-foundation-reinforcement-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveActiveSlabReinforcementForEntity } from '../structural/active-reinforcement';
import { REBAR_COLOR_HEX as REBAR_COLOR } from '../structural/rebar-catalog';

const MIN_LINE_PX = 0.6;

/** Πλάτος γραμμής ανάλογο της διαμέτρου ράβδου (px), με πρακτικό ελάχιστο. */
function lineWidthFor(diameterMm: number, pxPerMm: number): number {
  return Math.max(MIN_LINE_PX, diameterMm * pxPerMm);
}

/** Axis-aligned bbox (canvas units) από τις κορυφές του outline. */
interface Bbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function outlineBbox(verts: readonly { x: number; y: number }[]): Bbox | null {
  if (verts.length < 3) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Χτίζει το clip path του πολυγώνου (screen coords) ώστε οι σχάρες να μένουν εντός. */
function clipToOutline(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  verts: readonly { x: number; y: number }[],
): void {
  ctx.beginPath();
  const p0 = worldToScreen(verts[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < verts.length; i++) {
    const p = worldToScreen(verts[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.clip();
}

/**
 * Στρώνει μία δι-διευθυντική σχάρα (ράβδοι // X + // Y) πάνω στο bbox − cover (canvas
 * units). `meshX` = γραμμές // X (constant Y, βήμα κατά Y)· `meshY` = γραμμές // Y.
 */
function strokeMesh(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (q: Point2D) => Point2D,
  bbox: Bbox,
  coverCanvas: number,
  meshX: RebarMesh,
  meshY: RebarMesh,
  s: number,
  pxPerMm: number,
): void {
  const x0 = bbox.minX + coverCanvas, x1 = bbox.maxX - coverCanvas;
  const y0 = bbox.minY + coverCanvas, y1 = bbox.maxY - coverCanvas;
  if (x1 <= x0 || y1 <= y0) return;

  // Ράβδοι // X: οριζόντιες γραμμές σε διαδοχικά y, βήμα = meshX.spacing.
  const stepY = meshX.spacingMm * s;
  if (stepY > 0) {
    ctx.lineWidth = lineWidthFor(meshX.diameterMm, pxPerMm);
    for (let y = y0; y <= y1 + 1e-6; y += stepY) {
      const a = worldToScreen({ x: x0, y });
      const b = worldToScreen({ x: x1, y });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // Ράβδοι // Y: κατακόρυφες γραμμές σε διαδοχικά x, βήμα = meshY.spacing.
  const stepX = meshY.spacingMm * s;
  if (stepX > 0) {
    ctx.lineWidth = lineWidthFor(meshY.diameterMm, pxPerMm);
    for (let x = x0; x <= x1 + 1e-6; x += stepX) {
      const a = worldToScreen({ x, y: y0 });
      const b = worldToScreen({ x, y: y1 });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

/**
 * Ζωγραφίζει τον οπλισμό μιας πλάκας στην κάτοψη. No-op αν δεν έχει ορισμένο
 * `structuralReinforcement` ή εκφυλισμένη γεωμετρία. `pxPerMm` = scene-units-per-mm × scale.
 */
export function drawSlabRebar2D(
  ctx: CanvasRenderingContext2D,
  slab: SlabEntity,
  pxPerMm: number,
  worldToScreen: (q: Point2D) => Point2D,
): void {
  const r = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return;
  const verts = slab.params.outline.vertices;
  const bbox = outlineBbox(verts);
  if (!bbox) return;
  const s = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  if (s <= 0) return;
  const cover = r.coverMm * s;

  ctx.save();
  clipToOutline(ctx, worldToScreen, verts);
  ctx.strokeStyle = REBAR_COLOR;
  ctx.fillStyle = REBAR_COLOR;

  // Κάτω σχάρα → συμπαγείς γραμμές (κύριος οπλισμός).
  ctx.setLineDash([]);
  strokeMesh(ctx, worldToScreen, bbox, cover, r.bottomMeshX, r.bottomMeshY, s, pxPerMm);

  // Άνω σχάρα → διακεκομμένες γραμμές (στηρίξεων/hogging — Revit «top mark»).
  ctx.setLineDash([6, 4]);
  strokeMesh(ctx, worldToScreen, bbox, cover, r.topMeshX, r.topMeshY, s, pxPerMm);

  ctx.restore();
}
