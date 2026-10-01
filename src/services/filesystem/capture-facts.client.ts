/**
 * 📷 **Τα στοιχεία λήψης μιας φωτογραφίας από το EXIF** — ο μόνος δρόμος του πελάτη (ADR-897 Φ5).
 *
 * Ο πελάτης **δεν** διαβάζει EXIF μόνος του: τα bytes του πρωτοτύπου ζουν πίσω από την αλυσίδα κατοχής, και η αριθμητική
 * του πεδίου ζει **μία** φορά (`horizontalFovFromExif`, στον διακομιστή).
 *
 * @module services/filesystem/capture-facts.client
 * @see app/api/files/[fileId]/capture-facts
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { degToRad } from '@/lib/geometry/angle';
import { FILE_CUSTODY_PARAM } from '@/lib/files/file-custody';
import { MAX_PHOTO_FOV_RAD, MIN_PHOTO_FOV_RAD } from '@/lib/listings/photo-capture-spot';
import { createModuleLogger } from '@/lib/telemetry';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

const logger = createModuleLogger('capture-facts.client');

export interface CaptureFactsSuggestion {
  /** Το πεδίο του φακού — `null` ⇒ η φωτογραφία δεν το λέει (ο επεξεργαστής κρατά την προεπιλογή). */
  readonly fovRad: number | null;
  /** Πυξίδα (0 = βορράς, δεξιόστροφα) — μόνο πρόταση, και μόνο όταν η κάτοψη ξέρει πού είναι ο βορράς. */
  readonly compassRad: number | null;
}

const NOTHING: CaptureFactsSuggestion = { fovRad: null, compassRad: null };
const urlOf = (fileId: string): string => `/api/files/${encodeURIComponent(fileId)}/capture-facts`;

const isFov = (value: unknown): value is number =>
  typeof value === 'number' && value >= MIN_PHOTO_FOV_RAD && value <= MAX_PHOTO_FOV_RAD;
const isHeading = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < degToRad(360);

/** Ο πελάτης **ξαναελέγχει** το σχήμα: η απάντηση του δικτύου δεν δανείζεται την εμπιστοσύνη του διακομιστή. */
function readFacts(raw: unknown): CaptureFactsSuggestion {
  if (raw === null || typeof raw !== 'object') return NOTHING;
  const facts = raw as { readonly fovRad?: unknown; readonly compass?: { readonly headingRad?: unknown } | null };
  const heading = facts.compass?.headingRad;
  return {
    fovRad: isFov(facts.fovRad) ? facts.fovRad : null,
    compassRad: isHeading(heading) ? heading : null,
  };
}

/**
 * Ποτέ δεν πετά. ⚠️ **Δύο σιωπές, όχι μία**: `null` = «δεν μπόρεσα να ρωτήσω» (δίκτυο, δικαίωμα) — **δεν** απομνημονεύεται,
 * ώστε ένα πεσμένο δίκτυο να μη γίνει μόνιμο «δεν ξέρω»· `{fovRad: null, …}` = «ρώτησα, η φωτογραφία δεν το λέει».
 */
export async function fetchCaptureFacts(fileId: string, custody: CustodyKind): Promise<CaptureFactsSuggestion | null> {
  try {
    const body = await apiClient.get<{ readonly facts?: unknown }>(urlOf(fileId), {
      params: { [FILE_CUSTODY_PARAM]: custody },
    });
    return readFacts(body.facts);
  } catch (cause) {
    logger.warn('Τα στοιχεία λήψης δεν φορτώθηκαν', { fileId, custody, cause: String(cause) });
    return null;
  }
}
