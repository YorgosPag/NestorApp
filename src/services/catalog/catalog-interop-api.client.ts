/**
 * @fileoverview **Η διαλειτουργικότητα του καταλόγου όπως τη ζητά η οθόνη** — εξαγωγή ETIM xChange (ADR-923 §5.14).
 *   Μεταφορά, όχι κρίση: διαδρομή, ρήμα, παράμετροι.
 * @related app/api/catalog/xchange-export/route.ts (ο αυθεντικός αναγνώστης)
 * @module services/catalog/catalog-interop-api.client
 *
 * 🔑 **`apiClient`, όχι σύνδεσμος**: η αναφορά εξαγωγής πρέπει να φτάσει στην οθόνη δίπλα στο αρχείο (Ζ5), και το σώμα άρνησης
 *    κουβαλά τα ευρήματα (`catalogFailureOf`).
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import type { XChangeExportPreview, XChangeExportWire } from '@/subapps/catalog/types/xchange-export';

/** `priceListId === null` ⇒ η δημόσια τιμή καταλόγου (απόφαση Ε1). */
export function fetchXChangeExport(priceListId: string | null, language: string): Promise<XChangeExportWire> {
  return apiClient.get<XChangeExportWire>(CATALOG_API.xchangeExport(priceListId, language));
}

/** Ο προέλεγχος για το ίδιο κοινό (§5.14.1 · Ε3): η μέτρηση της εξαγωγής, χωρίς έγγραφο. */
export function fetchXChangeExportPreview(priceListId: string | null): Promise<XChangeExportPreview> {
  return apiClient.get<XChangeExportPreview>(CATALOG_API.xchangeExportPreview(priceListId));
}
