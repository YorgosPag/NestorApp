/**
 * @fileoverview **Το μητρώο λήξεων, όπως το βλέπει η οθόνη** — μεταφορά, όχι κρίση (ADR-915 Φ4γ).
 * @related services/document-registry/document-registry.service.ts · app/api/document-registry/route.ts ·
 *   services/mandate/mandate-catalog.client.ts (το ιδίωμα)
 * @module services/document-registry/document-registry.client
 *
 * 🔑 **Καμία κρίση εδώ.** Κατάσταση, ασυμφωνία, αντικατάσταση και «τι σταματά» υπολογίζονται **στον διακομιστή**, με
 *    **ένα** `asOf` (Ελλάδα). Ένας δεύτερος υπολογισμός στον πελάτη θα σήμαινε δύο ρολόγια: το «έληξε» θα άλλαζε με
 *    το ρολόι του υπολογιστή του χρήστη.
 *
 * ⚠️ Ο `apiClient` πετά σε μη-2xx — εδώ μεταφράζεται σε **ρητή ένωση**, ώστε η οθόνη να μην πιάνει εξαιρέσεις.
 */

import { ApiClientError, apiClient, isClientRefusal } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { IssuanceAssignmentBody, IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import type { IssuanceDelivery } from '@/lib/document-validity/issuance-assignment';
import type { IssuancePreview } from '@/types/issuance-invitation';

const logger = createModuleLogger('document-registry.client');

/** Η διαδρομή ανάγνωσης — ΕΝΑ σημείο. Η εμβέλεια είναι η εταιρεία του συνδεδεμένου, πάντα (`ctx.companyId`). */
export const DOCUMENT_REGISTRY_URL = '/api/document-registry';

/** Τι έγινε με την ανάγνωση, όπως το βλέπει η οθόνη. */
export type RegistryLoad =
  | { readonly kind: 'ready'; readonly registry: DocumentRegistryResponse }
  | { readonly kind: 'failed'; readonly message: string };

/** **Φέρε το μητρώο.** */
export async function fetchDocumentRegistry(): Promise<RegistryLoad> {
  try {
    return { kind: 'ready', registry: await apiClient.get<DocumentRegistryResponse>(DOCUMENT_REGISTRY_URL) };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    logger.error('Το μητρώο λήξεων δεν φορτώθηκε', { error: message });
    return { kind: 'failed', message };
  }
}

/** ADR-915 §26 — ο ρητός υπεύθυνος εγγράφων ακινήτου: ΕΝΑ σημείο για τη διαδρομή. */
export const OBLIGOR_DESIGNATIONS_URL = `${DOCUMENT_REGISTRY_URL}/obligor-designations`;

/** Τι έγινε με τον ορισμό, όπως το βλέπει η οθόνη — `code` = ο κωδικός άρνησης του διακομιστή, αν υπάρχει. */
export type ObligorDesignationSave =
  | { readonly kind: 'saved' }
  | { readonly kind: 'failed'; readonly code: string | null };

/**
 * Ο κωδικός άρνησης + **ένα** log στο σωστό επίπεδο: ονομασμένη άρνηση (4xx, π.χ. `NO_EMAIL`) ⇒ `warn` — την λέει η οθόνη·
 * βλάβη (5xx · δίκτυο) ⇒ `error`. Το κριτήριο είναι του `apiClient` (`isClientRefusal`), όχι δεύτερο εδώ.
 */
function logActionFailure(failure: string, cause: unknown, context: Record<string, string>): string | null {
  const code = cause instanceof ApiClientError ? cause.errorCode ?? null : null;
  const meta = { error: cause instanceof Error ? cause.message : String(cause), code, ...context };
  if (isClientRefusal(cause)) logger.warn(failure, meta);
  else logger.error(failure, meta);
  return code;
}

/**
 * Μία εγγραφή του μητρώου (§26 · §27): ο `apiClient` πετά σε μη-2xx — εδώ γίνεται **ρητή ένωση** με τον κωδικό άρνησης,
 * ώστε η οθόνη να διαλέξει μήνυμα χωρίς να πιάνει εξαιρέσεις. Ένα σημείο για όλες τις πράξεις.
 */
async function putRegistryAction(url: string, body: object, failure: string, context: Record<string, string>): Promise<ObligorDesignationSave> {
  try {
    await apiClient.put(url, body);
    return { kind: 'saved' };
  } catch (cause) {
    return { kind: 'failed', code: logActionFailure(failure, cause, context) };
  }
}

/** **Όρισε** (ή, με `null`, επανάφερε στην αυτόματη επιλογή) τον υπεύθυνο του ακινήτου. */
export async function saveObligorDesignation(propertyId: string, contactId: string | null): Promise<ObligorDesignationSave> {
  return putRegistryAction(OBLIGOR_DESIGNATIONS_URL, { propertyId, contactId }, 'Ο υπεύθυνος του ακινήτου δεν ορίστηκε', {});
}

/** ADR-915 §27 — η ανάθεση έκδοσης: ΕΝΑ σημείο για τη διαδρομή. */
export const ISSUANCE_ASSIGNMENTS_URL = `${DOCUMENT_REGISTRY_URL}/issuance-assignments`;

/** **Μία πράξη** στην ανάθεση (πρόταση · απόφαση · ενημέρωση · απάντηση · ακύρωση). */
export async function saveIssuanceAction(request: IssuanceAssignmentBody): Promise<ObligorDesignationSave> {
  return putRegistryAction(ISSUANCE_ASSIGNMENTS_URL, request, 'Η πράξη ανάθεσης δεν αποθηκεύτηκε', { action: request.action });
}

/** ADR-915 §28 — προεπισκόπηση και αποστολή μηνύματος με σύνδεσμο: ΕΝΑ σημείο για τη διαδρομή. */
export const ISSUANCE_MESSAGES_URL = `${ISSUANCE_ASSIGNMENTS_URL}/messages`;

export type IssuanceMessageResult<T> = { readonly kind: 'ok'; readonly data: T } | { readonly kind: 'failed'; readonly code: string | null };

async function postIssuanceMessage<T>(body: IssuanceSendBody & { readonly intent: 'preview' | 'send' }): Promise<IssuanceMessageResult<T>> {
  try {
    return { kind: 'ok', data: await apiClient.post<T>(ISSUANCE_MESSAGES_URL, body) };
  } catch (cause) {
    return { kind: 'failed', code: logActionFailure('Το μήνυμα ανάθεσης δεν ολοκληρώθηκε', cause, { intent: body.intent }) };
  }
}

/** Η προεπισκόπηση — **καμία** εγγραφή στον διακομιστή. */
export function previewIssuanceMessage(body: IssuanceSendBody): Promise<IssuanceMessageResult<{ readonly preview: IssuancePreview }>> {
  return postIssuanceMessage({ ...body, intent: 'preview' });
}

/** Η αποστολή — **ένα** πάτημα του ανθρώπου, ποτέ αυτόματα (§18.5). */
export function sendIssuanceMessage(body: IssuanceSendBody): Promise<IssuanceMessageResult<{ readonly stage: string; readonly delivery: IssuanceDelivery; readonly accessCode: string | null }>> {
  return postIssuanceMessage({ ...body, intent: 'send' });
}
