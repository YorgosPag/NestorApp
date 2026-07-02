/**
 * ghost-face-dim-references — pure SSoT for the Revit-style **listening/temporary
 * dimensions** shown while a wall (or any linear-member) ghost slides ALONG an existing
 * member's face (ADR-508 §dim).
 *
 * Conceptual twin of `bim/walls/opening-dim-references.ts`: an opening slides 1D along its
 * host wall, so its temporary dimensions are OFFSETS ALONG THAT AXIS to the nearest
 * references. Here the ghost plays the opening's role — it occupies `[ghostCenterAlong ±
 * ghostHalfWidth]` along the existing face — and we measure, along the same axis:
 *   1. **leftGap**  — face LEFT end  → ghost LEFT base corner
 *   2. **rightGap** — ghost RIGHT base corner → face RIGHT end
 *   3. **centerToCenter** — face CENTER → ghost axis-center
 *
 * Giorgio (2026-06-21): «να δείχνουμε πάντα 3 νούμερα ταυτόχρονα». All three are emitted
 * every frame (no center-flip), each as two witness points ON the face line + a dim-line
 * reference point offset OUTWARD (toward the ghost) so it clears the existing wall fill.
 *
 * Pure — zero React/DOM/store/Three. Units = **scene units** (= canvas world units), the
 * same frame as `GhostFaceFrame`. The caller supplies zoom-adaptive perpendicular offsets.
 *
 * @see ./linear-member-face-snap.ts — produces the `GhostFaceFrame`
 * @see ../walls/opening-dim-references.ts — the along-axis-offset twin (openings)
 * @see ../../canvas-v2/preview-canvas/ghost-face-dim-paint.ts — renders these via the
 *      ADR-362 `renderPreviewDimension` SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { ArcMeta, GhostFaceFrame } from './linear-member-face-snap';
import { pointOnCircle, calculateAngle } from '../../rendering/entities/shared/geometry-vector-utils';
import { calculateArcLength } from '../../rendering/entities/shared/geometry-arc-utils';
import { degToRad, radToDeg, normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import {
  ARC_LISTENING_DIM_DEFAULT,
  type ArcListeningDimConfig,
} from './arc-listening-dim-config';

/**
 * ADR-398 §3.12 — γεωμετρία **καμπύλης** dim line (μόνο `arcLeftGap`/`arcRightGap`): ο painter
 * δειγματίζει την περιφέρεια `arcToPolyline({center,radius,startAngleDeg,endAngleDeg})` ώστε η dim
 * line να **ακολουθεί την καμπύλη** (όχι ευθεία χορδή). Γωνίες σε μοίρες (DXF/`arcToPolyline` convention).
 */
export interface ArcDimSpan {
  readonly center: Point2D;
  readonly radius: number;
  readonly startAngleDeg: number;
  readonly endAngleDeg: number;
}

/** A single listening dimension (scene units) — ευθεία (along-face) ή καμπύλη (arc-length). */
export interface GhostFaceDimension {
  /** Semantic role — drives label/tests· `arc*`/`radius` = ADR-398 §3.12 κύκλος/τόξο· `perp` = §3.20b κάθετη (dy)·
   *  `clearance` = ADR-508 §neighbor-clearance (πλησιέστερος γείτονας ανά κατεύθυνση, ελεύθερο ghost). */
  readonly kind: 'leftGap' | 'rightGap' | 'centerToCenter' | 'arcLeftGap' | 'arcRightGap' | 'radius' | 'perp' | 'clearance';
  /** Witness point A (scene units) — ON the face line (ευθύ) ή ON the circle at the «from» angle (arc). */
  readonly p1: Point2D;
  /** Witness point B (scene units). */
  readonly p2: Point2D;
  /** Any point on the dim line — offset OUTWARD (face) ή στο dim-arc radius στο μεσοτόξιο (arc). */
  readonly dimLineRef: Point2D;
  /** Measured distance (scene units, ≥ 0) = along-face μήκος (ευθύ) ή **μήκος τόξου** `s=r·θ` (arc). */
  readonly valueScene: number;
  /** ADR-398 §3.12 — όταν οριστεί, ο painter ζωγραφίζει **καμπύλη** dim line (arc gaps μόνο). */
  readonly arc?: ArcDimSpan;
  /** ADR-398 §3.12 — γωνία τόξου (μοίρες) για το `labelMode:'angle'|'both'` (arc gaps μόνο). */
  readonly sweepDeg?: number;
  /** ADR-508 §neighbor-clearance — world γωνία (μοίρες) της dim, τίθεται ΜΟΝΟ σε **λοξή** ένδειξη
   *  (ορθές → undefined). Ο painter την προσαρτά ως `/ γωνία°` στο label (Giorgio: «γωνία μόνο σε λοξές»). */
  readonly angleDeg?: number;
}

