'use client';

/**
 * @fileoverview **ΕΝΑΣ ΠΑΡΟΧΟΣ ΑΝΑ ΣΕΛΙΔΑ** για το «τι έχω κρατήσει» — ένα fetch για όλες τις καρδιές.
 * @related ADR-777 §8.74 · hooks/listings/useSavedListingsState.ts · SaveListingToggle.tsx
 * @module components/listings/SavedListingsProvider
 *
 * 🔑 **N κάρτες ≠ N αιτήματα**: η λίστα αποτελεσμάτων, η βιτρίνα, το προφίλ γραφείου, η λεπτομέρεια και
 * η σελίδα «Αποθηκευμένα» στήνουν **έναν** πάροχο· κάθε καρδιά διαβάζει από εκεί.
 *
 * ♿ **Η αποτυχία ακούγεται ΚΑΙ φαίνεται**: στις δημόσιες σελίδες δεν ζει `NotificationProvider`, άρα ο
 * πάροχος έχει τη δική του περιοχή `role="status"` — η επαναφορά της καρδιάς χωρίς εξήγηση θα έμοιαζε
 * με σφάλμα της οθόνης. Η είδηση σβήνει μόνη της· δεν κλέβει ποτέ την εστίαση.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSavedListingsState, type SaveNotice, type SavedListingsState } from '@/hooks/listings/useSavedListingsState';

const SavedListingsContext = createContext<SavedListingsState | null>(null);

/** Πόσο μένει ορατή η είδηση — αρκετά για να διαβαστεί μια πρόταση, όχι για να ενοχλεί. */
const NOTICE_VISIBLE_MS = 6000;

function SaveNoticeRegion({ notice }: { readonly notice: SaveNotice | null }): React.ReactElement {
  const { t } = useTranslation(['common']);
  const [shown, setShown] = useState<SaveNotice | null>(null);

  useEffect(() => {
    if (notice === null) return undefined;
    setShown(notice);
    const timer = window.setTimeout(() => setShown(null), NOTICE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <p
      role="status"
      className={
        shown === null
          ? 'sr-only'
          : 'fixed inset-x-4 bottom-4 z-[var(--z-index-banner)] mx-auto max-w-md rounded-md border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg'
      }
    >
      {shown === null ? '' : t(`common:savedListing.notice.${shown.kind}`)}
    </p>
  );
}

export function SavedListingsProvider({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const state = useSavedListingsState();
  return (
    <SavedListingsContext.Provider value={state}>
      {children}
      <SaveNoticeRegion notice={state.notice} />
    </SavedListingsContext.Provider>
  );
}

/**
 * **Η κατάσταση της καρδιάς μιας αγγελίας** — ή `null` έξω από πάροχο. Η επιφάνεια που δεν στήνει
 * πάροχο **δεν** δείχνει καρδιά: επιλογή της επιφάνειας, ποτέ καρδιά που δεν μπορεί να γράψει.
 */
export function useSavedListing(listingId: string): { readonly saved: boolean; readonly available: boolean; readonly toggle: () => void } | null {
  const state = useContext(SavedListingsContext);
  if (state === null) return null;
  return {
    saved: state.savedIds.has(listingId),
    // Ο ανώνυμος ΜΠΟΡΕΙ να πατήσει (πάει στη σύνδεση με την πρόθεση)· μόνο η φόρτωση/βλάβη απενεργοποιεί.
    available: state.status === 'ready' || state.status === 'anonymous',
    toggle: () => state.toggle(listingId),
  };
}

/** Η λίστα της σελίδας «Αποθηκευμένα» — από τον **ίδιο** πάροχο, όχι δεύτερο fetch. */
export function useSavedListingsPage(): Pick<SavedListingsState, 'status' | 'rows' | 'truncated'> | null {
  const state = useContext(SavedListingsContext);
  return state === null ? null : { status: state.status, rows: state.rows, truncated: state.truncated };
}
