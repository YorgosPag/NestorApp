/**
 * @module rotation-direction-arc
 * @description Ένδειξη ΦΟΡΑΣ περιστροφής (hot-grip rotate, ADR-397 §15) — διακεκομμένη baseline 0° +
 * χρωματισμένο τόξο φοράς + βελάκι + ΧΡΩΜΑΤΙΣΤΗ ζωντανή γωνία (signed, 2 δεκαδικά, χωρίς pill), από
 * τον άξονα αναφοράς προς τον κέρσορα. Revit/Maxon(C4D)/Figma-grade rotate HUD: το τόξο «γεμίζει»
 * κατά τη φορά της περιστροφής, με χρώμα ανά πρόσημο της γωνίας sweep:
 *   • sweep > 0 (CCW, η οντότητα ΑΝΕΒΑΙΝΕΙ ως προς τον άξονα αναφοράς) → 🟢 πράσινες μοίρες
 *   • sweep < 0 (CW,  η οντότητα ΚΑΤΕΒΑΙΝΕΙ ως προς τον άξονα αναφοράς) → 🔴 κόκκινες μοίρες
 *
 * Το πρόσημο/χρώμα οδηγείται ΑΠΟΚΛΕΙΣΤΙΚΑ από το `rotateSweepDeg` (ήδη signed +CCW/−CW ως προς
 * τη γραμμή pivot→anchor) — ΟΧΙ από τον world-X — ώστε να ισχύει και για λοξό άξονα αναφοράς
 * (απόφαση Giorgio 2026-07-01). Η ΦΟΡΑ σχεδίασης του τόξου στην οθόνη υπολογίζεται από τις
 * screen θέσεις (Y-flip safe), ενώ το ΧΡΩΜΑ από το world sweep — διακριτές ευθύνες.
 *
 * Pure module: zero React / stores / DOM-state (ADR-040 micro-leaf safe). Μηδέν νέα παλέτα —
 * αντλεί 🟢/🔴 από το `resolveGhostStatusColor` SSoT. Οι ζωντανές μοίρες (signed) ζωγραφίζονται
 * ΗΔΗ από το readout pill (`formatMoveAngle`) στο `useGripGhostPreview` — εδώ μόνο το τόξο.
 *
 * @see hooks/tools/useGripGhostPreview — ο καταναλωτής (rotation branch)
 * @see hooks/grips/grip-projections.ts — πηγή `rotateSweepDeg` / `anchorPos` / `rotateReadoutAnchor`
 * @see bim/ghosts/ghost-status-color.ts — SSoT 🟢/🔴 παλέτα
 * @see ADR-397 §15 — rotation direction arc
 * @see ADR-040 — Preview Canvas Performance
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { formatAngleLocale } from '../../rendering/entities/shared/distance-label-utils';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Κάτω από αυτό το |sweep| (μοίρες) δεν ζωγραφίζεται τόξο (μηδενική/θόρυβος περιστροφή). */
export const ROTATION_ARC_MIN_SWEEP_DEG = 0.1;
/** Ελάχιστη ακτίνα τόξου (CSS px) ώστε να φαίνεται όταν ο κέρσορας είναι κοντά στο pivot. */
const MIN_ARC_RADIUS_PX = 32;
/** Απόσταση της ετικέτας μοιρών έξω από το τόξο, στη διχοτόμο. */
const LABEL_GAP_PX = 18;
/** Μήκος κεφαλής βέλους (από την αιχμή προς τα πίσω) σε CSS px. */
const ARROW_HEAD_PX = 11;
/** Μισό άνοιγμα πτερυγίων κεφαλής βέλους σε CSS px. */
const ARROW_HEAD_HALF_PX = 5;
/** Πάχος γραμμής τόξου. */
const ARC_LINE_WIDTH = 1;
/** Γραμματοσειρά της ετικέτας μοιρών (χρωματιστή, χωρίς pill — Giorgio 2026-07-01). */
const ANGLE_LABEL_FONT = 'bold 15px sans-serif';
/** Δεκαδικά ψηφία της ζωντανής γωνίας (Giorgio: «δύο δεκαδικά»). */
const ANGLE_LABEL_DECIMALS = 2;
/** Διακεκομμένη baseline (γραμμή έναρξης μέτρησης γωνιών, 0° άξονας αναφοράς). */
const BASELINE_DASH: readonly number[] = [5, 4];
/** Ουδέτερο ημιδιάφανο λευκό για την baseline (ορατό σε μαύρο canvas, χωρίς πρόσημο/χρώμα). */
const BASELINE_COLOR = 'rgba(255,255,255,0.55)';
/** Πάχος γραμμής baseline. */
const BASELINE_LINE_WIDTH = 1;

