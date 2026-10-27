'use client';

/**
 * usePOPricing — ζωντανή τιμολόγηση της φόρμας παραγγελίας (ADR-330 Phase 5.5 · ADR-923 §5.11 «3γ»)
 *
 * Καλεί την **ίδια** `pricePurchaseOrder` με τον server, πάνω στη συνδρομή των συμβάσεων ⇒ ό,τι
 * δείχνει η φόρμα είναι ό,τι θα αποθηκευτεί. Αυθεντικός παραμένει ο server: η φόρμα δεν στέλνει
 * εκπτώσεις ούτε σύνολα.
 *
 * @module hooks/procurement/usePOPricing
 */

import { useMemo } from 'react';
import { useFrameworkAgreements } from './useFrameworkAgreements';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import {
  pricePurchaseOrder,
  type POPricing,
  type POPricingLine,
} from '@/lib/procurement/price-purchase-order-pure';

export interface UsePOPricingInput {
  supplierId: string;
  projectId: string;
  items: readonly POPricingLine[];
  taxRate: number;
  /** Ημερομηνία του εγγράφου στην επεξεργασία (SAP pricing date)· νέα PO ⇒ τώρα. */
  documentDate: string | null;
}

export interface UsePOPricingResult {
  pricing: POPricing;
  /** Τίτλοι των συμβάσεων που έδωσαν έκπτωση, με τη σειρά των `appliedFaIds`. */
  agreementTitles: string[];
  loading: boolean;
}

export function usePOPricing(input: UsePOPricingInput): UsePOPricingResult {
  const { agreements, loading } = useFrameworkAgreements();
  const { supplierId, projectId, items, taxRate, documentDate } = input;

  const pricing = useMemo(
    () => pricePurchaseOrder(agreements, {
      supplierId,
      projectId,
      items,
      taxRate,
      atMs: normalizeToMillisOrNull(documentDate) ?? Date.now(),
    }),
    [agreements, supplierId, projectId, items, taxRate, documentDate],
  );

  const agreementTitles = useMemo(() => {
    const titles = new Map(agreements.map((fa) => [fa.id, fa.title]));
    return pricing.appliedFaIds.flatMap((id) => titles.get(id) ?? []);
  }, [agreements, pricing.appliedFaIds]);

  return { pricing, agreementTitles, loading };
}
