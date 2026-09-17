'use client';

/**
 * **ΤΑ ΣΥΝΟΛΑ ΔΙΑΜΟΝΗΣ ΤΗΣ ΑΝΑΖΗΤΗΣΗΣ** — ADR-777 §8.60.12.
 *
 * 🔑 **Context και όχι prop, με μετρημένο λόγο**: τέσσερις επιφάνειες γράφουν τιμή
 * (κάρτα · φούσκα · δείκτης άκρης · πινακίδα χάρτη) και ζουν σε **διαφορετικά βάθη** —
 * η πινακίδα κάτω από τον `ResultsMap`, που είναι ήδη στα **495 / 500** γραμμές. Ένα
 * prop θα περνούσε από τρία ενδιάμεσα συστατικά που δεν το χρησιμοποιούν.
 *
 * ⚠️ **Η προεπιλογή είναι «κανένα σύνολο»**, όχι σφάλμα: η `ListingCard` αποδίδεται και
 * **έξω** από την αναζήτηση (βιτρίνα της αρχικής), όπου δεν υπάρχουν ημερομηνίες — εκεί
 * η κάρτα δείχνει την τιμή ανά νύχτα, που είναι η σωστή απάντηση.
 *
 * 🔴 **Χαμηλής συχνότητας εξ ορισμού**: η τιμή αλλάζει **μία** φορά ανά απάντηση του
 * διακομιστή (αλλαγή ημερομηνιών/ατόμων, με debounce) — ποτέ με κίνηση ποντικιού ή χάρτη.
 */

import React, { createContext, useContext } from 'react';
import { NO_STAY_TOTALS, type StayTotal, type StayTotals } from '@/lib/listings/listing-stay-total';

const StayTotalsContext = createContext<StayTotals>(NO_STAY_TOTALS);

interface StayTotalsProviderProps {
  readonly totals: StayTotals;
  readonly children: React.ReactNode;
}

export function StayTotalsProvider({ totals, children }: StayTotalsProviderProps) {
  return <StayTotalsContext.Provider value={totals}>{children}</StayTotalsContext.Provider>;
}

/** Το σύνολο διαμονής αυτής της αγγελίας, ή `null` όταν δεν πρέπει να δειχθεί. */
export function useStayTotal(listingId: string): StayTotal | null {
  return useContext(StayTotalsContext)[listingId] ?? null;
}
