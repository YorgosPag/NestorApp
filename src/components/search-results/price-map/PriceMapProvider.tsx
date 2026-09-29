'use client';

/**
 * **Το μοντέλο του χάρτη τιμών για τη στρώση ΚΑΙ το πάνελ** (ADR-890 §14).
 *
 * 🔑 **Γιατί context και όχι state στο `SearchResultsContent`**: ο χάρτης αναφέρει zoom και ορατές περιοχές σε κάθε
 * ηρεμία του. State στη σελίδα αποτελεσμάτων θα ξαναπέδιδε **ολόκληρη** τη λίστα αγγελιών σε κάθε μετακίνηση. Εδώ
 * ξαναποδίδονται μόνο οι δύο καταναλωτές· τα `children` είναι ίδια στοιχεία, άρα το React τα προσπερνά.
 */

import React, { createContext, useContext } from 'react';

import { usePriceMap, type PriceMapModel } from '@/hooks/market/usePriceMap';
import type { ListingCriteria } from '@/lib/criteria/listing-criteria';

const PriceMapContext = createContext<PriceMapModel | null>(null);

interface PriceMapProviderProps {
  readonly criteria: ListingCriteria;
  readonly children: React.ReactNode;
}

export function PriceMapProvider({ criteria, children }: PriceMapProviderProps) {
  const model = usePriceMap(criteria);
  return <PriceMapContext.Provider value={model}>{children}</PriceMapContext.Provider>;
}

/** Το μοντέλο — μόνο μέσα στον `PriceMapProvider` (αλλιώς σφάλμα προγραμματιστή, όχι κατάσταση). */
export function usePriceMapModel(): PriceMapModel {
  const model = useContext(PriceMapContext);
  if (model === null) throw new Error('usePriceMapModel must be used within PriceMapProvider');
  return model;
}
