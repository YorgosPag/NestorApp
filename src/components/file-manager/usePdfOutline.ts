'use client';

/**
 * ADR-923 §5.15.2 (Θ.2α-3) — **Τα περιεχόμενα, οι ετικέτες σελίδων και η προτίμηση ανοίγματος** του φορτωμένου εγγράφου.
 *
 * 🔑 Από το **ίδιο** `docRef` (κανένα δεύτερο `getDocument`). Δέντρο, ετικέτες και `pageMode` διαβάζονται μία φορά ανά
 *    έγγραφο — είναι μικρά αντικείμενα του καταλόγου του PDF, όχι σελίδες.
 * 🔑 Οι **σελίδες** των προορισμών λύνονται μόνο όταν ζητηθούν (`resolvePages`: η καρτέλα «Περιεχόμενα» φαίνεται): σε
 *    έντυπο με άδεια η λύση μπορεί να ζητήσει κομμάτια του δέντρου σελίδων.
 *
 * @module components/file-manager/usePdfOutline
 */

import { useEffect, useState, type RefObject } from 'react';

import { createModuleLogger } from '@/lib/telemetry';

import type { PdfDocProxy } from './pdf-canvas-config';
import { normalizePdfOutline, resolveOutlinePages, type PdfOutlineNode } from './pdf-outline';

const logger = createModuleLogger('usePdfOutline');

/** Η προτίμηση του ίδιου του εγγράφου για το πλευρικό πάνελ (`/PageMode`). */
export type PdfPreferredPanel = 'outline' | 'thumbnails' | null;

export interface PdfDocumentNavigation {
  readonly ready: boolean;
  readonly outline: readonly PdfOutlineNode[];
  /** `null` ⇒ οι ετικέτες είναι οι αριθμοί σελίδας. */
  readonly pageLabels: readonly string[] | null;
  readonly preferredPanel: PdfPreferredPanel;
  /** Κόμβος → σελίδα· κενός ως να λυθούν οι προορισμοί. */
  readonly outlinePages: ReadonlyMap<string, number>;
}

const EMPTY: PdfDocumentNavigation = { ready: false, outline: [], pageLabels: null, preferredPanel: null, outlinePages: new Map() };

function preferredPanelOf(pageMode: string): PdfPreferredPanel {
  if (pageMode === 'UseOutlines') return 'outline';
  if (pageMode === 'UseThumbs') return 'thumbnails';
  return null;
}

/** Ετικέτες που δεν αντιστοιχούν 1-προς-1 στις σελίδες αγνοούνται (ξένο έντυπο, ποτέ λάθος αριθμός). */
function labelsOf(labels: readonly string[] | null, numPages: number): readonly string[] | null {
  return labels && labels.length === numPages ? labels : null;
}

async function readNavigation(doc: PdfDocProxy): Promise<Omit<PdfDocumentNavigation, 'outlinePages'>> {
  const [outline, labels, pageMode] = await Promise.all([
    doc.getOutline().catch(() => null),
    doc.getPageLabels().catch(() => null),
    doc.getPageMode().catch(() => ''),
  ]);
  return { ready: true, outline: normalizePdfOutline(outline), pageLabels: labelsOf(labels, doc.numPages), preferredPanel: preferredPanelOf(pageMode) };
}

/**
 * @param documentKey η ταυτότητα του αρχείου (`sourceIdentityOf`) · `null` όσο φορτώνει.
 * @param resolvePages αληθές ⇒ λύσε τις σελίδες των προορισμών (μία φορά ανά έγγραφο).
 */
export function usePdfOutline(docRef: RefObject<PdfDocProxy | null>, documentKey: string | null, resolvePages: boolean): PdfDocumentNavigation {
  const [nav, setNav] = useState<PdfDocumentNavigation>(EMPTY);

  useEffect(() => {
    setNav(EMPTY);
    const doc = docRef.current;
    if (!doc || documentKey === null) return;
    let cancelled = false;
    readNavigation(doc).then((read) => { if (!cancelled) setNav({ ...read, outlinePages: new Map() }); }, (error: unknown) => {
      if (!cancelled) logger.warn('PDF outline failed', { error: error instanceof Error ? error.message : String(error) });
    });
    return () => { cancelled = true; };
  }, [docRef, documentKey]);

  const needsPages = resolvePages && nav.ready && nav.outline.length > 0 && nav.outlinePages.size === 0;
  useEffect(() => {
    const doc = docRef.current;
    if (!needsPages || !doc) return;
    let cancelled = false;
    resolveOutlinePages(doc, nav.outline, () => cancelled).then((pages) => {
      if (!cancelled) setNav((prev) => (prev.outline === nav.outline ? { ...prev, outlinePages: pages } : prev));
    }, () => undefined);
    return () => { cancelled = true; };
  }, [docRef, needsPages, nav.outline]);

  return nav;
}
