'use client';

/**
 * 📐 DIM STYLE MUTATION GATEWAY (ADR-362 Phase F4)
 *
 * Client-side wrapper for centralized DIMSTYLE CRUD + default-pointer moves.
 * Mirror of `dxf-level-mutation-gateway.ts` — single API entry point.
 *
 * All persistence goes through /api/dxf-dimension-styles (server-side
 * createEntity pipeline + Admin SDK). The in-memory registry stays the SSoT for
 * the live session; these calls durably persist create/update/delete/set-default.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

export interface DimStyleMutationResponse {
  success: boolean;
  styleId?: string;
  message?: string;
  error?: string;
}

interface CreateDimStyleWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface UpdateDimStyleWithPolicyInput {
  readonly payload: Record<string, unknown>;
}

interface DeleteDimStyleWithPolicyInput {
  readonly styleId: string;
}

interface SetDefaultDimStyleWithPolicyInput {
  readonly styleId: string;
  /** True when the target is a built-in template (ISO/ASME/Arch/Nestor) slug. */
  readonly isBuiltInRef?: boolean;
  /** Display name persisted on a freshly-created thin built-in-ref doc. */
  readonly name?: string;
}

export async function createDimStyleWithPolicy<T = DimStyleMutationResponse>({
  payload,
}: CreateDimStyleWithPolicyInput): Promise<T> {
  return apiClient.post<T>(API_ROUTES.DXF_DIMENSION_STYLES.LIST, payload);
}

export async function updateDimStyleWithPolicy<T = DimStyleMutationResponse>({
  payload,
}: UpdateDimStyleWithPolicyInput): Promise<T> {
  return apiClient.patch<T>(API_ROUTES.DXF_DIMENSION_STYLES.LIST, payload);
}

export async function deleteDimStyleWithPolicy<T = DimStyleMutationResponse>({
  styleId,
}: DeleteDimStyleWithPolicyInput): Promise<T> {
  return apiClient.delete<T>(`${API_ROUTES.DXF_DIMENSION_STYLES.LIST}?styleId=${styleId}`);
}

export async function setDefaultDimStyleWithPolicy<T = DimStyleMutationResponse>({
  styleId,
  isBuiltInRef,
  name,
}: SetDefaultDimStyleWithPolicyInput): Promise<T> {
  return apiClient.patch<T>(API_ROUTES.DXF_DIMENSION_STYLES.LIST, {
    action: 'set-default',
    styleId,
    ...(isBuiltInRef ? { isBuiltInRef: true } : {}),
    ...(name ? { name } : {}),
  });
}
