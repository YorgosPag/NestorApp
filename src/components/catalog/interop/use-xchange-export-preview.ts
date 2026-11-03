'use client';

/**
 * @fileoverview **Ο προέλεγχος της εξαγωγής xChange** στην οθόνη (ADR-923 §5.14.1 · απόφαση Ε3): για το κοινό που διάλεξε ο
 *   χρήστης, πόσα προϊόντα θα γράφονταν και, αν κανένα, **γιατί** — πριν πατήσει «Εξαγωγή».
 * @related server/catalog/xchange-export.server.ts (`previewXChangeExport`: η ίδια κρίση με το αρχείο)
 * @module components/catalog/interop/use-xchange-export-preview
 *
 * 🔑 **Το αποτέλεσμα είναι δεμένο στο κοινό που το ζήτησε**: αλλαγή κοινού ενώ τρέχει ένας προέλεγχος ⇒ η παλιά απάντηση δεν
 *    φαίνεται ποτέ, ούτε για μια στιγμή (κλειδί, όχι σημαία). Το «φορτώνει» είναι παράγωγο, όχι κατάσταση που ξεχνιέται.
 * 🔑 Άρνηση με ευρήματα (λίστα που δεν προσφέρεται) ⇒ στο παράθυρο. Κάθε άλλη αποτυχία ⇒ η μία ειδοποίηση του καταλόγου, και
 *    η εξαγωγή μένει δυνατή: ο διακομιστής κρίνει ξανά (ποτέ κενό αρχείο), ο προέλεγχος είναι οδηγός, όχι φράχτης.
 */

import { useEffect, useRef, useState } from 'react';

import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { fetchXChangeExportPreview } from '@/services/catalog/catalog-interop-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { XChangeExportPreview } from '@/subapps/catalog/types/xchange-export';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';

export type XChangePreviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly preview: XChangeExportPreview }
  | { readonly kind: 'refused'; readonly issues: readonly CatalogIssue[] }
  /** Ο προέλεγχος απέτυχε για λόγο άσχετο με τα δεδομένα (δίκτυο, διακομιστής): η εξαγωγή δεν μπλοκάρεται. */
  | { readonly kind: 'unavailable' };

const LOADING: XChangePreviewState = { kind: 'loading' };

interface Settled {
  readonly key: string;
  readonly state: XChangePreviewState;
}

/** `priceListId === null` ⇒ η δημόσια τιμή καταλόγου. */
export function useXChangeExportPreview(priceListId: string | null) {
  // Σε ref: η ειδοποίηση αλλάζει ταυτότητα όταν φορτώνει μετάφραση, και αυτό δεν είναι λόγος για νέο προέλεγχο.
  const notify = useCatalogFailureNotice();
  const notifyFailure = useRef(notify);
  useEffect(() => { notifyFailure.current = notify; }, [notify]);
  const [settled, setSettled] = useState<Settled | null>(null);
  const key = priceListId ?? '';
  useEffect(() => {
    let current = true;
    const settle = (state: XChangePreviewState) => { if (current) setSettled({ key, state }); };
    fetchXChangeExportPreview(priceListId).then(
      (preview) => settle({ kind: 'ready', preview }),
      (cause: unknown) => {
        const failure = catalogFailureOf(cause);
        if (failure.issues.length > 0) return settle({ kind: 'refused', issues: failure.issues });
        if (current) notifyFailure.current(failure);
        return settle({ kind: 'unavailable' });
      },
    );
    return () => { current = false; };
  }, [key, priceListId]);
  return { state: settled?.key === key ? settled.state : LOADING };
}
