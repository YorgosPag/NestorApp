'use client';

import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';

export function useVendorQuotes(vendorContactId: string | null) {
  return useQuotes(vendorContactId ? { vendorContactId } : {});
}
