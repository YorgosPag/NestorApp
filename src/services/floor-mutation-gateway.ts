'use client';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

export interface FloorMutationResponse {
  success: boolean;
  floorId?: string;
  floor?: unknown;
  message?: string;
  error?: string;
}

interface CreateFloorWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface UpdateFloorWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface DeleteFloorWithPolicyInput {
  readonly floorId: string;
}

export async function createFloorWithPolicy<T = FloorMutationResponse>({
  payload,
}: CreateFloorWithPolicyInput): Promise<T> {
  return apiClient.post<T>(API_ROUTES.FLOORS.LIST, payload);
}

export async function updateFloorWithPolicy<T = FloorMutationResponse>({
  payload,
}: UpdateFloorWithPolicyInput): Promise<T> {
  return apiClient.patch<T>(API_ROUTES.FLOORS.LIST, payload);
}

export async function deleteFloorWithPolicy<T = FloorMutationResponse>({
  floorId,
}: DeleteFloorWithPolicyInput): Promise<T> {
  return apiClient.delete<T>(`${API_ROUTES.FLOORS.LIST}?floorId=${floorId}`);
}
