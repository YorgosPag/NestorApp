/**
 * **Η ανάγνωση πίσω από το RPC** (ADR-929 Φ1 + Φ2) — ό,τι τρέχει μέσα στον Web Worker **και**, ως δίχτυ, στον κύριο νήμα.
 * Καθαρό: κανένα DOM, καμία λήψη. Η εικόνα έρχεται **ήδη αποκωδικοποιημένη** από τον πάροχο του υποβάθρου (εικόνα, TIFF ή
 * σελίδα PDF): μία αποκωδικοποίηση, τα όρια της αποκωδικοποιημένης εικόνας (§6.1 #2), και κανένας δεύτερος δρόμος για TIFF/PDF.
 *
 * 🔑 **Ένα ταξίδι, ένας Worker.** Τα τμήματα της Φ2 (`extractPlanSegments`) χρειάζονται τη μάσκα μελανιού της ευθυγράμμισης.
 *   Ζητούνται **στο ίδιο αίτημα** (`segments`), ώστε η μάσκα να μη γυρίσει στον κύριο νήμα για να ξαναπάει. Χωρίς `segments`
 *   τρέχει μόνο η ευθυγράμμιση: όσο ο χρήστης σέρνει τις γωνίες της προοπτικής, η προεπισκόπηση δεν πληρώνει τα τμήματα.
 *
 * @related `align-plan.ts` (ευθυγράμμιση) · `../segments/plan-segments.ts` (τμήματα) · `plan-align.worker.ts` (λεπτό
 *   περιτύλιγμα) · `plan-align-client.ts` (η άλλη πλευρά) · `lib/workers/*` (το ΕΝΑ RPC του έργου, ADR-884 §4.14)
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/plan-align-host
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { RasterPixelScale } from '../../../floorplan-background/geometry/raster-pixel-scale';
import {
  DEFAULT_PLAN_SEGMENTS,
  extractPlanSegments,
  minFillPxFor,
  type PlanSegmentExtraction,
  type PlanSegmentOptions,
} from '../segments/plan-segments';
import { alignPlan } from './align-plan';
import type { PlanAlignment, PlanAlignOptions } from './plan-alignment-types';

/** Αίτημα τμημάτων μαζί με την ευθυγράμμιση. */
export interface PlanSegmentRequest {
  /** Η κλίμακα της εικόνας από το SSoT (`resolveRasterPixelScale`)· `null` ⇒ άγνωστη (Δ4: ποτέ υπόθεση). */
  readonly scale: RasterPixelScale | null;
  readonly options?: Partial<PlanSegmentOptions>;
}

export interface PlanAlignMessage {
  readonly kind: 'align';
  readonly raster: PlanRaster;
  readonly options?: Partial<PlanAlignOptions>;
  /** Παρόν ⇒ και τα τμήματα της Φ2, στο ίδιο ταξίδι. */
  readonly segments?: PlanSegmentRequest;
}

export interface PlanAlignReply {
  readonly alignment: PlanAlignment;
  /** `null` όταν δεν ζητήθηκαν. Σε **αρχικά** px, άρα ανεξάρτητα από την ευθυγράμμιση που τα παρήγαγε. */
  readonly segments: PlanSegmentExtraction | null;
}

/** Οι επιλογές τμημάτων: προεπιλογές, μετά το όριο γεμίσματος από την κλίμακα, μετά ό,τι όρισε ρητά ο καλών. */
function segmentOptionsFor(alignment: PlanAlignment, request: PlanSegmentRequest): PlanSegmentOptions {
  return { ...DEFAULT_PLAN_SEGMENTS, minFillPx: minFillPxFor(alignment, request.scale), ...request.options };
}

export function handlePlanAlign(message: PlanAlignMessage): PlanAlignReply {
  const alignment = alignPlan(message.raster, message.options);
  const segments = message.segments
    ? extractPlanSegments(alignment, segmentOptionsFor(alignment, message.segments))
    : null;
  return { alignment, segments };
}

/** Τα buffers του αιτήματος που μετακομίζουν στον Worker: η εικόνα (ο καλών δίνει **νέο** buffer ανά κλήση). */
export function planAlignRequestTransfer(message: PlanAlignMessage): Transferable[] {
  return [message.raster.rgba.buffer];
}

/**
 * Τα buffers της απάντησης που μετακομίζουν πίσω: η ευθυγραμμισμένη εικόνα και η μάσκα μελανιού. Τα τμήματα είναι
 * λίγα μικρά αντικείμενα: αντιγράφονται (structured clone), χωρίς κανένα buffer.
 */
export function planAlignReplyTransfer(reply: PlanAlignReply): Transferable[] {
  const image = reply.alignment.image.rgba.buffer;
  const ink = reply.alignment.ink.buffer;
  return image === ink ? [image] : [image, ink];
}
