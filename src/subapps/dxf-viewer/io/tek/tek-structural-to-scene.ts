/**
 * ADR-531 Φ5b.1 (Tekton .TEK IMPORT — structural, 2Δ) — mappers `TekWallRecord`/`TekDimRecord`
 * → 2Δ scene primitives (γραμμές + κείμενο). Πιστή 2Δ αναπαράσταση ΠΡΙΝ το πλήρες BIM (Φ5b.2):
 *
 *   - **Τοίχος** → ορθογώνιο footprint = το unit-square `[0,1]²` του Τέκτονα μέσω του `<xmatrix>`
 *     (4 γραμμές). Μηδέν υπόθεση — η ακριβής έκταση που σχεδιάζει ο Τέκτων.
 *   - **Κούφωμα** → γραμμή ανοίγματος (πλάτος) + 2 κάθετες λαβές (jambs) στο πάχος του τοίχου.
 *   - **Διάσταση** → οι ήδη υπολογισμένες `<seg>` γραμμές (με κενό) + το κείμενο τιμής (όπως τα
 *     σχεδιάζει ο Τέκτων — μηδέν geometry math, ίδια φιλοσοφία με preserve-and-replay σκαλών).
 *
 * Μονάδες + Y-flip + χρώμα μέσω των ΙΔΙΩΝ SSoT με τα line/arc (`tekMetersToScene`, `colorHex6`).
 */

import { tekMetersToScene, metersToScene } from '../../export/core/tek/tek-geometry';
import { colorHex6 } from '../../export/core/tek/tek-xml-writer';
import { generateEntityId } from '@/services/enterprise-id-convenience';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity, LineEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type {
  TekDimRecord, TekWallRecord, TekOpeningRecord, TekXMatrix, TekPoint2D,
} from './tek-import-types';

/** Default ύψος κειμένου διάστασης (μέτρα) όταν λείπει το `<size>`. */
const DIM_TEXT_FALLBACK_M = 0.15;

/** Tekton `<color>` (RGB, χωρίς `#`) → `#RRGGBB` (reuse export SSoT `colorHex6`). */
function tekColorToHex(raw: string): string {
  return `#${colorHex6(raw)}`;
}

/** Εφαρμογή του 2×3 affine `<xmatrix>` σε local (u,v) → Tekton μέτρα (Y-up). */
function applyMatrix(m: TekXMatrix, u: number, v: number): TekPoint2D {
  return { x: m.x20 + u * m.x00 + v * m.x10, y: m.x21 + u * m.x01 + v * m.x11 };
}

/** Tekton-μέτρα σημείο → scene (Y-flip + units) μέσω του SSoT. */
function toScene(p: TekPoint2D, units: SceneUnits): Point2D {
  return tekMetersToScene(p.x, p.y, units);
}

/** Δομεί ένα `LineEntity` από δύο scene σημεία. */
function makeLine(start: Point2D, end: Point2D, color: string): LineEntity {
  return { id: generateEntityId(), type: 'line', layerId: '', color, start, end };
}

// ─── Wall footprint (4 lines) ───────────────────────────────────────────────────

/** Πάχος τοίχου (Tekton μέτρα) = μήκος v-άξονα του matrix· fallback στο `inner_width`. */
function wallThicknessM(rec: TekWallRecord): number {
  const v = Math.hypot(rec.matrix.x10, rec.matrix.x11);
  return v > 1e-6 ? v : rec.innerWidthM;
}

/** `<wall>` → 4 `LineEntity` (ορθογώνιο footprint = unit-square μέσω xmatrix). */
export function tekWallToEntities(rec: TekWallRecord, units: SceneUnits): Entity[] {
  const m = rec.matrix;
  const color = tekColorToHex(rec.color);
  const corners: Point2D[] = ([[0, 0], [1, 0], [1, 1], [0, 1]] as const).map(
    ([u, v]) => toScene(applyMatrix(m, u, v), units),
  );
  const lines: Entity[] = [];
  for (let i = 0; i < 4; i++) {
    lines.push(makeLine(corners[i], corners[(i + 1) % 4], color));
  }
  for (const opening of rec.openings) {
    lines.push(...tekOpeningToEntities(opening, rec, units));
  }
  return lines;
}

/** `<open>` → γραμμή πλάτους + 2 κάθετες λαβές (jambs) στο πάχος του τοίχου-ξενιστή. */
function tekOpeningToEntities(
  open: TekOpeningRecord, wall: TekWallRecord, units: SceneUnits,
): LineEntity[] {
  const color = tekColorToHex(open.color);
  const half = wallThicknessM(wall) / 2;
  const j0 = applyMatrix(open.matrix, 0, 0); // jamb αρχή (Tekton μέτρα)
  const j1 = applyMatrix(open.matrix, 1, 0); // jamb τέλος (x00 = πλάτος)
  // Κάθετο μοναδιαίο διάνυσμα στον u-άξονα του ανοίγματος.
  const ulen = Math.hypot(open.matrix.x00, open.matrix.x01) || 1;
  const px = -open.matrix.x01 / ulen, py = open.matrix.x00 / ulen;
  const lines: LineEntity[] = [makeLine(toScene(j0, units), toScene(j1, units), color)];
  for (const j of [j0, j1]) {
    const a = toScene({ x: j.x - px * half, y: j.y - py * half }, units);
    const b = toScene({ x: j.x + px * half, y: j.y + py * half }, units);
    lines.push(makeLine(a, b, color));
  }
  return lines;
}

// ─── Dimension (replay Tekton's drawn segments + value text) ─────────────────────

/** dim → the seg lines (with gap) + the value text. */
export function tekDimToEntities(rec: TekDimRecord, units: SceneUnits): Entity[] {
  const color = tekColorToHex(rec.color);
  const sizeM = rec.textSizeM > 0 ? rec.textSizeM : DIM_TEXT_FALLBACK_M;
  const height = metersToScene(sizeM, units);
  const out: Entity[] = [];
  for (const seg of rec.segs) {
    const hasGap = !(seg.gap0.x === 0 && seg.gap0.y === 0 && seg.gap1.x === 0 && seg.gap1.y === 0);
    if (hasGap) {
      out.push(makeLine(toScene(seg.end0, units), toScene(seg.gap0, units), color));
      out.push(makeLine(toScene(seg.gap1, units), toScene(seg.end1, units), color));
    } else {
      out.push(makeLine(toScene(seg.end0, units), toScene(seg.end1, units), color));
    }
    if (seg.text) {
      out.push({
        id: generateEntityId(),
        type: 'text',
        layerId: '',
        color,
        position: toScene({ x: seg.textMatrix.x20, y: seg.textMatrix.x21 }, units),
        text: seg.text,
        height,
        fontSize: height,
        alignment: 'center',
        rotation: 0,
      });
    }
  }
  return out;
}
