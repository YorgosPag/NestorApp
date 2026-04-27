'use client';

import { useAsyncData } from '@/hooks/useAsyncData';
import type { PurchaseOrder } from '@/types/procurement';

async function fetchVendorPurchaseOrders(supplierId: string): Promise<PurchaseOrder[]> {
  const res = await fetch(`/api/procurement?supplierId=${encodeURIComponent(supplierId)}`);
  if (!res.ok) throw new Error(`Failed to fetch purchase orders: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as PurchaseOrder[];
}

export function useVendorPurchaseOrders(supplierId: string | null) {
  const { data, loading, error, refetch, silentRefetch } = useAsyncData<PurchaseOrder[]>({
    fetcher: () => (supplierId ? fetchVendorPurchaseOrders(supplierId) : Promise.resolve([])),
    deps: [supplierId],
    enabled: Boolean(supplierId),
    initialData: [],
  });

  return { purchaseOrders: data ?? [], loading, error, refetch, silentRefetch };
}
