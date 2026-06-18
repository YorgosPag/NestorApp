/**
 * Member load arrows — pure canvas primitives (ADR-483, T3-UI / Slice 4b).
 *
 * Σχεδιάζει τη **σειρά βελών ομοιόμορφου φορτίου (UDL)** ενός φέροντος δοκαριού σε
 * screen space: μια λεπτή ζώνη βελών πάνω από τον άξονα του μέλους, με τα βέλη να
 * δείχνουν **προς** το δοκάρι (το φορτίο πιέζει τη δοκό) + ετικέτα `… kN/m` στο μέσο.
 * Robot/SAP2000 plan-view distributed-load symbol.
 *
 * Pure — no React, no stores (ADR-040 compliant). Η τιμή `w_Ed` έρχεται έτοιμη από
 * το `section-context` (`designLineLoadKnM`, ADR-472)· εδώ μόνο γεωμετρία βελών.
 *
 * @see ./member-diagram-draw.ts — αδελφό draw module (διάγραμμα ροπής/τέμνουσας)
 * @see ../../section-context.ts — designLineLoadKnM (η πηγή του w_Ed)
 */

import type { Point2D } from '../../../../rendering/types/Types';
import { PILL_BG_COLOR, contrastTextColor, pillPath } from '../../../../rendering/utils/canvas-pill';

/** Χρωματικό στυλ βελών φορτίου (γραμμή άξονα/βελών + γέμισμα κεφαλής). */
export interface LoadArrowStyle {
  readonly stroke: string;
  readonly fill: string;
}

const ARROW_LENGTH_PX = 15;
const ARROW_HEAD_PX = 5;
const ARROW_SPACING_PX = 24;
const MIN_ARROWS = 2;
const MAX_ARROWS = 14;
const SHAFT_WIDTH = 1;
const LABEL_FONT = '10px sans-serif';
const LABEL_PAD_X = 5;
const LABEL_HEIGHT = 15;
const LABEL_GAP_PX = 9;

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Μοναδιαίο κάθετο διάνυσμα (screen) προς τα **πάνω** (αρνητικό y) στον άξονα i→j. */
function upwardPerp(i: Point2D, j: Point2D): Point2D {
  const dx = j.x - i.x;
  const dy = j.y - i.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / len, y: dx / len };
  return n.y <= 0 ? n : { x: -n.x, y: -n.y };
}

/** Ένα βέλος: στέλεχος από τη ζώνη (tail) → άξονας (head) + κεφαλή προς τον άξονα. */
function drawArrow(ctx: CanvasRenderingContext2D, tail: Point2D, head: Point2D, up: Point2D, color: string): void {
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(head.x, head.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = SHAFT_WIDTH;
  ctx.stroke();
  // Κεφαλή (δύο πτερύγια) στο head, ανοίγει προς τα πίσω (up) ± πλάγια.
  const side = { x: -up.y, y: up.x };
  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x + up.x * ARROW_HEAD_PX + side.x * ARROW_HEAD_PX * 0.6, head.y + up.y * ARROW_HEAD_PX + side.y * ARROW_HEAD_PX * 0.6);
  ctx.lineTo(head.x + up.x * ARROW_HEAD_PX - side.x * ARROW_HEAD_PX * 0.6, head.y + up.y * ARROW_HEAD_PX - side.y * ARROW_HEAD_PX * 0.6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Ετικέτα `w kN/m` σε pill, στο μέσο της ζώνης βελών (πάνω από αυτήν). */
function drawLoadLabel(ctx: CanvasRenderingContext2D, mid: Point2D, up: Point2D, wKnM: number, unit: string): void {
  const text = `${wKnM.toLocaleString('el-GR', { maximumFractionDigits: 1 })} ${unit}`;
  const p = { x: mid.x + up.x * (ARROW_LENGTH_PX + LABEL_GAP_PX), y: mid.y + up.y * (ARROW_LENGTH_PX + LABEL_GAP_PX) };
  ctx.font = LABEL_FONT;
  const boxW = ctx.measureText(text).width + LABEL_PAD_X * 2;
  pillPath(ctx, p.x - boxW / 2, p.y - LABEL_HEIGHT / 2, boxW, LABEL_HEIGHT, 3);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();
  ctx.fillStyle = contrastTextColor(PILL_BG_COLOR);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x, p.y);
}

/**
 * Σχεδίασε τα βέλη UDL ενός δοκαριού: ζώνη βελών (tail-line) πάνω από τον άξονα +
 * βέλη προς τον άξονα + ετικέτα `w kN/m`. No-op όταν `wKnM ≤ 0` (αφόρτιστο). `unit`
 * = SI σύμβολο (kN/m).
 */
export function drawMemberLoadArrows(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  wKnM: number,
  unit: string,
  style: LoadArrowStyle,
): void {
  if (wKnM <= 0) return;
  const len = Math.hypot(sj.x - si.x, sj.y - si.y);
  if (len < 1) return;
  const up = upwardPerp(si, sj);
  const tailOf = (p: Point2D): Point2D => ({ x: p.x + up.x * ARROW_LENGTH_PX, y: p.y + up.y * ARROW_LENGTH_PX });
  const tailI = tailOf(si);
  const tailJ = tailOf(sj);

  // Tail-line (κορυφή ζώνης).
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(tailI.x, tailI.y);
  ctx.lineTo(tailJ.x, tailJ.y);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = SHAFT_WIDTH;
  ctx.stroke();

  // Βέλη ομοιόμορφα κατανεμημένα (head στον άξονα, δείχνουν προς τα κάτω/μέλος).
  const count = Math.max(MIN_ARROWS, Math.min(MAX_ARROWS, Math.round(len / ARROW_SPACING_PX)));
  const down = { x: -up.x, y: -up.y };
  for (let k = 0; k <= count; k++) {
    const t = k / count;
    drawArrow(ctx, lerp(tailI, tailJ, t), lerp(si, sj, t), down, style.stroke);
  }

  drawLoadLabel(ctx, lerp(si, sj, 0.5), up, wKnM, unit);
  ctx.restore();
}
