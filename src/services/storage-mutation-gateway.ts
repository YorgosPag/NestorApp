'use client';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

export interface StorageCreateResult {
  storageId: string;
}

export interface StorageMutationResult {
  id: string;
  _v?: number;
}

export interface StorageMutationResponse {
  success: boolean;
  storage?: unknown;
  message?: string;
  error?: string;
}

interface CreateStorageWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface UpdateStorageWithPolicyInput {
  readonly storageId: string;
  readonly payload: Record<string, unknown>;
}

interface DeleteStorageWithPolicyInput {
  readonly storageId: string;
}

export async function createStorageWithPolicy<T = StorageCreateResult>({
  payload,
}: CreateStorageWithPolicyInput): Promise<T> {
  return apiClient.post<T>(API_ROUTES.STORAGES.LIST, payload);
}

export async function updateStorageWithPolicy<T = StorageMutationResult>({
  storageId,
  payload,
}: UpdateStorageWithPolicyInput): Promise<T> {
  return apiClient.patch<T>(API_ROUTES.STORAGES.BY_ID(storageId), payload);
}

export async function deleteStorageWithPolicy<T = StorageMutationResponse>({
  storageId,
}: DeleteStorageWithPolicyInput): Promise<T> {
  return apiClient.delete<T>(API_ROUTES.STORAGES.BY_ID(storageId));
}