/** Renderable bundle attached to the wall ghost preview entity (carries the unit system). */
export interface GhostFaceDimensionsMeta {
  readonly sceneUnits: SceneUnits;
  readonly dims: readonly GhostFaceDimension[];
  /** ADR-398 §3.12 — πώς γράφονται οι ετικέτες των arc gaps (length/angle/both)· default 'length'. */
  readonly labelMode?: ArcListeningDimConfig['labelMode'];
}

export interface GhostFaceDimensionsOptions {
  /** Perpendicular offset (scene units) for the two end-gap dims — the inner stacked row.
   *  ADR-398 §3.12 — και η ακτινική απόσταση του dim-arc από την περιφέρεια (arc gaps). */
  readonly gapOffsetScene: number;
  /** Perpendicular offset (scene units) for the center-to-center dim — the outer row,
   *  larger so it clears the ghost stub it spans over. */
  readonly centerOffsetScene: number;
  /** Distances below this (scene units) are dropped (flush / zero-width → no dim). */
  readonly minValueScene?: number;
  /** ADR-398 §3.12 — ρυθμίσεις arc dims (ποιες εκπέμπονται)· default `ARC_LISTENING_DIM_DEFAULT`. */
  readonly arcConfig?: ArcListeningDimConfig;
}

/**
 * Resolve the ≤3 along-face listening dimensions for a sliding ghost on `frame`. Returns
 * the dims whose measured value exceeds `minValueScene` (a flush end / centred ghost drops
 * the corresponding zero dim). Pure.
 */
export function resolveGhostFaceDimensions(
  frame: Readonly<GhostFaceFrame>,
  opts: Readonly<GhostFaceDimensionsOptions>,
): readonly GhostFaceDimension[] {
  const minValue = opts.minValueScene ?? 1e-6;
  // ADR-398 §3.12 — ΚΥΚΛΟΣ/ΤΟΞΟ: μήκος τόξου + καμπύλη dim line (gated νέος κλάδος· ο ευθύς μένει αμετάβλητος).
  if (frame.arc) return resolveArcGhostDimensions(frame, frame.arc, opts, minValue);

  const { origin: a, axisDir: u, perpDir: p, facePerp, outwardSign } = frame;

  // Point on the face line at longitudinal position `along` — κοινό SSoT `facePointAt` (ίδιο με arc branch).
  const at = (along: number): Point2D => facePointAt(frame, along);
  // Point offset OUTWARD (toward the ghost) from the face line at `along` by `d`.
  const off = (along: number, d: number): Point2D => ({
    x: a.x + along * u.x + (facePerp + outwardSign * d) * p.x,
    y: a.y + along * u.y + (facePerp + outwardSign * d) * p.y,
  });

  const faceCenterAlong = (frame.faceAlongMin + frame.faceAlongMax) / 2;
  const ghostLeftAlong = frame.ghostCenterAlong - frame.ghostHalfWidth;
  const ghostRightAlong = frame.ghostCenterAlong + frame.ghostHalfWidth;

  const out: GhostFaceDimension[] = [];

  // 1. leftGap — face left end → ghost left base corner.
  pushDim(out, 'leftGap', frame.faceAlongMin, ghostLeftAlong, opts.gapOffsetScene, at, off, minValue);
  // 2. rightGap — ghost right base corner → face right end.
  pushDim(out, 'rightGap', ghostRightAlong, frame.faceAlongMax, opts.gapOffsetScene, at, off, minValue);
  // 3. centerToCenter — face center → ghost axis-center (outer row, larger offset).
  pushDim(out, 'centerToCenter', faceCenterAlong, frame.ghostCenterAlong, opts.centerOffsetScene, at, off, minValue);
  // 4. ADR-398 §3.20b — ΚΑΘΕΤΗ (dy): γραμμή αναφοράς → κέντρο φαντάσματος κατά `perpDir` (πλήρες
  //    καρτεσιανό dx+dy). Μόνο όταν `ghostPerpOffset` ορίστηκε (circumference-tangent· perp = R).
  pushPerpDim(out, frame, opts.gapOffsetScene, minValue);

  return out;
}

