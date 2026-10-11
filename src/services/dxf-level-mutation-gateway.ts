'use client';

/**
 * 📐 DXF LEVEL MUTATION GATEWAY (ADR-286)
 *
 * Client-side wrapper για centralized DXF level CRUD. Mirror of
 * floor-mutation-gateway.ts — same policy pattern, single API entry point.
 *
 * All DXF Viewer mutations MUST go through this gateway, which routes to
 * /api/dxf-levels (server-side createEntity pipeline).
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { DxfLevelDocument, DxfLevelsListResponse } from '@/app/api/dxf-levels/dxf-levels.types';

export interface DxfLevelMutationResponse {
  success: boolean;
  levelId?: string;
  level?: unknown;
  message?: string;
  error?: string;
}

interface CreateDxfLevelWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface UpdateDxfLevelWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface DeleteDxfLevelWithPolicyInput {
  readonly levelId: string;
}

/**
 * Τα επίπεδα όπως τα ξέρει ο **διακομιστής**, μέσα σε μια εμβέλεια: ενός κτηρίου, ή — χωρίς
 * κτήριο — όλου του μισθωτή. Είναι η ίδια εμβέλεια στην οποία ο διακομιστής κρίνει τη
 * μοναδικότητα ονόματος (ADR-845 §7.15), άρα ό,τι ρωτά ένας γραφέας **πριν** δημιουργήσει
 * (ADR-914 §2.11). Αποτυχία ⇒ πετά· ο καλών αποφασίζει αν συνεχίζει με ό,τι έχει.
 */
export async function listDxfLevelsWithPolicy(buildingId?: string | null): Promise<DxfLevelDocument[]> {
  const url = buildingId
    ? `${API_ROUTES.DXF_LEVELS.LIST}?buildingId=${encodeURIComponent(buildingId)}`
    : API_ROUTES.DXF_LEVELS.LIST;
  const response = await apiClient.get<DxfLevelsListResponse>(url);
  return response?.success ? response.levels : [];
}

export async function createDxfLevelWithPolicy<T = DxfLevelMutationResponse>({
  payload,
}: CreateDxfLevelWithPolicyInput): Promise<T> {
  return apiClient.post<T>(API_ROUTES.DXF_LEVELS.LIST, payload);
}

export async function updateDxfLevelWithPolicy<T = DxfLevelMutationResponse>({
  payload,
}: UpdateDxfLevelWithPolicyInput): Promise<T> {
  return apiClient.patch<T>(API_ROUTES.DXF_LEVELS.LIST, payload);
}

export async function deleteDxfLevelWithPolicy<T = DxfLevelMutationResponse>({
  levelId,
}: DeleteDxfLevelWithPolicyInput): Promise<T> {
  return apiClient.delete<T>(`${API_ROUTES.DXF_LEVELS.LIST}?levelId=${levelId}`);
}
