'use client';

/**
 * @fileoverview **Τα δεδομένα της καρτέλας «Παράδοση»** — μία ανάγνωση, όταν ξέρουμε ποιος ρωτά (ADR-916 §5.15 Φ-Δ).
 * @related hooks/useIdentityGatedResource (ο κανόνας «μην ρωτάς πριν ξέρεις ποιος ρωτά») ·
 *          services/property-handover/property-handover-preview.client
 * @module hooks/property-handover/usePropertyHandover
 */

import { useCallback } from 'react';

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import { fetchPropertyHandover, type PropertyHandoverLoad } from '@/services/property-handover/property-handover-preview.client';

/** Λύθηκε η ταυτότητα και δεν υπάρχει κανείς ⇒ τίποτα να δείξουμε (η σελίδα ούτως ή άλλως ζητά σύνδεση). */
const NOBODY: PropertyHandoverLoad = { kind: 'unavailable' };

export type PropertyHandoverState = { readonly kind: 'loading' } | PropertyHandoverLoad;

export interface PropertyHandoverApi {
  readonly view: PropertyHandoverState;
  readonly reload: () => void;
}

export function usePropertyHandover(propertyId: string): PropertyHandoverApi {
  const fetcher = useCallback(() => fetchPropertyHandover(propertyId), [propertyId]);
  const { value, reload } = useIdentityGatedResource<PropertyHandoverLoad>(fetcher, NOBODY);
  return { view: value ?? { kind: 'loading' }, reload };
}
