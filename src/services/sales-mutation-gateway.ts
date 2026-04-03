import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import type { SalesAccountingEvent } from '@/services/sales-accounting';

export interface SalesAppurtenanceSyncSpace {
  spaceId: string;
  spaceType: 'parking' | 'storage';
  salePrice?: number | null;
}

interface SalesAppurtenanceSyncPayload {
  action: 'reserve' | 'sell' | 'revert';
  spaces: SalesAppurtenanceSyncSpace[];
  owners?: PropertyOwnerEntry[] | null;
  ownerContactIds?: string[] | null;
}

export async function dispatchSalesAccountingEventWithPolicy(
  propertyId: string,
  event: SalesAccountingEvent,
): Promise<void> {
  await apiClient.post(API_ROUTES.SALES.ACCOUNTING_EVENT(propertyId), event);
}

export async function syncSalesAppurtenancesWithPolicy(
  propertyId: string,
  payload: SalesAppurtenanceSyncPayload,
): Promise<void> {
  await apiClient.post(API_ROUTES.SALES.APPURTENANCE_SYNC(propertyId), payload);
}
