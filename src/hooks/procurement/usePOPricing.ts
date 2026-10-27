'use client';

/**
 * usePOPricing — ζωντανή τιμολόγηση της φόρμας παραγγελίας (ADR-330 Phase 5.5 · ADR-923 §5.11 «3γ»)
 *
 * Καλεί την **ίδια** `pricePurchaseOrder` με τον server, πάνω στη συνδρομή των συμβάσεων ⇒ ό,τι
 * δείχνει η φόρμα είναι ό,τι θα αποθηκευτεί. Αυθεντικός παραμένει ο server: η φόρμα δεν στέλνει
 * εκπτώσεις ούτε σύνολα — στέλνει μόνο το πληρωτέο που έδειξε (`expectedTotal`, compare-and-set).
 *
 * Επεξεργασία (Α9): η PO κρατά τους όρους της (`carry`). Παράλληλα υπολογίζονται οι **σημερινοί**
 * όροι, ώστε η φόρμα να δείξει τι θα άλλαζε μια ρητή «Επανατιμολόγηση» — χωρίς να αλλάξει τίποτα.
 *
 * @module hooks/procurement/usePOPricing
 */

import { useCallback, useMemo } from 'react';
import { useFrameworkAgreements } from './useFrameworkAgreements';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import {
  pricePurchaseOrder,
  type POPricing,
  type POPricingInput,
  type POPricingLine,
} from '@/lib/procurement/price-purchase-order-pure';
import {
  pricingDrift,
  type POPricingDrift,
  type POPricingMode,
  type POStoredPricing,
} from '@/lib/procurement/po-pricing-carry';

export interface UsePOPricingInput {
  supplierId: string;
  projectId: string;
  items: readonly POPricingLine[];
  taxRate: number;
  /** Ημερομηνία του εγγράφου στην επεξεργασία (SAP pricing date)· νέα PO ⇒ τώρα. */
  documentDate: string | null;
  /** Η αποθηκευμένη PO στην επεξεργασία· `null` για νέα. */
  stored: POStoredPricing | null;
  pricingMode: POPricingMode;
}

export interface UsePOPricingResult {
  /** Η τιμολόγηση που θα αποθηκευτεί (παγωμένοι όροι, ή σημερινοί αν ζητήθηκε ρητά). */
  pricing: POPricing;
  /** Η τιμολόγηση με τους σημερινούς όρους — για την προεπισκόπηση της Επανατιμολόγησης. */
  current: POPricing;
  /** Τι θα άλλαζε μια Επανατιμολόγηση· `null` για νέα PO ή όταν η Επανατιμολόγηση ήδη ζητήθηκε. */
  drift: POPricingDrift | null;
  /** Τίτλοι των συμβάσεων που έδωσαν έκπτωση, με τη σειρά των `appliedFaIds`. */
  agreementTitles: string[];
  /** Τίτλος σύμβασης από id· `null` για σύμβαση που δεν υπάρχει πια (διαγράφηκε). */
  titleOf: (agreementId: string) => string | null;
  loading: boolean;
}

export function usePOPricing(input: UsePOPricingInput): UsePOPricingResult {
  const { agreements, loading } = useFrameworkAgreements();
  const { supplierId, projectId, items, taxRate, documentDate, stored, pricingMode } = input;

  const pricingInput = useMemo<POPricingInput>(
    () => ({ supplierId, projectId, items, taxRate, atMs: normalizeToMillisOrNull(documentDate) ?? Date.now() }),
    [supplierId, projectId, items, taxRate, documentDate],
  );
  const current = useMemo(() => pricePurchaseOrder(agreements, pricingInput), [agreements, pricingInput]);
  const kept = useMemo(
    () => (stored ? pricePurchaseOrder(agreements, pricingInput, { stored, mode: 'carry' }) : null),
    [agreements, pricingInput, stored],
  );
  const pricing = kept && pricingMode === 'carry' ? kept : current;
  const drift = useMemo(
    () => (kept && pricingMode === 'carry' ? pricingDrift(kept, current) : null),
    [kept, current, pricingMode],
  );

  const titles = useMemo(() => new Map(agreements.map((fa) => [fa.id, fa.title])), [agreements]);
  const titleOf = useCallback((agreementId: string) => titles.get(agreementId) ?? null, [titles]);
  const agreementTitles = useMemo(
    () => pricing.appliedFaIds.flatMap((id) => titleOf(id) ?? []),
    [pricing.appliedFaIds, titleOf],
  );

  return { pricing, current, drift, agreementTitles, titleOf, loading };
}
