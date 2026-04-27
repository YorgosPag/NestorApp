'use client';

import { useAsyncData } from '@/hooks/useAsyncData';
import type { VendorInvite } from '@/subapps/procurement/types/vendor-invite';

async function fetchVendorRfqInvites(vendorContactId: string): Promise<VendorInvite[]> {
  const res = await fetch(
    `/api/procurement/vendor-invites?vendorContactId=${encodeURIComponent(vendorContactId)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch RFQ invites: ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as VendorInvite[];
}

export function useVendorRfqInvites(vendorContactId: string | null) {
  const { data, loading, error, refetch, silentRefetch } = useAsyncData<VendorInvite[]>({
    fetcher: () =>
      vendorContactId ? fetchVendorRfqInvites(vendorContactId) : Promise.resolve([]),
    deps: [vendorContactId],
    enabled: Boolean(vendorContactId),
    initialData: [],
  });

  return { invites: data ?? [], loading, error, refetch, silentRefetch };
}