// ── Pure geometry / color ───────────────────────────────────────────────────────

/** Screen-space γεωμετρία του τόξου φοράς (όλα σε CSS px, κέντρο στο pivot). */
export interface RotationDirectionArc {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  /** Γωνία έναρξης (άξονας αναφοράς), screen rad. */
  readonly startAngle: number;
  /** Γωνία λήξης (κέρσορας), screen rad. */
  readonly endAngle: number;
  /** Φορά σχεδίασης για `ctx.arc` (true = αριστερόστροφα στην οθόνη). */
  readonly anticlockwise: boolean;
  /** Αιχμή βέλους (στο άκρο «κέρσορας» του τόξου). */
  readonly tip: Point2D;
  /** Μοναδιαίο εφαπτομενικό διάνυσμα στην αιχμή, κατά τη φορά σάρωσης. */
  readonly tipDir: Point2D;
  /** Θέση της ετικέτας μοιρών (στη διχοτόμο, έξω από το τόξο). */
  readonly labelPos: Point2D;
  /** Άκρο της baseline 0° (pivot → άξονας αναφοράς, στην ακτίνα του τόξου). */
  readonly baselineEnd: Point2D;
  /** Πρόσημο γωνίας (world sweep): +1 = CCW/πράσινο, −1 = CW/κόκκινο. */
  readonly sign: 1 | -1;
}

/** Κανονικοποίηση γωνίας στο (−π, π]. */
function normalizeToPi(rad: number): number {
  return Math.atan2(Math.sin(rad), Math.cos(rad));
}

/**
 * Χρώμα τόξου ανά πρόσημο sweep, από το SSoT 🟢/🔴 (`resolveGhostStatusColor`). sweep ≥ 0 →
 * πράσινο (`beam`), sweep < 0 → κόκκινο (`overlap`). Μηδέν hardcode hex.
 */
export function resolveRotationArcColor(sweepDeg: number): string {
  const color = resolveGhostStatusColor(sweepDeg >= 0 ? 'beam' : 'overlap');
  // `beam`/`overlap` επιστρέφουν πάντα χρώμα (μόνο `neutral` → null)· fallback για type-safety.
  return color?.stroke ?? '#2e9e44';
}

/**
 * Υπολόγισε τη γεωμετρία του τόξου φοράς σε screen space. `pivotS`/`anchorS`/`cursorS` είναι ήδη
 * προβεβλημένα. Επιστρέφει `null` όταν το |sweep| είναι αμελητέο (καμία ένδειξη). Η ΦΟΡΑ τόξου
 * προκύπτει από τις screen θέσεις (Y-flip safe)· το ΧΡΩΜΑ/πρόσημο από το world `sweepDeg`.
 */
export function resolveRotationDirectionArc(
  pivotS: Point2D,
  anchorS: Point2D,
  cursorS: Point2D,
  sweepDeg: number,
): RotationDirectionArc | null {
  if (!Number.isFinite(sweepDeg) || Math.abs(sweepDeg) < ROTATION_ARC_MIN_SWEEP_DEG) return null;
  const refAngle = Math.atan2(anchorS.y - pivotS.y, anchorS.x - pivotS.x);
  const curAngle = Math.atan2(cursorS.y - pivotS.y, cursorS.x - pivotS.x);
  const screenSweep = normalizeToPi(curAngle - refAngle);
  if (Math.abs(screenSweep) < 1e-6) return null;
  const radius = Math.max(MIN_ARC_RADIUS_PX, Math.hypot(cursorS.x - pivotS.x, cursorS.y - pivotS.y));
  const endAngle = refAngle + screenSweep;
  const dir = Math.sign(screenSweep);
  const tip = { x: pivotS.x + radius * Math.cos(endAngle), y: pivotS.y + radius * Math.sin(endAngle) };
  const tipDir = { x: -Math.sin(endAngle) * dir, y: Math.cos(endAngle) * dir };
  const baselineEnd = { x: pivotS.x + radius * Math.cos(refAngle), y: pivotS.y + radius * Math.sin(refAngle) };
  const bis = refAngle + screenSweep / 2;
  const gr = radius + LABEL_GAP_PX;
  const labelPos = { x: pivotS.x + gr * Math.cos(bis), y: pivotS.y + gr * Math.sin(bis) };
  return {
    cx: pivotS.x,
    cy: pivotS.y,
    radius,
    startAngle: refAngle,
    endAngle,
    anticlockwise: screenSweep < 0,
    tip,
    tipDir,
    labelPos,
    baselineEnd,
    sign: sweepDeg >= 0 ? 1 : -1,
  };
}

