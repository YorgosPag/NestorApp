import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
} from '@/types/procurement';

interface PurchaseOrderSaveResult {
  id?: string;
  poNumber?: string;
}

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

export async function savePurchaseOrderWithPolicy(
  input: CreatePurchaseOrderDTO | UpdatePurchaseOrderDTO,
  poId?: string,
): Promise<PurchaseOrderSaveResult> {
  if (poId) {
    await apiClient.patch(API_ROUTES.PROCUREMENT.ACTION(poId, 'update'), input);
    return {};
  }

  return apiClient.post<PurchaseOrderSaveResult>(API_ROUTES.PROCUREMENT.LIST, input);
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
