'use client';

/**
 * ADR-923 §5.15.2 (Θ.2α-3) — **Ο κάτοχος του πλευρικού πάνελ**: ανοιχτό/κλειστό και ποια καρτέλα.
 *
 * Προτεραιότητα στο άνοιγμα ενός εγγράφου (Acrobat):
 * 1. Το `/PageMode` του **ίδιου** του εγγράφου (`UseOutlines` · `UseThumbs`) — ο εκδότης ξέρει πώς διαβάζεται το έντυπο.
 * 2. Η τελευταία επιλογή του ανθρώπου σε αυτή τη συσκευή (`STORAGE_KEYS.PDF_VIEWER_SIDEBAR`).
 * 3. Κλειστό· καρτέλα «Περιεχόμενα» αν υπάρχουν, αλλιώς «Μικρογραφίες».
 *
 * 🔑 Η αποθηκευμένη τιμή είναι ιστορικό, όχι αλήθεια: ελέγχεται σε κάθε ανάγνωση, αλλοιωμένη ⇒ προεπιλογή.
 * 🔑 Καρτέλα «Περιεχόμενα» σε έγγραφο χωρίς περιεχόμενα ⇒ «Μικρογραφίες» (ποτέ άδεια καρτέλα).
 *
 * @module components/file-manager/usePdfSidebar
 */

import { useCallback, useEffect, useState, type RefObject } from 'react';

import { safeGetItem, safeSetItem, STORAGE_KEYS } from '@/lib/storage';

import type { PdfDocProxy } from './pdf-canvas-config';
import { usePdfOutline, type PdfDocumentNavigation, type PdfPreferredPanel } from './usePdfOutline';
import { usePdfThumbnails, type PdfThumbnails } from './usePdfThumbnails';

export type PdfSidebarTab = 'thumbnails' | 'outline';

interface StoredSidebar {
  readonly open: boolean;
  readonly tab: PdfSidebarTab | null;
}

export function parseStoredSidebar(raw: unknown): StoredSidebar {
  if (typeof raw !== 'object' || raw === null) return { open: false, tab: null };
  const { open, tab } = raw as { readonly open?: unknown; readonly tab?: unknown };
  return { open: open === true, tab: tab === 'thumbnails' || tab === 'outline' ? tab : null };
}

const readStored = (): StoredSidebar => parseStoredSidebar(safeGetItem<unknown>(STORAGE_KEYS.PDF_VIEWER_SIDEBAR, null));

/** Η αρχική κατάσταση για ένα έγγραφο — καθαρή, για την άγκυρα. */
export function initialSidebarState(stored: StoredSidebar, preferred: PdfPreferredPanel, hasOutline: boolean): { open: boolean; tab: PdfSidebarTab } {
  const fallbackTab: PdfSidebarTab = hasOutline ? 'outline' : 'thumbnails';
  if (preferred !== null) return { open: true, tab: preferred === 'outline' && !hasOutline ? 'thumbnails' : preferred };
  const tab = stored.tab === 'outline' && !hasOutline ? 'thumbnails' : (stored.tab ?? fallbackTab);
  return { open: stored.open, tab };
}

export interface PdfSidebarState {
  readonly open: boolean;
  readonly tab: PdfSidebarTab;
  readonly toggle: () => void;
  readonly setOpen: (open: boolean) => void;
  readonly setTab: (tab: PdfSidebarTab) => void;
}

/**
 * @param documentKey ταυτότητα του αρχείου — νέο έγγραφο ⇒ νέα αρχική κατάσταση, όταν διαβαστεί η πλοήγησή του (`navReady`).
 */
export function usePdfSidebar(documentKey: string | null, navReady: boolean, preferred: PdfPreferredPanel, hasOutline: boolean): PdfSidebarState {
  // Σταθερή αρχική τιμή (ίδια σε server και client — καμία ασυμφωνία hydration)· η αποθηκευμένη μπαίνει όταν το έγγραφο είναι έτοιμο.
  const [state, setState] = useState<{ open: boolean; tab: PdfSidebarTab }>({ open: false, tab: 'thumbnails' });

  useEffect(() => {
    if (documentKey === null || !navReady) return;
    setState(initialSidebarState(readStored(), preferred, hasOutline));
  }, [documentKey, navReady, preferred, hasOutline]);

  const commit = useCallback((next: { open: boolean; tab: PdfSidebarTab }) => {
    setState(next);
    safeSetItem(STORAGE_KEYS.PDF_VIEWER_SIDEBAR, next);
  }, []);

  const setOpen = useCallback((open: boolean) => commit({ ...state, open }), [commit, state]);
  const toggle = useCallback(() => commit({ ...state, open: !state.open }), [commit, state]);
  const setTab = useCallback((tab: PdfSidebarTab) => commit({ ...state, tab }), [commit, state]);

  return { open: state.open, tab: state.tab, toggle, setOpen, setTab };
}

export interface PdfReaderSidebar {
  readonly sidebar: PdfSidebarState;
  readonly navigation: PdfDocumentNavigation;
  readonly thumbnails: PdfThumbnails;
}

/**
 * Η σύνθεση των τριών κατόχων για τον θεατή. `enabled === false` (ο καλών δεν ζήτησε `features.sidebar`) ⇒ κανένα
 * store, καμία ανάγνωση περιεχομένων: η σημερινή συμπεριφορά του file manager και της εισαγωγής μένει αυτούσια.
 */
export function usePdfReaderSidebar(docRef: RefObject<PdfDocProxy | null>, documentKey: string | null, enabled: boolean): PdfReaderSidebar {
  const activeKey = enabled ? documentKey : null;
  // Για ΠΟΙΟ έγγραφο ζητήθηκαν οι σελίδες — δεμένο στην ταυτότητα, ώστε νέο έγγραφο να μην κληρονομεί το «ναι».
  const [resolveFor, setResolveFor] = useState<string | null>(null);
  const navigation = usePdfOutline(docRef, activeKey, activeKey !== null && resolveFor === activeKey);
  const sidebar = usePdfSidebar(activeKey, navigation.ready, navigation.preferredPanel, navigation.outline.length > 0);
  const thumbnails = usePdfThumbnails(docRef, activeKey, enabled);
  // Οι σελίδες των προορισμών λύνονται την πρώτη φορά που φαίνονται τα περιεχόμενα — και μένουν για το έγγραφο.
  const showsOutline = sidebar.open && sidebar.tab === 'outline';
  useEffect(() => { if (showsOutline && activeKey !== null) setResolveFor(activeKey); }, [showsOutline, activeKey]);
  return { sidebar, navigation, thumbnails };
}
