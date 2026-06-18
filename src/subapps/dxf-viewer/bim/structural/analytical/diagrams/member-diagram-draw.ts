/**
 * Member diagram draw — pure canvas primitives (ADR-483, T3-UI / Slice 4).
 *
 * Σχεδιάζει τη διαδρομή διαγράμματος ενός μέλους **σε screen space**: ο overlay
 * προβάλλει τα άκρα i/j σε οθόνη (`worldToScreen`), εδώ γίνεται το offset κάθετα
 * στον άξονα κατά `value · pxScale` (σταθερό pixel ύψος, zoom-stable — όπως τα
 * Robot results overlays). Καμπύλη + translucent γέμισμα + baseline + ετικέτα
 * ακραίας τιμής σε pill (reuse `canvas-pill` SSoT).
 *
 * Pure — no React, no stores (ADR-040 compliant). Μηδέν μετρικά εδώ — όλα έρχονται
 * έτοιμα από `member-diagram-geometry`.
 *
 * @see ./member-diagram-geometry.ts — η πηγή των διαδρομών
 * @see ../../../../rendering/utils/canvas-pill.ts — pill SSoT
 */

import type { Point2D } from '../../../../rendering/types/Types';
import { pillPath, PILL_BG_COLOR, contrastTextColor } from '../../../../rendering/utils/canvas-pill';
import type { MemberDiagramPath, DiagramSample } from './member-diagram-geometry';

/** Χρωματικό στυλ ανά εντατικό μέγεθος (stroke + translucent fill). */
export interface DiagramDrawStyle {
  readonly stroke: string;
  readonly fill: string;
}

const LABEL_FONT = '11px sans-serif';
const PILL_PAD_X = 5;
const PILL_HEIGHT = 16;
const CURVE_WIDTH = 1.25;
const BASELINE_WIDTH = 0.75;

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Μοναδιαίο κάθετο διάνυσμα (screen space) στον άξονα i→j. */
function perpUnit(i: Point2D, j: Point2D): Point2D {
  const dx = j.x - i.x;
  const dy = j.y - i.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** Σημείο offset μιας στάθμης: βάση στον άξονα + κάθετο · value · κλίμακα. */
function offsetPoint(
  si: Point2D,
  sj: Point2D,
  normal: Point2D,
  sample: DiagramSample,
  pxScale: number,
): Point2D {
  const base = lerp(si, sj, sample.f);
  return { x: base.x + normal.x * sample.value * pxScale, y: base.y + normal.y * sample.value * pxScale };
}

/**
 * Σχεδίασε το διάγραμμα ενός μέλους: γέμισμα (άξονας→καμπύλη→άξονας) + καμπύλη +
 * baseline. `si`/`sj` = άκρα i/j σε οθόνη· `pxScale` = px ανά μονάδα τιμής.
 */
export function drawMemberDiagram(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  path: MemberDiagramPath,
  pxScale: number,
  style: DiagramDrawStyle,
): void {
  const normal = perpUnit(si, sj);

  // Translucent ribbon between the member axis and the diagram curve.
  ctx.beginPath();
  ctx.moveTo(si.x, si.y);
  for (const s of path.samples) {
    const p = offsetPoint(si, sj, normal, s, pxScale);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(sj.x, sj.y);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();

  // Diagram curve.
  ctx.beginPath();
  path.samples.forEach((s, idx) => {
    const p = offsetPoint(si, sj, normal, s, pxScale);
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = CURVE_WIDTH;
  ctx.stroke();

  // Member axis baseline.
  ctx.beginPath();
  ctx.moveTo(si.x, si.y);
  ctx.lineTo(sj.x, sj.y);
  ctx.lineWidth = BASELINE_WIDTH;
  ctx.stroke();
}

/** Ετικέτα ακραίας τιμής σε pill, στη στάθμη μέγιστης |τιμής|. `unit` = SI σύμβολο. */
export function drawDiagramExtremum(
  ctx: CanvasRenderingContext2D,
  si: Point2D,
  sj: Point2D,
  path: MemberDiagramPath,
  pxScale: number,
  unit: string,
): void {
  const normal = perpUnit(si, sj);
  const p = offsetPoint(si, sj, normal, path.extremum, pxScale);
  const text = `${path.extremum.value.toLocaleString('el-GR', { maximumFractionDigits: 1 })} ${unit}`;

  ctx.font = LABEL_FONT;
  const boxW = ctx.measureText(text).width + PILL_PAD_X * 2;
  pillPath(ctx, p.x - boxW / 2, p.y - PILL_HEIGHT / 2, boxW, PILL_HEIGHT, 3);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();

  ctx.fillStyle = contrastTextColor(PILL_BG_COLOR);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x, p.y);
}
