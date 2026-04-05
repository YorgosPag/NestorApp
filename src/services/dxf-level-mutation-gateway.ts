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
