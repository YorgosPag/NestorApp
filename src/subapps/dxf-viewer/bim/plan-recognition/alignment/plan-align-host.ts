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
import { encodePlanRasterPng } from '@/lib/geometry/raster/plan-raster-png';
import type { RasterPixelScale } from '../../../floorplan-background/geometry/raster-pixel-scale';
import {
  DEFAULT_PLAN_SEGMENTS,
  extractPlanSegments,
  minFillPxFor,
  type PlanSegmentExtraction,
  type PlanSegmentOptions,
} from '../segments/plan-segments';
import { renderReadingViewRaster } from '../reading/plan-reading-view-raster';
import type { PlanReadingView } from '../reading/plan-reading-view';
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

// ─── ADR-929 Φ5.3β: τα pixel της όψης, στον ΙΔΙΟ Worker ─────────────────────────────────────────────────────────────
//
// Μια σάρωση άδειας ξαναδειγματίζεται σε έως 24 Mpx και κωδικοποιείται σε PNG: δευτερόλεπτα CPU που δεν ανήκουν στον
// κύριο νήμα. Ένας Worker, μία σειριακή ουρά (`serveWorkerRpc`): η απόδοση της όψης δεν τρέχει ποτέ παράλληλα με μια
// ευθυγράμμιση πάνω στο ίδιο υλικό.

export interface PlanViewRenderMessage {
  readonly kind: 'render-view';
  /** Η **αρχική** εικόνα του υποβάθρου, νέο buffer (μετακομίζει στον Worker). */
  readonly raster: PlanRaster;
  readonly alignment: Pick<PlanAlignment, 'alignedToOriginal' | 'workingScale'>;
  readonly view: PlanReadingView;
}

export interface PlanViewRenderReply {
  /** Τα bytes που θα φύγουν, **ακριβώς** (PNG). Η μικρογραφία και το sha256 βγαίνουν από αυτό το ίδιο Blob. */
  readonly blob: Blob;
  readonly widthPx: number;
  readonly heightPx: number;
}

export type PlanWorkerMessage = PlanAlignMessage | PlanViewRenderMessage;
export type PlanWorkerReply = PlanAlignReply | PlanViewRenderReply;

export const isPlanViewRenderReply = (reply: PlanWorkerReply): reply is PlanViewRenderReply => 'blob' in reply;

export async function handlePlanViewRender(message: PlanViewRenderMessage): Promise<PlanViewRenderReply> {
  const { raster } = renderReadingViewRaster(message.raster, message.alignment, message.view);
  return { blob: await encodePlanRasterPng(raster), widthPx: raster.width, heightPx: raster.height };
}

/** Ο χειριστής του Worker: ένα RPC, δύο ερωτήσεις. */
export async function handlePlanWorker(message: PlanWorkerMessage): Promise<PlanWorkerReply> {
  return message.kind === 'render-view' ? handlePlanViewRender(message) : handlePlanAlign(message);
}

/** Τα buffers του αιτήματος που μετακομίζουν στον Worker: η εικόνα (ο καλών δίνει **νέο** buffer ανά κλήση). */
export function planAlignRequestTransfer(message: PlanWorkerMessage): Transferable[] {
  return [message.raster.rgba.buffer];
}

/** Τα buffers της απάντησης: της ευθυγράμμισης μετακομίζουν· το Blob της όψης αντιγράφεται φθηνά (αναφορά, όχι bytes). */
export function planWorkerReplyTransfer(reply: PlanWorkerReply): Transferable[] {
  return isPlanViewRenderReply(reply) ? [] : planAlignReplyTransfer(reply);
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
