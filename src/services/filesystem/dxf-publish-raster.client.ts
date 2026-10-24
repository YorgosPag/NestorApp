/**
 * **«Φτιάξε την εικόνα δημοσίευσης αυτού του DXF»** — ο μόνος δρόμος του πελάτη (ADR-922).
 *
 * Ο πελάτης **δεν** αποδίδει τίποτα μόνος του: ζητά, και ο διακομιστής γράφει την έκβαση στην εγγραφή. Η απάντηση
 * φτάνει στην οθόνη από τον **ζωντανό ακροατή** της λίστας (`useEntityFiles({ realtime: true })`), όχι από εδώ —
 * ώστε να υπάρχει **μία** πηγή για την κατάσταση, όποιος κι αν τη ζήτησε.
 *
 * @module services/filesystem/dxf-publish-raster.client
 * @see app/api/files/[fileId]/publish-raster
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { FILE_CUSTODY_PARAM } from '@/lib/files/file-custody';
import { createModuleLogger } from '@/lib/telemetry';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

const logger = createModuleLogger('dxf-publish-raster.client');

const urlOf = (fileId: string): string => `/api/files/${encodeURIComponent(fileId)}/publish-raster`;

/**
 * Ζητά το παράγωγο. **Ποτέ δεν πετά**: μια αποτυχία δικτύου αφήνει την εγγραφή χωρίς έκβαση, άρα η οθόνη μένει στο
 * «Ετοιμάζεται…» και η επόμενη φόρτωση της φόρμας ξαναζητά — ποτέ ψεύτικο «απέτυχε» για μια παροδική στιγμή.
 */
export async function requestDxfPublishRaster(fileId: string, custody: CustodyKind): Promise<void> {
  try {
    await apiClient.post(urlOf(fileId), undefined, { params: { [FILE_CUSTODY_PARAM]: custody } });
  } catch (cause) {
    logger.warn('Η εικόνα δημοσίευσης DXF δεν ζητήθηκε', { fileId, custody, cause: String(cause) });
  }
}
