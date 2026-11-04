/**
 * ADR-929 Φ2 — **τμήματα κάτοψης** από την ευθυγραμμισμένη εικόνα: μάσκα μελανιού ⇒ `RasterSegment[]` σε **αρχικά** px.
 *
 * Δύο περάσματα, **μία** μηχανή ζωνών (`lib/geometry/raster/axis-bands.ts`):
 *   1. **Άξονες.** Μετά τη Φ1 οι κύριοι τοίχοι είναι οριζόντιοι/κατακόρυφοι.
 *   2. **Λοξά, στο υπόλοιπο.** Ό,τι δεν εξήγησαν οι άξονες ψάχνεται για κυρίαρχη λοξή διεύθυνση. Στρέφεται εκεί και
 *      τρέχουν οι ίδιες ζώνες (`oblique-bands.ts`). Οι λοξοί τοίχοι κρατούν τη γωνία τους (§6 Φ2).
 * Η επιλογή «ζώνες, όχι LSD/Hough» έγινε με μέτρηση (ADR-929 §6.3).
 *
 * 🔑 **Πίσω στα αρχικά px μόνο μέσω ομογραφιών** (Δ3): στραμμένο πλαίσιο → ευθυγραμμισμένο → αρχικό. Μια ομογραφία
 * στέλνει ευθείες σε ευθείες, άρα αρκούν τα άκρα. Το πάχος μετριέται **τοπικά**, με απεικόνιση των δύο ορίων της
 * ζώνης: σωστό και με προοπτική.
 *
 * Καθαρό, για Worker.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/segments/plan-segments
 * @see ./plan-faces.ts (ζώνη → παρειές)
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.3
 */

import {
  applyHomography,
  composeHomography,
  invertHomography,
  type Homography,
} from '@/lib/geometry/homography';
import {
  axisBands,
  DEFAULT_AXIS_BANDS,
  eraseBands,
  type AxisBand,
  type AxisBandOptions,
} from '@/lib/geometry/raster/axis-bands';
import { bandsAtAngle, dominantObliqueDirection } from '@/lib/geometry/raster/oblique-bands';
import { warpMask } from '@/lib/geometry/raster/raster-warp';
import { MODEL_FROM_DRAWING_LIMITS } from '../../../config/tolerance-config';
import type { RasterPixelScale } from '../../../floorplan-background/geometry/raster-pixel-scale';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { AlignedRectPx, PlanAlignment } from '../alignment/plan-alignment-types';
import type { PlanConfidence, RasterSegment } from '../plan-recognition-types';
import {
  bandFaces,
  fillThreshold,
  isBandLine,
  weightedThicknessPercentile,
  type BandFace,
  type PlanFaceOptions,
} from './plan-faces';

export interface PlanSegmentOptions extends PlanFaceOptions {
  /**
   * Ελάχιστο μήκος γραμμής σε px εργασίας. `null` ⇒ από το μέγεθος της περιοχής σχεδίου ({@link autoMinLength}).
   * Κοντύτερες γραμμές είναι κείμενο και σύμβολα, όχι παρειές.
   */
  readonly minLengthPx: number | null;
  /** Πόσες λοξές διευθύνσεις ψάχνονται το πολύ (0 ⇒ μόνο άξονες). */
  readonly maxObliqueDirections: number;
  /** Κάτω από αυτή τη βεβαιότητα η λοξή «διεύθυνση» είναι θόρυβος (κείμενο, σύμβολα, τόξα): τέλος αναζήτησης. */
  readonly minObliqueConfidence: number;
  /** Πόσες μοίρες μακριά από τους άξονες αρχίζει το «λοξό». */
  readonly obliqueAxisExclusionDeg: number;
}

export const DEFAULT_PLAN_SEGMENTS: PlanSegmentOptions = {
  minLengthPx: null,
  strokePercentile: 0.25,
  fillRatio: 3,
  fillMarginPx: 3,
  minFillSolidity: 0.85,
  minFillPx: null,
  maxObliqueDirections: 2,
  minObliqueConfidence: 0.3,
  obliqueAxisExclusionDeg: 5,
};

/**
 * Το `minFillPx` από τη γνωστή κλίμακα της εικόνας: το λεπτότερο πάχος τοίχου που δέχεται η στρατηγική ζευγών
 * (`WALL_PAIR_MIN_THICKNESS_MM`, το **ίδιο** όριο), σε px **εργασίας**. `null` ⇒ κλίμακα άγνωστη: αποφασίζει μόνο η
 * τυπική πινελιά (`fillThreshold`). Ποτέ υπόθεση «1 px = x mm». Σε άνιση κλίμακα X/Y, ο γεωμετρικός μέσος.
 */
