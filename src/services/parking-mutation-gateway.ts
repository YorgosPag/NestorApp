'use client';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

export interface ParkingCreateResult {
  parkingSpotId: string;
}

export interface ParkingMutationResult {
  id: string;
  _v?: number;
}

interface CreateParkingWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface UpdateParkingWithPolicyInput {
  readonly parkingSpotId: string;
  readonly payload: Record<string, unknown>;
}

interface DeleteParkingWithPolicyInput {
  readonly parkingSpotId: string;
}

export async function createParkingWithPolicy<T = ParkingCreateResult>({
  payload,
}: CreateParkingWithPolicyInput): Promise<T> {
  return apiClient.post<T>(API_ROUTES.PARKING.LIST, payload);
}

export async function updateParkingWithPolicy<T = ParkingMutationResult>({
  parkingSpotId,
  payload,
}: UpdateParkingWithPolicyInput): Promise<T> {
  return apiClient.patch<T>(API_ROUTES.PARKING.BY_ID(parkingSpotId), payload);
}

export async function deleteParkingWithPolicy<T = ParkingMutationResult>({
  parkingSpotId,
}: DeleteParkingWithPolicyInput): Promise<T> {
  return apiClient.delete<T>(API_ROUTES.PARKING.BY_ID(parkingSpotId));
}