// ── Paint ───────────────────────────────────────────────────────────────────────

/** Γεμάτη τριγωνική κεφαλή βέλους στην αιχμή `tip`, κατά τη φορά `dir` (ίδιο μοτίβο με UDL βέλη). */
function drawArcArrowhead(ctx: CanvasRenderingContext2D, tip: Point2D, dir: Point2D): void {
  const side = { x: -dir.y, y: dir.x };
  const bx = tip.x - dir.x * ARROW_HEAD_PX;
  const by = tip.y - dir.y * ARROW_HEAD_PX;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(bx + side.x * ARROW_HEAD_HALF_PX, by + side.y * ARROW_HEAD_HALF_PX);
  ctx.lineTo(bx - side.x * ARROW_HEAD_HALF_PX, by - side.y * ARROW_HEAD_HALF_PX);
  ctx.closePath();
  ctx.fill();
}

/**
 * Ζωντανή γωνία (signed, 2 δεκαδικά) ως ΧΡΩΜΑΤΙΣΤΟ κείμενο στη διχοτόμο — χωρίς pill (Giorgio
 * 2026-07-01: «σβήσε το λευκό label, γράψε τις μοίρες κόκκινες/πράσινες, δύο δεκαδικά»). Το πρόσημο
 * («−»/θετικό) έρχεται από τον SSoT formatter `formatAngleLocale`, οι μοίρες δεξιά του.
 */
function drawAngleLabel(ctx: CanvasRenderingContext2D, pos: Point2D, sweepDeg: number, color: string): void {
  ctx.fillStyle = color;
  ctx.font = ANGLE_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatAngleLocale(sweepDeg, ANGLE_LABEL_DECIMALS), pos.x, pos.y);
}

/** Διακεκομμένη baseline 0° (pivot → άξονας αναφοράς) — δείχνει το σημείο έναρξης μέτρησης γωνιών. */
function drawBaseline(ctx: CanvasRenderingContext2D, from: Point2D, to: Point2D): void {
  ctx.save();
  ctx.setLineDash([...BASELINE_DASH]);
  ctx.strokeStyle = BASELINE_COLOR;
  ctx.lineWidth = BASELINE_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Ζωγράφισε το τόξο φοράς περιστροφής στο PreviewCanvas ctx: διακεκομμένη baseline 0° + χρωματισμένο
 * τόξο (🟢 +CCW / 🔴 −CW) + βελάκι στο άκρο «κέρσορας» + ΧΡΩΜΑΤΙΣΤΗ ζωντανή γωνία (signed, 2 δεκαδικά)
 * στη διχοτόμο. No-op όταν το |sweep| είναι αμελητέο. `pivotW`/`anchorW`/`cursorW` σε world·
 * προβάλλονται εδώ μέσω του `CoordinateTransforms` SSoT.
 */
export function paintRotationDirectionArc(
  ctx: CanvasRenderingContext2D,
  pivotW: Point2D,
  anchorW: Point2D,
  cursorW: Point2D,
  sweepDeg: number,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const pivotS = CoordinateTransforms.worldToScreen(pivotW, transform, viewport);
  const anchorS = CoordinateTransforms.worldToScreen(anchorW, transform, viewport);
  const cursorS = CoordinateTransforms.worldToScreen(cursorW, transform, viewport);
  const arc = resolveRotationDirectionArc(pivotS, anchorS, cursorS, sweepDeg);
  if (!arc) return;
  const color = resolveRotationArcColor(sweepDeg);
  // Baseline 0° (διακεκομμένη, ουδέτερη) ΠΡΩΤΑ ώστε το τόξο/βέλος να πατούν από πάνω.
  drawBaseline(ctx, { x: arc.cx, y: arc.cy }, arc.baselineEnd);
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = ARC_LINE_WIDTH;
  ctx.beginPath();
  ctx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle, arc.anticlockwise);
  ctx.stroke();
  drawArcArrowhead(ctx, arc.tip, arc.tipDir);
  drawAngleLabel(ctx, arc.labelPos, sweepDeg, color);
  ctx.restore();
}