export function minFillPxFor(alignment: Pick<PlanAlignment, 'workingScale'>, scale: RasterPixelScale | null): number | null {
  if (scale === null) return null;
  const metresPerPixel = Math.sqrt(scale.metresPerPixelX * scale.metresPerPixelY);
  const minMetres = MODEL_FROM_DRAWING_LIMITS.WALL_PAIR_MIN_THICKNESS_MM * mmToSceneUnits('m');
  const originalPx = minMetres / metresPerPixel;
  return originalPx / alignment.workingScale;
}

export interface PlanSegmentExtraction {
  /** Σε **αρχικά** px (`raster-px`), με σταθερά ids `ps0, ps1, …` μέσα στην αναγνώριση. */
  readonly segments: readonly RasterSegment[];
  /** Η τυπική πινελιά του σχεδίου σε px εργασίας (`null` ⇒ καμία ζώνη). */
  readonly strokeWidthPx: number | null;
  readonly minLengthPx: number;
  /** Οι λοξές διευθύνσεις που βρέθηκαν και έδωσαν γραμμές, σε μοίρες (raster-px). */
  readonly obliqueAnglesDeg: readonly number[];
}

/** Παρειά μαζί με την ομογραφία από το πλαίσιό της ως τα αρχικά px. */
interface FramedFace {
  readonly face: BandFace;
  readonly toOriginal: Homography;
}

/** 0,6% της μικρής διάστασης της περιοχής σχεδίου, τουλάχιστον 8 px: πάνω από ύψος γράμματος, κάτω από κοντό τοίχο. */
export function autoMinLength(region: AlignedRectPx): number {
  return Math.max(8, Math.round(0.006 * Math.min(region.maxX - region.minX, region.maxY - region.minY)));
}

function drawingRegion(alignment: PlanAlignment): AlignedRectPx {
  return alignment.sheet?.drawing.aligned ?? { minX: 0, minY: 0, maxX: alignment.image.width, maxY: alignment.image.height };
}

/** Η μάσκα μελανιού μόνο μέσα στην περιοχή σχεδίου και έξω από πινακίδες/υπομνήματα (Δ15 #4). */
function drawingInk(alignment: PlanAlignment): Uint8Array {
  const cols = alignment.image.width;
  const region = drawingRegion(alignment);
  const excluded = alignment.sheet?.annotations.map((a) => a.region.aligned) ?? [];
  const out = new Uint8Array(alignment.ink.length);
  for (let y = Math.ceil(region.minY); y < region.maxY; y++) {
    for (let x = Math.ceil(region.minX); x < region.maxX; x++) {
      if (excluded.some((r) => x >= r.minX && x < r.maxX && y >= r.minY && y < r.maxY)) continue;
      out[y * cols + x] = alignment.ink[y * cols + x];
    }
  }
  return out;
}

/**
 * Περιθώριο σβησίματος των αξονικών ζωνών πριν από το λοξό πέρασμα. Χωρίς αυτό μένουν φέτες 1 px κατά μήκος των
 * αξονικών γραμμών, που μετά το ίσιωμα διαβάζονταν ως «λοξή» διεύθυνση 5,5° (μετρημένο στη Φ2).
 */
const RESIDUAL_ERASE_MARGIN_PX = 1;

/**
 * Πόσο μπορεί να μακρύνει μια λοξή πινελιά στο πλήρες μελάνι (`strokeExtent`): στο υπόλοιπο σταμάτησε πριν από τη
 * σβησμένη γειτονική πινελιά (πάχος + περιθώριο από κάθε πλευρά), και υπό γωνία φ ως τους άξονες αυτό μακραίνει κατά
 * 1 / sin φ. Η σάρωση σταματά μόνη της στο χαρτί, οπότε το όριο απλώς εμποδίζει να ακολουθήσει ξένο μελάνι.
 */
function obliqueStrokeReach(angleDeg: number, stroke: number): number {
  const fromAxes = Math.abs(((angleDeg % 90) + 90) % 90);
  const phi = (Math.min(fromAxes, 90 - fromAxes) * Math.PI) / 180;
  return (2 * stroke + 2 * RESIDUAL_ERASE_MARGIN_PX) / Math.max(Math.sin(phi), 1e-3);
}

interface PassContext {
  readonly stroke: number;
  readonly cols: number;
  readonly rows: number;
  readonly bandOptions: AxisBandOptions;
  readonly fillAbove: number;
  readonly options: PlanSegmentOptions;
  readonly alignedToOriginal: Homography;
}

/**
 * Πέρασμα 2: λοξές διευθύνσεις στο υπόλοιπο μελάνι, μία-μία. Ό,τι εξήγησε μια διεύθυνση σβήνεται πριν την επόμενη.
 * Τέλος όταν η βεβαιότητα πέσει ή όταν η διεύθυνση δεν δώσει γραμμές.
 */
