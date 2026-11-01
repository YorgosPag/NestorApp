/**
 * Ποιο κτίριο τροφοδοτεί τις επιλογές φάσης και ορόσημου μιας υποχρέωσης χωρίς δικό της κτίριο.
 *
 * ADR-829 §7.1 — έργο που δεν υπάρχει πια απαντά 404 αντί για κενή λίστα. Για τη φόρμα είναι η ίδια περίπτωση: καμία
 * απάντηση από το έργο, άρα δεύτερη προσπάθεια στα κτίρια του χώρου. Κάθε άλλο σφάλμα ανεβαίνει όπως πριν.
 *
 * @module components/obligations/pages/obligation-binding-building
 */

import { API_ROUTES } from '@/config/domain-constants';
import { ApiClientError, apiClient } from '@/lib/api/enterprise-api-client';

interface BuildingsResponse {
  readonly buildings?: ReadonlyArray<{ readonly id: string }>;
}

const firstBuildingId = (response: BuildingsResponse | null | undefined): string =>
  response?.buildings?.[0]?.id ?? '';

async function firstBuildingOfProject(projectId: string): Promise<string> {
  const url = `${API_ROUTES.BUILDINGS.LIST}?projectId=${encodeURIComponent(projectId)}`;
  try {
    return firstBuildingId(await apiClient.get<BuildingsResponse>(url));
  } catch (error) {
    if (ApiClientError.isApiClientError(error) && error.statusCode === 404) return '';
    throw error;
  }
}

/** Το πρώτο κτίριο του έργου, αλλιώς το πρώτο του χώρου, αλλιώς κενό. */
export async function resolveBindingBuildingId(projectId: string | null): Promise<string> {
  const scoped = projectId ? await firstBuildingOfProject(projectId) : '';
  if (scoped) return scoped;
  return firstBuildingId(await apiClient.get<BuildingsResponse>(API_ROUTES.BUILDINGS.LIST));
}
