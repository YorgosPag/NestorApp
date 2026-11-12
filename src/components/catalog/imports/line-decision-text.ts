'use client';

/**
 * @fileoverview **Το κείμενο μιας απόφασης γραμμής** (ADR-923 §5.5.2 Β5.2): «→ Ψυκτική ισχύς», «Τιμή ανά τεμ.», «Αγνόηση». Ένα
 *   σημείο για τη λίστα αποφάσεων, τις υποδείξεις της μνήμης και τον διάλογο της μνήμης του προμηθευτή.
 * @module components/catalog/imports/line-decision-text
 *
 * 🔑 Η ιδιότητα ονομάζεται στη **γλώσσα περιεχομένου** του ανθρώπου (`useLocalizedTextReader`), με τον κωδικό ως εφεδρεία· ποτέ το id.
 * ⚠️ Όχι `useCatalogText`: φέρνει το namespace `catalog` στο route slice της σελίδας (ADR-744 §27). Ο ουδέτερος αναγνώστης αρκεί.
 * ⚠️ Η μονάδα τιμής φαίνεται ως κωδικός του μητρώου: το όνομά της θέλει το namespace `uom`, που ζει μόνο στην επιφάνεια τιμής.
 */

import { useCallback } from 'react';

import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { decisionAttributeIds } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportLineDecision } from '@/subapps/catalog/types/catalog-import';
import { useLocalizedTextReader } from '../shared/catalog-neutral-hooks';
import { useImportText } from './import-text';

/** Σύμβολο, όχι λέξη: ίδιο σε κάθε γλώσσα, όπως το « · » των κελιών. */
const TARGET_JOINER = ' + ';

export interface LineDecisionText {
  /** Το κείμενο της απόφασης. */
  readonly of: (decision: ImportLineDecision) => string;
  /** Η ιδιότητα υπάρχει ακόμη στη βιβλιοθήκη (όσο φορτώνει η βιβλιοθήκη, θεωρείται ότι υπάρχει). */
  readonly known: (decision: ImportLineDecision) => boolean;
}

export function useLineDecisionText(): LineDecisionText {
  const { t, uiLanguage } = useImportText();
  const { text } = useLocalizedTextReader(uiLanguage);
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  const of = useCallback((decision: ImportLineDecision): string => {
    if (decision.kind === 'ignore') return t('review.lineDecision.ignore');
    if (decision.kind === 'price') return t('review.lineDecision.price', { unit: decision.unitCode });
    const nameOf = (id: string): string => {
      const attribute = attributes.items.find((item) => item.id === id);
      return attribute ? text(attribute.labels) || attribute.code : id;
    };
    // §5.5.2 Β3 Γ13: μία γραμμή, περισσότερες ιδιότητες — όλες ονομάζονται, η κύρια πρώτη.
    const name = decisionAttributeIds(decision).map(nameOf).join(TARGET_JOINER);
    // §5.5.2 Β7: η γραμμή δίνει **και** τον άξονα — ό,τι άλλο έδινε μένει.
    return decision.kind === 'axis' ? t('review.lineDecision.axis', { attribute: name }) : name;
  }, [attributes.items, t, text]);
  // Μόνο βιβλιοθήκη που φορτώθηκε κρίνει «δεν υπάρχει»: φόρτωση ή αποτυχία δεν είναι απόδειξη απουσίας. Λείπει **μία** ⇒ δεν υπάρχει.
  const known = useCallback((decision: ImportLineDecision): boolean =>
    attributes.state !== 'ready' || decisionAttributeIds(decision).every((id) => attributes.items.some((item) => item.id === id)), [attributes.items, attributes.state]);
  return { of, known };
}
