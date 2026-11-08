/**
 * @fileoverview **Οι δημοσιευμένες εκδόσεις καταλόγου από τον πελάτη** (ADR-923 §5.15.3) — οι πράξεις του ιδιοκτήτη, η λίστα του
 *   αγοραστή και **ο ένας** εκδότης άδειας ανάγνωσης για τις **τρεις** πόρτες (ιδιοκτήτης · αγοραστής · ανώνυμος).
 * @related services/catalog/catalog-publishing-api.client.ts (το ίδιο ιδίωμα) · app/api/catalog/editions/** (ο αυθεντικός γραφέας)
 * @module services/catalog/catalog-editions-api.client
 *
 * 🔑 **`apiClient`, όχι `fetch`**: `Idempotency-Key` στη δημοσίευση/απόσυρση (CHECK 3.92), χώρος, σώμα άρνησης.
 * 🔑 **Ο εκδότης της άδειας ζει στον καλούντα** (ο viewer δεν μαντεύει, Θ.2α-1): κάθε ανανέωση ξαναρωτά την πόρτα κρίσης, άρα
 *    αποσυρμένη έκδοση κλείνει και εν πτήσει. `no-store`: η άδεια δεν μπαίνει ποτέ σε μνήμη του browser.
 * ⚠️ Το `apiClient` δεν δέχεται `AbortSignal` — η άδεια είναι μία μικρή κλήση, άρα ο εκδότης ελέγχει το σήμα **πριν** και
 *    **μετά**: μια ακυρωμένη ανάγνωση δεν παίρνει ποτέ άδεια.
 * ⛔ Το URL της άδειας **είναι** η άδεια: ποτέ σε ημερολόγιο.
 */

import { PUBLIC_REQUEST } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { IssuePdfLicense, PdfReadLicense } from '@/components/file-manager/pdf-range-transport';
import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import type { PublishCatalogEditionBody } from '@/subapps/catalog/schema/zod/catalog-edition.schema';
import type { CatalogEditionOwnerView, CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';

/** Η όψη του ιδιοκτήτη: ό,τι έχει δημοσιεύσει ο χώρος, μαζί με τις αποσυρμένες. */
export async function fetchOwnedCatalogEditions(): Promise<readonly CatalogEditionOwnerView[]> {
  return (await apiClient.get<{ readonly editions: readonly CatalogEditionOwnerView[] }>(CATALOG_API.editions.collection)).editions;
}

/** «Δημοσίευση σε…» (ιδεμπότητο: ίδια διαδρομή + ίδιο κοινό + ήδη ισχύουσα ⇒ η ίδια). */
export async function publishCatalogEdition(body: PublishCatalogEditionBody): Promise<string> {
  return (await apiClient.post<{ readonly editionId: string }>(CATALOG_API.editions.collection, body)).editionId;
}

/** «Απόσυρση»: κλείνει για κάθε θεατή· αν ήταν η ισχύουσα, ο προκάτοχός της ξαναγίνεται ισχύουσα. */
export async function withdrawCatalogEdition(id: string): Promise<string> {
  return (await apiClient.post<{ readonly editionId: string }>(CATALOG_API.editions.withdraw(id), {})).editionId;
}

/** Τα έντυπα ενός προμηθευτή όπως τα βλέπει **ο αγοραστής** (`relationshipId` = η σχέση του). */
export async function fetchBuyerCatalogEditions(relationshipId: string): Promise<readonly CatalogEditionView[]> {
  return (await apiClient.get<{ readonly editions: readonly CatalogEditionView[] }>(CATALOG_API.suppliers.editions(relationshipId))).editions;
}

/** Ποια πόρτα: η ανώνυμη φεύγει **χωρίς** ταυτότητα (`PUBLIC_REQUEST`), αλλιώς ο client πετά 401 πριν φύγει το αίτημα. */
export type CatalogEditionDoor = 'public' | 'signedIn';

/** Ο **ένας** εκδότης άδειας ανάγνωσης: ο viewer τον καλεί στην αρχή και πριν λήξει κάθε άδεια. */
export function catalogEditionLicenseIssuer(url: string, door: CatalogEditionDoor): IssuePdfLicense {
  const config = door === 'public' ? { ...PUBLIC_REQUEST, cache: 'no-store' as const } : { cache: 'no-store' as const };
  return async (signal: AbortSignal): Promise<PdfReadLicense> => {
    signal.throwIfAborted();
    const license = await apiClient.get<PdfReadLicense>(url, config);
    signal.throwIfAborted();
    return license;
  };
}
