/**
 * Η στοίβα εκδόσεων από την οθόνη — ο ΜΟΝΟΣ δρόμος του πελάτη προς το ιστορικό και την
 * «Ορισμός ως τρέχουσας» (ADR-862 Φ0).
 *
 * 🔴 Αντικαθιστά το `file-version.service.ts` (client SDK, υποσυλλογή `versions`): ήταν νεκρό
 * στην παραγωγή (κανένας κανόνας ⇒ deny-all) και έγραφε **χωρίς συναλλαγή** (lost update).
 * Εδώ ο πελάτης **ζητά** — κρίνει και γράφει μόνο ο διακομιστής, με τον ΕΝΑ γραφέα.
 *
 * ⚠️ Άρνηση πολιτικής ≠ βλάβη: η οθόνη παίρνει **όνομα** αιτίας για να το μεταφράσει (N.11).
 *
 * @module services/filesystem/version-stack.client
 * @see app/api/files/[fileId]/versions · app/api/files/[fileId]/versions/promote
 */

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { FILE_CUSTODY_PARAM } from '@/lib/files/file-custody';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import {
  VERSION_PROMOTION_REFUSALS,
  type FileVersionStackResponse,
  type VersionPromotionRefusal,
} from '@/types/file-version-stack';

const logger = createModuleLogger('version-stack.client');

const versionsUrl = (fileId: string): string => `/api/files/${encodeURIComponent(fileId)}/versions`;

/**
 * **Η παράμετρος διαμερίσματος** — `?custody=company|personal` (ADR-866 §2.6.9 Β1).
 *
 * 🔴 Ταξιδεύει **μόνο το είδος**, ποτέ ο `userId`: τον κάτοχο τον βάζει ο διακομιστής από τη
 * **δική του** ταυτότητα. Υποχρεωτικό στον τύπο, ώστε ο μεταγλωττιστής να βρει κάθε καλούντα —
 * μια προεπιλογή εδώ θα σήμαινε «μάντεψε εταιρεία» σε προσωπικό αρχείο.
 */
const custodyParams = (custody: CustodyKind): Record<string, string> => ({
  [FILE_CUSTODY_PARAM]: custody,
});

export type PromoteVersionOutcome =
  | { readonly kind: 'promoted' }
  | { readonly kind: 'refused'; readonly why: VersionPromotionRefusal }
  | { readonly kind: 'failed' };

/** Η στοίβα εκδόσεων όπως τη βλέπει ο αιτών — `null` σε βλάβη (η οθόνη δείχνει σφάλμα). */
export async function fetchVersionStack(
  fileId: string,
  custody: CustodyKind,
): Promise<FileVersionStackResponse | null> {
  try {
    return await apiClient.get<FileVersionStackResponse>(versionsUrl(fileId), {
      params: custodyParams(custody),
    });
  } catch (cause) {
    logger.warn('Η στοίβα εκδόσεων δεν φορτώθηκε', { fileId, custody, cause: String(cause) });
    return null;
  }
}

/**
 * **Η παλιά έκδοση γίνεται ξανά τρέχουσα** — με την κεφαλή που **έδειξε** η οθόνη ως
 * προϋπόθεση (AIP-154). Ό,τι άλλαξε στο μεταξύ ⇒ `head-moved`, ποτέ σιωπηλή αντικατάσταση.
 */
export async function requestVersionPromotion(
  sourceFileId: string,
  expectedHeadFileId: string,
  custody: CustodyKind,
): Promise<PromoteVersionOutcome> {
  try {
    await apiClient.post(
      `${versionsUrl(sourceFileId)}/promote`,
      { expectedHeadFileId },
      { params: custodyParams(custody) },
    );
    return { kind: 'promoted' };
  } catch (cause) {
    const refused = apiErrorBodyOf(cause)?.refused;
    const why = VERSION_PROMOTION_REFUSALS.find(reason => reason === refused);
    if (why !== undefined) return { kind: 'refused', why };
    logger.warn('Η «Ορισμός ως τρέχουσας» απέτυχε', { sourceFileId, expectedHeadFileId });
    return { kind: 'failed' };
  }
}
