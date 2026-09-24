/**
 * **Το αυτόματο σημείο εστίασης ενός αρχείου, ΠΡΙΝ τη δημοσίευση** — ο μόνος δρόμος του πελάτη (ADR-880).
 *
 * Ο διακομιστής τρέχει τον **ίδιο** κινητήρα με το δημόσιο ράφι πάνω στο ιδιωτικό πρωτότυπο — ο πελάτης
 * **δεν** υπολογίζει τίποτα μόνος του: δεύτερη μηχανή θα έδινε δεύτερη απάντηση.
 *
 * @module services/filesystem/focal-point-suggestion.client
 * @see app/api/files/[fileId]/focal-point
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { FILE_CUSTODY_PARAM } from '@/lib/files/file-custody';
import { readPhotoFocalPoint, type PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import { createModuleLogger } from '@/lib/telemetry';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

const logger = createModuleLogger('focal-point-suggestion.client');

/**
 * ⚠️ **Δύο εκβάσεις, και η διάκριση φαίνεται στον άνθρωπο**: `ready` με `null` σημαίνει *«κοίταξα, κανένα
 * σαφές θέμα»*· `unavailable` σημαίνει *«δεν μπόρεσα να κοιτάξω»* (δίκτυο, δικαίωμα) — ποτέ «κανένα θέμα».
 */
export type FocalPointSuggestion =
  | { readonly kind: 'ready'; readonly point: PhotoFocalPoint | null }
  | { readonly kind: 'unavailable' };

const urlOf = (fileId: string): string => `/api/files/${encodeURIComponent(fileId)}/focal-point`;

export async function fetchFocalPointSuggestion(
  fileId: string,
  custody: CustodyKind,
): Promise<FocalPointSuggestion> {
  try {
    const body = await apiClient.get<{ readonly focalPoint?: unknown }>(urlOf(fileId), {
      params: { [FILE_CUSTODY_PARAM]: custody },
    });
    return { kind: 'ready', point: readPhotoFocalPoint(body.focalPoint) };
  } catch (cause) {
    logger.warn('Το αυτόματο σημείο εστίασης δεν φορτώθηκε', { fileId, custody, cause: String(cause) });
    return { kind: 'unavailable' };
  }
}
