import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { emitSpendAnalyticsInvalidate } from '@/lib/cache/spend-analytics-bus';
import type {
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
} from '@/types/procurement';

/**
 * What a PO save tells the caller (ADR-923 §5.11 «3γ» Α13) — never `{}`.
 * `created` carries the project the server stored, so the caller opens the NEW document;
 * `updated` tells the caller to leave edit mode and reload.
 */
export type PurchaseOrderSaveResult =
  | { readonly kind: 'created'; readonly id: string; readonly poNumber: string; readonly projectId: string }
  | { readonly kind: 'updated'; readonly id: string };

interface PurchaseOrderShareResult {
  shareId: string;
  token: string;
  url: string;
  expiresAt: string;
}

interface PurchaseOrderEmailInput {
  recipientEmail: string;
  recipientName: string;
  language: 'el' | 'en';
}

interface PurchaseOrderEmailResult {
  messageId?: string;
}

export async function createPurchaseOrderWithPolicy(
  input: CreatePurchaseOrderDTO,
): Promise<PurchaseOrderSaveResult> {
  const { id, poNumber } = await apiClient.post<{ id: string; poNumber: string }>(API_ROUTES.PROCUREMENT.LIST, input);
  emitSpendAnalyticsInvalidate();
  return { kind: 'created', id, poNumber, projectId: input.projectId };
}

export async function updatePurchaseOrderWithPolicy(
  poId: string,
  input: UpdatePurchaseOrderDTO,
): Promise<PurchaseOrderSaveResult> {
  await apiClient.patch(API_ROUTES.PROCUREMENT.ACTION(poId, 'update'), input);
  emitSpendAnalyticsInvalidate();
  return { kind: 'updated', id: poId };
}

export async function createPurchaseOrderShareWithPolicy(
  poId: string,
): Promise<PurchaseOrderShareResult> {
  return apiClient.post<PurchaseOrderShareResult>(API_ROUTES.PROCUREMENT.SHARE(poId), {});
}

export async function sendPurchaseOrderEmailWithPolicy(
  poId: string,
  input: PurchaseOrderEmailInput,
): Promise<PurchaseOrderEmailResult> {
  return apiClient.post<PurchaseOrderEmailResult>(API_ROUTES.PROCUREMENT.EMAIL(poId), input);
}
