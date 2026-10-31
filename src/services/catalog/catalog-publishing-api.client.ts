/**
 * @fileoverview **Ο εκδότης καταλόγου όπως τον διαβάζει και τον αλλάζει η οθόνη** — όψη + πράξεις συνταγής/έκδοσης/
 *   προεπισκόπησης (ADR-923 §5.6.1). Μεταφορά, όχι κρίση: διαδρομή, ρήμα, σώμα — ένα σημείο ανά πράξη.
 * @related services/catalog/catalog-pricing-api.client.ts (το ίδιο ιδίωμα για τις τιμές) · app/api/catalog/publication-** (ο αυθεντικός γραφέας)
 * @module services/catalog/catalog-publishing-api.client
 *
 * 🔑 **`apiClient`, όχι `fetch`**: `Idempotency-Key` (CHECK 3.92), χώρος, σώμα άρνησης για τα ευρήματα (`catalogFailureOf`).
 * 🔑 Η λήψη ενός PDF **δεν** περνά από εδώ: είναι σύνδεσμος (`CATALOG_API.publicationDownload`) και το πρόγραμμα περιήγησης
 *    κουβαλά μόνο του τη συνεδρία.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API, EXPECTED_REVISION_PARAM } from '@/subapps/catalog/catalog-routes';
import type {
  PublicationPreviewWire,
  PublicationRecipeDefinition,
  PublicationRecipeWire,
  PublicationRunWire,
  PublicationsViewWire,
} from '@/subapps/catalog/types/publication';

export function fetchPublicationsView(): Promise<PublicationsViewWire> {
  return apiClient.get<PublicationsViewWire>(CATALOG_API.publications);
}

export function createPublicationRecipe(definition: PublicationRecipeDefinition): Promise<PublicationRecipeWire> {
  return apiClient.post<PublicationRecipeWire>(CATALOG_API.publicationRecipes.collection, { definition });
}

/** Αντικατάσταση ολόκληρου του ορισμού με CAS στην αναθεώρηση που διάβασε ο άνθρωπος. */
export function updatePublicationRecipe(id: string, expectedRevision: number, definition: PublicationRecipeDefinition): Promise<PublicationRecipeWire> {
  return apiClient.put<PublicationRecipeWire>(CATALOG_API.publicationRecipes.item(id), { expectedRevision, definition });
}

export function deletePublicationRecipe(id: string, expectedRevision: number): Promise<PublicationRecipeWire> {
  const query = new URLSearchParams({ [EXPECTED_REVISION_PARAM]: String(expectedRevision) });
  return apiClient.delete<PublicationRecipeWire>(`${CATALOG_API.publicationRecipes.item(id)}?${query.toString()}`);
}

/** Ζητά έκδοση από την αποθηκευμένη συνταγή (ιδεμπότητο: ίδιες είσοδοι ⇒ η ίδια έκδοση). */
export function requestPublicationRun(recipeId: string): Promise<PublicationRunWire> {
  return apiClient.post<PublicationRunWire>(CATALOG_API.publicationRecipes.run(recipeId), {});
}

/** Μία σελίδα του μοντέλου όπως θα τυπωθεί· τη συνταγή τη διαλέγει ο διακομιστής (POST που δεν γράφει). */
export function fetchPublicationPreview(modelId: string): Promise<PublicationPreviewWire> {
  return apiClient.post<PublicationPreviewWire>(CATALOG_API.publicationPreview, { modelId });
}