/**
 * ADR-398 §3.20b — μία ΚΑΘΕΤΗ (dy) listening dimension: από τη γραμμή αναφοράς (`facePerp`-line) στη
 * διαμήκη θέση του κέντρου, μέχρι το ΚΕΝΤΡΟ του φαντάσματος (offset `ghostPerpOffset` κατά `perpDir`). Η
 * dim line μετατοπίζεται **κατά μήκος του άξονα** (`gapOffsetScene`) ώστε να μην επικαλύπτει την κάθετη.
 */
function pushPerpDim(
  out: GhostFaceDimension[],
  frame: Readonly<GhostFaceFrame>,
  offsetScene: number,
  minValue: number,
): void {
  const perpOffset = frame.ghostPerpOffset ?? 0;
  if (Math.abs(perpOffset) <= minValue) return;
  const { axisDir: u, perpDir: p } = frame;
  const base = facePointAt(frame, frame.ghostCenterAlong); // πάνω στη γραμμή αναφοράς
  const center: Point2D = { x: base.x + perpOffset * p.x, y: base.y + perpOffset * p.y };
  out.push({
    kind: 'perp',
    p1: base,
    p2: center,
    dimLineRef: { x: (base.x + center.x) / 2 + offsetScene * u.x, y: (base.y + center.y) / 2 + offsetScene * u.y },
    valueScene: Math.abs(perpOffset),
  });
}

