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

import { ApiClientError, apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

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

/** **Όρισε** (ή, με `null`, επανάφερε στην αυτόματη επιλογή) τον υπεύθυνο του ακινήτου. */
export async function saveObligorDesignation(propertyId: string, contactId: string | null): Promise<ObligorDesignationSave> {
  try {
    await apiClient.put(OBLIGOR_DESIGNATIONS_URL, { propertyId, contactId });
    return { kind: 'saved' };
  } catch (cause) {
    const code = cause instanceof ApiClientError ? cause.errorCode ?? null : null;
    logger.error('Ο υπεύθυνος του ακινήτου δεν ορίστηκε', { error: cause instanceof Error ? cause.message : String(cause), code });
    return { kind: 'failed', code };
  }
}