function obliquePass(residual: Uint8Array, full: Uint8Array, ctx: PassContext): { faces: FramedFace[]; angles: number[] } {
  const { cols, rows, options } = ctx;
  const faces: FramedFace[] = [];
  const angles: number[] = [];
  let rest = residual;
  for (let k = 0; k < options.maxObliqueDirections; k++) {
    const dir = dominantObliqueDirection(rest, cols, rows, options.obliqueAxisExclusionDeg);
    if (dir.confidence < options.minObliqueConfidence) break;
    const turned = bandsAtAngle(rest, cols, rows, dir.angleDeg, ctx.bandOptions);
    const lines = turned.bands.filter(isBandLine);
    const toOriginal = composeHomography(ctx.alignedToOriginal, turned.toSource);
    const back = invertHomography(turned.toSource);
    if (lines.length === 0 || toOriginal === null || back === null) break;
    const frame = { mask: warpMask(full, cols, rows, turned.toSource, turned.width, turned.height), cols: turned.width, rows: turned.height };
    const reach = obliqueStrokeReach(dir.angleDeg, ctx.stroke);
    for (const face of bandFaces(lines, frame, ctx.fillAbove, ctx.bandOptions.minLength, options, reach)) {
      faces.push({ face, toOriginal });
    }
    angles.push(dir.angleDeg);
    const erased = Uint8Array.from(turned.mask);
    eraseBands(erased, turned.width, turned.height, lines, 0);
    rest = warpMask(erased, turned.width, turned.height, back, cols, rows);
  }
  return { faces, angles };
}

/** Πάχος στα αρχικά px: απόσταση των εικόνων των δύο ορίων της ζώνης, στο μέσο της (τοπική κλίμακα της ομογραφίας). */
function originalWidth(face: BandFace, h: Homography): number {
  const mx = (face.start.x + face.end.x) / 2;
  const my = (face.start.y + face.end.y) / 2;
  const len = Math.hypot(face.end.x - face.start.x, face.end.y - face.start.y) || 1;
  const nx = (-(face.end.y - face.start.y) / len) * (face.width / 2);
  const ny = ((face.end.x - face.start.x) / len) * (face.width / 2);
  const a = applyHomography(h, mx - nx, my - ny);
  const b = applyHomography(h, mx + nx, my + ny);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

type UnnamedSegment = Omit<RasterSegment, 'id'>;

function toOriginalSegment({ face, toOriginal }: FramedFace): UnnamedSegment {
  const confidence: PlanConfidence = { score: face.confidence, factors: { geometry: face.confidence } };
  return {
    start: applyHomography(toOriginal, face.start.x, face.start.y),
    end: applyHomography(toOriginal, face.end.x, face.end.y),
    style: face.style,
    strokeWidthPx: originalWidth(face, toOriginal),
    confidence,
  };
}

/** Σταθερή σειρά (άρα σταθερά ids): κατά y, μετά x, των άκρων στα αρχικά px. */
function byPosition(a: UnnamedSegment, b: UnnamedSegment): number {
  return a.start.y - b.start.y || a.start.x - b.start.x || a.end.y - b.end.y || a.end.x - b.end.x;
}

/** Entry point: τα τμήματα κάτοψης μιας ευθυγράμμισης της Φ1. */
export function extractPlanSegments(
  alignment: PlanAlignment, options: PlanSegmentOptions = DEFAULT_PLAN_SEGMENTS,
): PlanSegmentExtraction {
  const { width: cols, height: rows } = alignment.image;
  const minLength = options.minLengthPx ?? autoMinLength(drawingRegion(alignment));
  const bandOptions: AxisBandOptions = { ...DEFAULT_AXIS_BANDS, minLength };
  const ink = drawingInk(alignment);
  const bands: AxisBand[] = [
    ...axisBands(ink, cols, rows, 'horizontal', bandOptions),
    ...axisBands(ink, cols, rows, 'vertical', bandOptions),
  ];
  const lines = bands.filter(isBandLine);
  const stroke = weightedThicknessPercentile(lines, options.strokePercentile);
  if (stroke === null) return { segments: [], strokeWidthPx: null, minLengthPx: minLength, obliqueAnglesDeg: [] };
  const ctx: PassContext = {
    stroke, cols, rows, bandOptions, fillAbove: fillThreshold(stroke, options), options, alignedToOriginal: alignment.alignedToOriginal,
  };
  const axisFaces = bandFaces(lines, { mask: ink, cols, rows }, ctx.fillAbove, minLength, options)
    .map((face) => ({ face, toOriginal: alignment.alignedToOriginal }));
  // Το κόστος του περιθωρίου στα άκρα των λοξών το επιστρέφει το `strokeExtent` (μέσω `obliqueStrokeReach`).
  const residual = Uint8Array.from(ink);
  eraseBands(residual, cols, rows, lines, RESIDUAL_ERASE_MARGIN_PX);
  const oblique = obliquePass(residual, ink, ctx);
  const segments: RasterSegment[] = [...axisFaces, ...oblique.faces].map(toOriginalSegment).sort(byPosition)
    .map((s, i) => ({ id: `ps${i}`, ...s }));
  return { segments, strokeWidthPx: stroke, minLengthPx: minLength, obliqueAnglesDeg: oblique.angles };
}