/** Build one dim from two longitudinal positions; append only when length > `minValue`. */
function pushDim(
  out: GhostFaceDimension[],
  kind: GhostFaceDimension['kind'],
  alongA: number,
  alongB: number,
  offsetScene: number,
  at: (along: number) => Point2D,
  off: (along: number, d: number) => Point2D,
  minValue: number,
): void {
  const valueScene = Math.abs(alongB - alongA);
  if (valueScene <= minValue) return;
  out.push({
    kind,
    p1: at(alongA),
    p2: at(alongB),
    dimLineRef: off((alongA + alongB) / 2, offsetScene),
    valueScene,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// ADR-398 §3.12 — ARC-LENGTH listening dimensions (ΚΥΚΛΟΣ + ΤΟΞΟ)
// ──────────────────────────────────────────────────────────────────────────────

/** Τεταρτημόρια (AutoCAD QUADRANT osnap) — datum βάση κάθε κύκλου/τόξου. */
const QUADRANTS_DEG: readonly number[] = [0, 90, 180, 270];

/**
 * ADR-398 §3.12 — **datum angles** (μοίρες, [0,360)) που εξυπηρετούν κάθε λογική χρήστη: τεταρτημόρια
 * **εντός** του angular span + (αν τόξο) τα **πραγματικά άκρα**. Κύκλος (span 360°) → 4 τεταρτημόρια.
 */
function arcDatumAngles(arc: Readonly<ArcMeta>): number[] {
  const rawSpan = arc.endAngle - arc.startAngle;
  const isFull = Math.abs(rawSpan) >= 360 - 1e-6 || normalizeAngleDeg(rawSpan) < 1e-6;
  const span = isFull ? 360 : normalizeAngleDeg(rawSpan);
  const start = normalizeAngleDeg(arc.startAngle);
  const datums: number[] = [];
  for (const q of QUADRANTS_DEG) {
    if (isFull || normalizeAngleDeg(q - start) <= span + 1e-6) datums.push(q);
  }
  if (!isFull) datums.push(normalizeAngleDeg(arc.startAngle), normalizeAngleDeg(arc.endAngle));
  return datums;
}

/** Πλησιέστερα bracketing datums γύρω από `thetaDeg`: CW (φθίνουσα γωνία) + CCW (αύξουσα). */
function bracketDatums(datums: readonly number[], thetaDeg: number): { cwDeg: number; ccwDeg: number } | null {
  let cwDeg: number | null = null, ccwDeg: number | null = null;
  let cwGap = Infinity, ccwGap = Infinity;
  for (const d of datums) {
    const ccw = normalizeAngleDeg(d - thetaDeg); // θ → d CCW
    const cw = normalizeAngleDeg(thetaDeg - d);  // θ → d CW
    if (ccw > 1e-6 && ccw < ccwGap) { ccwGap = ccw; ccwDeg = d; }
    if (cw > 1e-6 && cw < cwGap) { cwGap = cw; cwDeg = d; }
  }
  return cwDeg !== null && ccwDeg !== null ? { cwDeg, ccwDeg } : null;
}

/** Σημείο στη γραμμή παρειάς (facePerp 0 σε κεντραρισμένο arc frame) στη διαμήκη θέση `along`. */
function facePointAt(frame: Readonly<GhostFaceFrame>, along: number): Point2D {
  return {
    x: frame.origin.x + along * frame.axisDir.x + frame.facePerp * frame.perpDir.x,
    y: frame.origin.y + along * frame.axisDir.y + frame.facePerp * frame.perpDir.y,
  };
}

/** Ένα καμπύλο arc gap (datum→column ή column→datum) — μήκος τόξου `s=r·θ` + curved render span. */
function pushArcGap(
  out: GhostFaceDimension[],
  kind: 'arcLeftGap' | 'arcRightGap',
  arc: Readonly<ArcMeta>,
  fromDeg: number,
  toDeg: number,
  offsetScene: number,
  minValue: number,
): void {
  const sweepDeg = normalizeAngleDeg(toDeg - fromDeg);
  // μήκος τόξου μέσω του SSoT `calculateArcLength` (= radius · sweepRad). ΜΗΝ ξαναγράψεις s=r·θ.
  const valueScene = calculateArcLength(arc.radius, degToRad(fromDeg), degToRad(toDeg));
  if (valueScene <= minValue) return;
  const midDeg = fromDeg + sweepDeg / 2;
  out.push({
    kind,
    p1: pointOnCircle(arc.center, arc.radius, degToRad(fromDeg)),
    p2: pointOnCircle(arc.center, arc.radius, degToRad(toDeg)),
    dimLineRef: pointOnCircle(arc.center, arc.radius + offsetScene, degToRad(midDeg)),
    valueScene,
    arc: { center: arc.center, radius: arc.radius, startAngleDeg: fromDeg, endAngleDeg: toDeg },
    sweepDeg,
  });
}

/**
 * ADR-398 §3.12 — οι arc-length listening dimensions για κολώνα στη γωνία `θ` πάνω σε κύκλο/τόξο:
 * 2 **καμπύλα** μήκη τόξου προς τα γειτονικά datums (τεταρτημόρια/άκρα) + **ευθεία ακτίνα** R. Config-gated
 * (Giorgio: «κάθε λογική χρήστη»). Reuse `calculateAngle`/`calculateArcLength`/`pointOnCircle` SSoT.
 */
function resolveArcGhostDimensions(
  frame: Readonly<GhostFaceFrame>,
  arc: Readonly<ArcMeta>,
  opts: Readonly<GhostFaceDimensionsOptions>,
  minValue: number,
): readonly GhostFaceDimension[] {
  const cfg = opts.arcConfig ?? ARC_LISTENING_DIM_DEFAULT;
  const colPt = facePointAt(frame, frame.ghostCenterAlong);
  const thetaDeg = normalizeAngleDeg(radToDeg(calculateAngle(arc.center, colPt)));
  const out: GhostFaceDimension[] = [];
  if (cfg.showArcGaps) {
    const br = bracketDatums(arcDatumAngles(arc), thetaDeg);
    if (br) {
      pushArcGap(out, 'arcLeftGap', arc, br.cwDeg, thetaDeg, opts.gapOffsetScene, minValue);
      pushArcGap(out, 'arcRightGap', arc, thetaDeg, br.ccwDeg, opts.gapOffsetScene, minValue);
    }
  }
  if (cfg.showRadius) {
    const valueScene = Math.hypot(colPt.x - arc.center.x, colPt.y - arc.center.y);
    if (valueScene > minValue) {
      out.push({
        kind: 'radius',
        p1: { x: arc.center.x, y: arc.center.y },
        p2: colPt,
        dimLineRef: { x: (arc.center.x + colPt.x) / 2, y: (arc.center.y + colPt.y) / 2 },
        valueScene,
      });
    }
  }
  return out;
}
