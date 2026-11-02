import { apiClient } from '@/lib/api/enterprise-api-client';

/**
 * Οι τρεις εγγραφές ενός καταλόγου προμηθειών (ADR-923 §5.11 «3γ» Βήμα 2) — υλικά, συμβάσεις-πλαίσιο.
 *
 * Διαφέρουν μόνο στη διαδρομή και στους τύπους, άρα ζουν εδώ μία φορά (CHECK 3.28). Πάνε μέσω
 * `apiClient` και όχι ωμού `fetch`: το σφάλμα φτάνει ως `ApiClientError` με το `errorCode` που μεταφράζει
 * η φόρμα, και το POST φεύγει με `Idempotency-Key`. Οι συναρτήσεις είναι επιπέδου module, άρα σταθερές
 * αναφορές χωρίς `useCallback`.
 */
export function procurementCatalogApi<TEntity, TCreate, TUpdate>(
  collectionPath: string,
  itemPath: (id: string) => string,
) {
  return {
    create: (dto: TCreate): Promise<TEntity> => apiClient.post<TEntity>(collectionPath, dto),
    update: (id: string, dto: TUpdate): Promise<TEntity> => apiClient.patch<TEntity>(itemPath(id), dto),
    remove: async (id: string): Promise<void> => {
      await apiClient.delete(itemPath(id));
    },
  };
}
