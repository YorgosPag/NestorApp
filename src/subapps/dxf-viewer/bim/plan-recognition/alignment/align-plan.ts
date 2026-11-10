/**
 * **Η ευθυγράμμιση κάτοψης** (ADR-929 Φ1): εικόνα υποβάθρου ⇒ ίσια, καθαρή εικόνα + μάσκα μελανιού + η ομογραφία πίσω
 * στα αρχικά pixel + η διάταξη του φύλλου. Καθαρό, ντετερμινιστικό· τρέχει στον Worker και, ως δίχτυ, στον κύριο νήμα.
 *
 * Σειρά (Δ14: πρώτα σάρωση, μετά σκίτσο):
 *   1. **Εικόνα εργασίας** — μείωση με ακέραιο συντελεστή (μέσος περιοχής) όταν η πηγή ξεπερνά το όριο pixel.
 *   2. **Προοπτική** (προαιρετική, 4 σημεία) — ορθογώνιο φύλλο από φωτογραφία κινητού.
 *   3. **Δυαδοποίηση** — σάρωση ή αγγελία, αυτόματα με μέτρηση (`plan-ink.ts`).
 *   4. **Καθαρισμός** — flat-field (σάρωση) ή λευκή ισορροπία (αγγελία).
 *   5. **Κλίση** — προφίλ προβολής πάνω στο μελάνι· περιστροφή **μόνο** με επαρκή βεβαιότητα.
 *   6. **Μελάνι** — ξανά πάνω στην ίσια εικόνα (όχι περιστροφή της μάσκας: μια δυαδική μάσκα δεν δειγματίζεται καλά).
 *   7. **Κηλίδες** — συνιστώσες λίγων pixel φεύγουν.
 *   8. **Φύλλο** — πλαίσιο, περιοχή σχεδίου, υποψήφιες πινακίδες (Δ15 #4).
 *
 * 🔑 **Μία ομογραφία, συντεθειμένη βήμα-βήμα (Δ3):** `ευθυγραμμισμένη → εργασίας → αρχική`. Καμία εικόνα δεν
 *   αναδειγματίζεται δύο φορές για τον ίδιο μετασχηματισμό, και κάθε εύρημα γυρίζει ακριβώς στο αρχικό pixel.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/align-plan
 */

import {
  composeHomography,
  invertHomography,
  quadToQuad,
  rectQuad,
  type Homography,
  type Quad,
} from '@/lib/geometry/homography';
import { removeSmallComponents } from '@/lib/geometry/raster/component-stats';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { downscaleArea, straighteningRotation, warpHomography, workingScaleFor } from '@/lib/geometry/raster/raster-warp';
import { estimateSkew } from '@/lib/geometry/raster/skew-estimate';
import { DEFAULT_PLAN_ALIGN, type PlanAlignment, type PlanAlignOptions, type PlanBinarization, type SkewResult } from './plan-alignment-types';
import { cleanPlanImage, planInkMask, resolveBinarization } from './plan-ink';
import { detectSheetLayout } from './sheet-layout';

const scaling = (s: number): Homography => ({ a: s, b: 0, c: 0, d: 0, e: s, f: 0, g: 0, h: 0 });

/** Σύνθεση που **δεν** μπορεί να εκφυλιστεί εδώ (όλα τα βήματα είναι αντιστρέψιμα) — αλλιώς σφάλμα, ποτέ σιωπηλό `NaN`. */
function compose(m2: Homography, m1: Homography): Homography {
  const m = composeHomography(m2, m1);
  if (m === null) throw new Error('plan-align-degenerate-homography');
  return m;
}

interface Stage {
  readonly image: PlanRaster;
  /** Από τα pixel **αυτής** της εικόνας στα αρχικά. */
  readonly toOriginal: Homography;
}

/** Ορθογώνιο φύλλο από 4 γωνίες (αρχικά px). Μέγεθος = η μεγαλύτερη από τις απέναντι πλευρές (καμία συμπίεση). */
function rectify(stage: Stage, quadOriginal: Quad, scale: number): Stage | null {
  const down = (i: 0 | 1 | 2 | 3) => ({ x: quadOriginal[i].x / scale, y: quadOriginal[i].y / scale });
  const q: Quad = [down(0), down(1), down(2), down(3)];
  const dist = (i: number, j: number) => Math.hypot(q[i].x - q[j].x, q[i].y - q[j].y);
  const width = Math.round(Math.max(dist(0, 1), dist(3, 2)));
  const height = Math.round(Math.max(dist(0, 3), dist(1, 2)));
  if (width < 2 || height < 2) return null;
  const rectToStage = quadToQuad(rectQuad(width, height), q);
  if (rectToStage === null) return null;
  return { image: warpHomography(stage.image, rectToStage, width, height), toOriginal: compose(stage.toOriginal, rectToStage) };
}

interface Straightened extends Stage {
  readonly ink: Uint8Array;
  readonly skew: SkewResult;
}

function straighten(stage: Stage, mode: PlanBinarization, o: PlanAlignOptions): Straightened {
  const clean = cleanPlanImage(stage.image, mode);
  const ink = planInkMask(clean, mode);
  if (!o.deskew) return { image: clean, toOriginal: stage.toOriginal, ink, skew: { angleDeg: 0, confidence: 0, applied: false } };
  const measured = estimateSkew(ink, clean.width, clean.height);
  const apply = measured.confidence >= o.minSkewConfidence && Math.abs(measured.angleDeg) >= o.minSkewDeg;
  const skew: SkewResult = { angleDeg: measured.angleDeg, confidence: measured.confidence, applied: apply };
  if (!apply) return { image: clean, toOriginal: stage.toOriginal, ink, skew };
  const rotation = straighteningRotation(clean.width, clean.height, measured.angleDeg);
  const image = warpHomography(clean, rotation.outputToInput, rotation.width, rotation.height);
  return { image, toOriginal: compose(stage.toOriginal, rotation.outputToInput), ink: planInkMask(image, mode), skew };
}

/** **Ευθυγράμμισε** μια εικόνα κάτοψης. Η πηγή μένει ανέπαφη. */
export function alignPlan(source: PlanRaster, options: Partial<PlanAlignOptions> = {}): PlanAlignment {
  const o: PlanAlignOptions = { ...DEFAULT_PLAN_ALIGN, ...options };
  if (source.width < 1 || source.height < 1) throw new Error('plan-align-empty-image');
  const scale = workingScaleFor(source.width, source.height, o.maxWorkingPixels);
  let stage: Stage = { image: scale > 1 ? downscaleArea(source, scale) : source, toOriginal: scaling(scale) };
  const rectified = o.perspectiveQuad === null ? null : rectify(stage, o.perspectiveQuad, scale);
  if (rectified !== null) stage = rectified;
  const mode = resolveBinarization(stage.image, o.binarization);
  const done = straighten(stage, mode, o);
  const { width, height } = done.image;
  const ink = removeSmallComponents(done.ink, width, height, o.speckleMaxAreaPx + 1);
  const originalToAligned = invertHomography(done.toOriginal);
  if (originalToAligned === null) throw new Error('plan-align-degenerate-homography');
  return {
    image: done.image,
    ink,
    alignedToOriginal: done.toOriginal,
    originalToAligned,
    original: { width: source.width, height: source.height },
    workingScale: scale,
    binarization: mode,
    skew: done.skew,
    perspectiveApplied: rectified !== null,
    sheet: o.detectSheet ? detectSheetLayout(ink, width, height, done.toOriginal) : null,
  };
}
