/**
 * @fileoverview **Η ΑΝΙΧΝΕΥΣΗ ΣΕ ΜΕΤΡΑ ΚΑΤΟΨΗΣ** — ο επεξεργαστής ρωτά και ακούει **μόνο μέτρα**· εδώ μεταφράζεται η ερώτηση σε
 * pixel του **παραγώγου** που αναλύεται και η απάντηση πίσω (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14 · §12 Δ8.1–Δ8.2). Καθαρό.
 * @related `space-detect.ts` (`detectSpaceIn`) · `lib/spatial-tour/tour-plan-frame.ts` (`imagePixelToPlan` / `planToImagePixel` —
 *   η **ΜΙΑ** σύμβαση pixel ⇄ μέτρα) · `space-detect-host.ts` (ο καλών, μέσα στον Worker)
 * @module lib/spatial-tour/space-detect/space-detect-plan
 *
 * 🔴 **Η κλίμακα είναι του ΠΡΩΤΟΤΥΠΟΥ, η εικόνα του ΠΑΡΑΓΩΓΟΥ** (ADR-884 Β1 σφάλμα (ε): 17% λάθος από παράγωγο 1024 έναντι
 *   πρωτοτύπου 1200). Τα μέτρα/pixel του παραγώγου = `mpp × πλάτος πρωτοτύπου ÷ πλάτος παραγώγου`. Το παράγωγο κρατά την
 *   αναλογία πλευρών (στρογγύλευση ύψους ≤ ½ pixel ⇒ ≤ 0,05% — κάτω από κάθε ανοχή του κριτή).
 * 📏 Οι κορυφές βγαίνουν στρογγυλεμένες στο **χιλιοστό**: καμία ψευδοακρίβεια στο έγγραφο, και το «ίδιο σχήμα» του κριτή
 *   (ιδεμποτία) δεν σπάει από θόρυβο 1e-12.
 */

import { imagePixelToPlan, planToImagePixel } from '../tour-plan-frame';
import type { TourPlanXY } from '../tour-graph-edit';
import { detectSpaceIn } from './space-detect';
import type { PreparedPlanRaster, SpaceDetectRefusal } from './space-detect-types';

/** Νοητή γραμμή σε μέτρα κάτοψης. */
export interface PlanSegment {
  readonly a: TourPlanXY;
  readonly b: TourPlanXY;
}

/** Η ερώτηση του επεξεργαστή — όλα σε μέτρα κάτοψης, η κλίμακα του **πρωτοτύπου**. */
export interface PlanDetectRequest {
  readonly seed: TourPlanXY;
  readonly otherStops: readonly TourPlanXY[];
  readonly separations: readonly PlanSegment[];
  /** Μέτρα ανά pixel του **πρωτοτύπου** (`FloorPlanRecord.scale`). */
  readonly metresPerPixel: number;
  /** Πλάτος του πρωτοτύπου σε pixel (`FloorPlanRecord.image.width`). */
  readonly imageWidth: number;
  /** Το ρυθμιστικό πόρτας (m) — λείπει ⇒ η προεπιλογή του ανιχνευτή. */
  readonly doorWidthM?: number;
}

export interface PlanSeparationSuggestion {
  readonly segment: PlanSegment;
  /** Το άνοιγμα σε μέτρα («άνοιγμα 2,1 m»). */
  readonly widthM: number;
  readonly otherStopIndex: number;
}

export type PlanDetectResult =
  | {
      readonly ok: true;
      readonly outline: readonly TourPlanXY[];
      readonly orthogonal: boolean;
      /** Το **μετρημένο** εμβαδόν (m²) — ο επεξεργαστής το δείχνει με «≈» (Δ8.4). */
      readonly areaM2: number;
      readonly separation: PlanSeparationSuggestion | null;
    }
  | { readonly ok: false; readonly refusal: SpaceDetectRefusal };

/** Μέτρα ανά pixel του **παραγώγου** — `NaN` όταν κάτι λείπει (ο ανιχνευτής τότε απαντά `uncalibrated`). */
export function rasterMetresPerPixel(metresPerPixel: number, imageWidth: number, rasterWidth: number): number {
  return rasterWidth > 0 && imageWidth > 0 ? (metresPerPixel * imageWidth) / rasterWidth : Number.NaN;
}

const MM = 1000;
const toMm = (value: number) => Math.round(value * MM) / MM;
const plan = (pixel: { readonly x: number; readonly y: number }, mpp: number): TourPlanXY => {
  const point = imagePixelToPlan(pixel, mpp);
  return { x: toMm(point.x), y: toMm(point.y) };
};

/** **Ανίχνευσε** τον χώρο γύρω από το σημείο (μέτρα) πάνω σε προετοιμασμένο παράγωγο. */
export function detectPlanSpace(prepared: PreparedPlanRaster, request: PlanDetectRequest): PlanDetectResult {
  const mpp = rasterMetresPerPixel(request.metresPerPixel, request.imageWidth, prepared.width);
  const pixel = (point: TourPlanXY) => planToImagePixel(point, mpp);
  const result = detectSpaceIn(prepared, {
    metresPerPixel: mpp,
    seed: pixel(request.seed),
    otherStops: request.otherStops.map(pixel),
    separations: request.separations.map(({ a, b }) => ({ a: pixel(a), b: pixel(b) })),
    ...(request.doorWidthM === undefined ? {} : { options: { doorWidthM: request.doorWidthM } }),
  });
  if (!result.ok) return result;
  const { separation } = result;
  return {
    ok: true,
    outline: result.outline.map((p) => plan(p, mpp)),
    orthogonal: result.orthogonal,
    areaM2: result.areaPx * mpp * mpp,
    separation: separation === null ? null : {
      segment: { a: plan(separation.segment.a, mpp), b: plan(separation.segment.b, mpp) },
      widthM: separation.widthPx * mpp,
      otherStopIndex: separation.otherStopIndex,
    },
  };
}
