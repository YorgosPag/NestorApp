/**
 * Το **συμβόλαιο της διαδρομής** `POST /api/floorplan-backgrounds/[id]/plan-reading` (ADR-929 Δ11): ένα σχήμα για τον
 * πελάτη που το στέλνει και τον διακομιστή που το ελέγχει. Χωρίς `server-only`, επίτηδες.
 *
 * 🔑 **multipart**: `image` (τα bytes της όψης, PNG/JPEG/WebP) + `request` (JSON αυτού του σχήματος). Η εικόνα δεν
 * φουσκώνει 33 % ως base64, και το σύνορο ιδεμποτίας αποτυπώνει ήδη multipart (ADR-909 Β2.0).
 * 🔑 Ο πελάτης **δεν** στέλνει σελίδα, αρχείο ή hash: τα βγάζει ο διακομιστής από το υπόβαθρο και από ό,τι έλαβε. Ό,τι
 * δηλώνει ο πελάτης για τον εαυτό του δεν είναι απόδειξη (Δ15 #5).
 * 🔑 Η απάντηση είναι σε `view-‰`: ο πελάτης τη γυρίζει σε αρχικά px με την ευθυγράμμιση που κρατά (`planReadingFromView`).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-contract
 */

import { z } from 'zod/v4';
import type { PlanReadingUnavailableReason } from '../plan-recognition-types';
import type { PlanReaderImageMime } from './plan-reader-port';
import type { PlanReadingDropped, PlanViewReading } from './plan-reading-wire';

export const PLAN_READING_IMAGE_FIELD = 'image';
export const PLAN_READING_REQUEST_FIELD = 'request';
export const PLAN_READING_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const satisfies readonly PlanReaderImageMime[];
/** Μια όψη 24 M px σε PNG ασπρόμαυρης σάρωσης μετρήθηκε ~2,6 MB· το όριο αφήνει χώρο για έγχρωμη κάτοψη. */
export const PLAN_READING_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Μια πυκνή σάρωση άδειας έδωσε ~2.900 τμήματα (§6.4)· πάνω από αυτό ο πίνακας κοστίζει περισσότερο από την εικόνα. */
export const PLAN_READING_MAX_SEGMENTS = 8_000;

const alignedRect = z.strictObject({ minX: z.number(), minY: z.number(), maxX: z.number(), maxY: z.number() });

const viewSegment = z.strictObject({
  id: z.string().min(1).max(32),
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number(),
  style: z.enum(['stroke', 'fill-face']),
});

export const planReadingRequestSchema = z.strictObject({
  /** Η όψη που **επιβεβαίωσε ο άνθρωπος** (Δ15 #4): καταγράφεται ως απόδειξη του τι κόπηκε. */
  view: z.strictObject({ crop: alignedRect, redacted: z.array(alignedRect).max(64) }),
  segments: z.array(viewSegment).max(PLAN_READING_MAX_SEGMENTS),
});

export type PlanReadingRequest = z.infer<typeof planReadingRequestSchema>;

/** Γιατί δεν υπάρχει ανάγνωση: οι λόγοι του Δ15/Δ16, ποτέ σιωπηλή υποβάθμιση. */
export type PlanReadingRouteUnavailable = {
  readonly status: 'unavailable';
  readonly reason: PlanReadingUnavailableReason;
  readonly readingId: string | null;
};

export type PlanReadingRouteRead = {
  readonly status: 'read';
  readonly readingId: string;
  readonly model: string;
  readonly schemaVersion: number;
  readonly reading: PlanViewReading;
  readonly dropped: PlanReadingDropped;
  /** Ίδιο κλειδί ⇒ ίδια απάντηση χωρίς νέα κλήση και κόστος (Δ11). */
  readonly cacheHit: boolean;
};

export type PlanReadingRouteResult = PlanReadingRouteRead | PlanReadingRouteUnavailable;

export interface PlanReadingRouteResponse {
  readonly success: true;
  readonly result: PlanReadingRouteResult;
}
