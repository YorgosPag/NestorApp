/**
 * Αποκωδικοποίηση του multipart της ανάγνωσης κάτοψης (ADR-929 Δ11): `image` + `request`, ελεγμένα **πριν** αγγίξει
 * τίποτα τον πάροχο. Οι διαστάσεις διαβάζονται από τα ίδια τα bytes (μόνο κεφαλίδα), ποτέ από δήλωση του πελάτη.
 *
 * @module api/floorplan-backgrounds/[id]/plan-reading/_plan-reading-multipart
 */

import 'server-only';

import { readImageDimensions } from '@/server/images/image-metadata';
import type { PlanReaderImage, PlanReaderImageMime } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reader-port';
import {
  PLAN_READING_IMAGE_FIELD,
  PLAN_READING_IMAGE_MIMES,
  PLAN_READING_MAX_IMAGE_BYTES,
  PLAN_READING_REQUEST_FIELD,
  planReadingRequestSchema,
  type PlanReadingRequest,
} from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-contract';

export type PlanReadingMultipart =
  | { readonly ok: true; readonly image: PlanReaderImage; readonly request: PlanReadingRequest }
  | { readonly ok: false; readonly status: 400 | 413 | 415 | 422; readonly code: string };

const isImageMime = (type: string): type is PlanReaderImageMime =>
  (PLAN_READING_IMAGE_MIMES as readonly string[]).includes(type);

function parseRequestField(value: FormDataEntryValue | null): PlanReadingRequest | null {
  if (typeof value !== 'string') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return null;
  }
  const parsed = planReadingRequestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function readPlanReadingMultipart(form: FormData): Promise<PlanReadingMultipart> {
  const file = form.get(PLAN_READING_IMAGE_FIELD);
  if (!(file instanceof Blob)) return { ok: false, status: 400, code: 'IMAGE_REQUIRED' };
  if (!isImageMime(file.type)) return { ok: false, status: 415, code: 'IMAGE_TYPE_UNSUPPORTED' };
  if (file.size > PLAN_READING_MAX_IMAGE_BYTES) return { ok: false, status: 413, code: 'IMAGE_TOO_LARGE' };
  const request = parseRequestField(form.get(PLAN_READING_REQUEST_FIELD));
  if (!request) return { ok: false, status: 422, code: 'REQUEST_INVALID' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dims = await readImageDimensions(bytes);
  if (!dims) return { ok: false, status: 422, code: 'IMAGE_UNREADABLE' };
  return { ok: true, image: { bytes, mimeType: file.type, widthPx: dims.width, heightPx: dims.height }, request };
}
