'use client';

/**
 * **Δέσιμο προσφοράς σε επαφή προμηθευτή** (ADR-327 §8.5 Γ) — ΜΙΑ ροή για δύο σημεία:
 * (α) ο έλεγχος σαρωμένης προσφοράς («ο προμηθευτής του PDF δεν είναι αυτός») · (β) η προσφορά πύλης χωρίς επαφή
 * («Προσθήκη στις επαφές» — BuildingConnected «Unknown Company» → «Add to directory»).
 *
 * 1. `POST /api/contacts/resolve`: ΑΦΜ → email → όνομα → **νέα** επαφή μόνο αν δεν βρεθεί καμία (ποτέ διπλότυπο).
 * 2. `PATCH /api/quotes/{id}` με `vendorContactId` (ο server γράφει γραμμή ιστορικού `vendor_contact_change`).
 *
 * Ιδεμποτικό: δεύτερη κλήση βρίσκει την ίδια επαφή (email/όνομα) και το `PATCH` με ίδια τιμή δεν γράφει τίποτα.
 *
 * @module subapps/procurement/hooks/useBindQuoteVendor
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

/** Ό,τι ξέρουμε για τον προμηθευτή — το σχήμα του `ResolveContactSchema`. */
export interface VendorIdentityInput {
  name: string | null;
  vatNumber?: string | null;
  phone?: string | null;
  emails?: string[];
  logoUrl?: string | null;
  vendorAddress?: string | null;
  vendorCity?: string | null;
  vendorPostalCode?: string | null;
  vendorCountry?: string | null;
  bankAccounts?: Array<{ bankName: string; bic: string | null; iban: string; currency: string | null; accountHolder: string | null }>;
}

export interface BoundVendor {
  contactId: string;
  displayName: string;
  wasCreated: boolean;
}

export function useBindQuoteVendor(quoteId: string) {
  const [binding, setBinding] = useState(false);
  const bind = useCallback(async (input: VendorIdentityInput): Promise<BoundVendor> => {
    setBinding(true);
    try {
      const vendor = await apiClient.post<BoundVendor>(API_ROUTES.CONTACTS.RESOLVE, input);
      await apiClient.patch(API_ROUTES.QUOTES.BY_ID(quoteId), { vendorContactId: vendor.contactId });
      return vendor;
    } finally {
      setBinding(false);
    }
  }, [quoteId]);
  return { binding, bind };
}
