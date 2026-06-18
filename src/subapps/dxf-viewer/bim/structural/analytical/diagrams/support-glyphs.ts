/**
 * Support glyphs — pure canvas primitives (ADR-483, T3-UI / Slice 4b+).
 *
 * Σχεδιάζει τα σύμβολα στήριξης (Robot/SAP2000 boundary-condition glyphs) στους
 * δεσμευμένους κόμβους του αναλυτικού φορέα, σε screen space: **άρθρωση** (pinned) =
 * τρίγωνο με γραμμή εδάφους· **πάκτωση** (fixed) = γεμάτο τρίγωνο + hatch (encastre).
 * Ο μηχανικός διαβάζει τις συνοριακές συνθήκες με μια ματιά.
 *
 * Pure — no React, no stores (ADR-040 compliant). Ο overlay προβάλλει τη θέση κόμβου
 * (μέτρα → canvas → screen) και καλεί εδώ.
 *
 * @see ../analytical-model-types.ts — AnalyticalSupport (nodeId, supportType)
 */

import type { Point2D } from '../../../../rendering/types/Types';
import type { AnalyticalSupportType } from '../analytical-model-types';

const SIZE = 11;
const HATCH = 4.5;
const STROKE = 'rgba(30,34,42,0.95)';
const HALO = 'rgba(255,255,255,0.95)';
const FILL_FIXED = 'rgba(30,34,42,0.95)';
const FILL_PINNED = '#ffffff';

/** Διαδρομή τριγώνου (κορυφή στον κόμβο, βάση από κάτω) + γραμμή εδάφους + hatch. */
function tracePath(ctx: CanvasRenderingContext2D, p: Point2D, baseY: number, type: AnalyticalSupportType): void {
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - SIZE * 0.7, baseY);
  ctx.lineTo(p.x + SIZE * 0.7, baseY);
  ctx.closePath();
}

/**
 * Σύμβολο στήριξης με κορυφή στον κόμβο `p` (απεικόνιση σε κάτοψη): λευκό halo (για να
 * ξεχωρίζει πάνω σε κολόνα/γέμισμα) + τρίγωνο προς τα κάτω + γραμμή εδάφους· πάκτωση =
 * γεμάτο + 3 hatch ticks (encastre), άρθρωση = κενό.
 */
export function drawSupportGlyph(
  ctx: CanvasRenderingContext2D,
  p: Point2D,
  type: AnalyticalSupportType,
): void {
  const baseY = p.y + SIZE;
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';

  // Halo: παχιά λευκή περίμετρος ώστε το σύμβολο να ξεχωρίζει σε κάθε φόντο.
  tracePath(ctx, p, baseY, type);
  ctx.lineWidth = 4;
  ctx.strokeStyle = HALO;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - SIZE, baseY);
  ctx.lineTo(p.x + SIZE, baseY);
  ctx.stroke();

  // Τρίγωνο.
  tracePath(ctx, p, baseY, type);
  ctx.fillStyle = type === 'fixed' ? FILL_FIXED : FILL_PINNED;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = STROKE;
  ctx.stroke();

  // Γραμμή εδάφους.
  ctx.beginPath();
  ctx.moveTo(p.x - SIZE, baseY);
  ctx.lineTo(p.x + SIZE, baseY);
  ctx.stroke();

  // Πάκτωση → hatch ticks (encastre).
  if (type === 'fixed') {
    for (let i = -1; i <= 1; i++) {
      const x = p.x + i * HATCH * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x - HATCH, baseY + HATCH);
      ctx.stroke();
    }
  }
  ctx.restore();
}
