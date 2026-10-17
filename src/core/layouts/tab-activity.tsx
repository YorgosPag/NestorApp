'use client';
/**
 * @fileoverview **Είναι ορατή η καρτέλα όπου ζω;** — το σήμα που λείπει όταν οι καρτέλες μένουν προσαρτημένες.
 * @related ADR-912 §12.14 · `components/generic/UniversalTabsRenderer.tsx` (ο πάροχος) · `record-action-bar.tsx` (ο καταναλωτής)
 * @module core/layouts/tab-activity
 *
 * 🔴 **Η αφορμή**: το `UniversalTabsRenderer` κρατά κάθε καρτέλα που άνοιξε **μία φορά** στο DOM (`forceMount` + κρυφή με
 *   CSS), για να μη χάνεται η τοπική της κατάσταση. Μια καρτέλα που συνεισφέρει ενέργεια σε επιφάνεια **έξω** από
 *   αυτήν (κάτω μπάρα εγγραφής) θα την άφηνε εκεί και αφού ο άνθρωπος πήγε αλλού — «+ Προσθήκη Αρχείων» στις Πληροφορίες.
 * 🔑 Ίδια ιδέα με το `<Activity mode="hidden">` της React: το περιεχόμενο **ζει**, αλλά ξέρει ότι δεν φαίνεται.
 * 🔑 **Έξω από διαχειριζόμενες καρτέλες = ενεργό**: ό,τι δεν ζει σε καρτέλα, φαίνεται.
 */
import { createContext, useContext } from 'react';

const TabActivityContext = createContext(true);

/** Το δηλώνει ο renderer των καρτελών, μία φορά ανά καρτέλα — όχι κάθε καταναλωτής. */
export const TabActivityProvider = TabActivityContext.Provider;

/** `false` ⇒ η καρτέλα είναι προσαρτημένη αλλά κρυμμένη· ό,τι προβάλλει **έξω** από αυτήν πρέπει να αποσυρθεί. */
export function useTabIsActive(): boolean {
  return useContext(TabActivityContext);
}
