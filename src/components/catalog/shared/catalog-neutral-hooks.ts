/**
 * Τα hooks του καταλόγου που **δεν ζητούν namespace**: δικαίωμα και επίλυση πολύγλωσσων δεδομένων.
 *
 * Χωριστό αρχείο επειδή τα χρειάζονται και επιφάνειες έξω από τον κατάλογο (BOQ στη σελίδα κτιρίου).
 * Αν ζούσαν δίπλα στο `useCatalogText`, η εισαγωγή τους θα φόρτωνε το `catalog` εκεί (CHECK 3.34).
 *
 * @module components/catalog/shared/catalog-neutral-hooks
 */

import { useCallback } from 'react';

import { useCapability } from '@/auth/hooks/useCapability';
import { resolveHumanLanguage } from '@/i18n/languages';
import { resolveLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { isGranted } from '@/types/capability-authority';
import { CATALOG_AUTHORITY_PERMISSIONS, type CatalogAuthority } from '@/subapps/catalog/vocabulary/catalog-authorities';

/** Επίλυση πολύγλωσσων δεδομένων στη γλώσσα του UI που δίνει ο καλών. */
export function useLocalizedTextReader(uiLanguage: string) {
  const language = resolveHumanLanguage(uiLanguage);
  const text = useCallback(
    (value: LocalizedText | undefined, fallback = '') => resolveLocalizedText(value, language) || fallback,
    [language],
  );
  return { text, language };
}

/**
 * Η ετυμηγορία **τριών** καταστάσεων: `pending` (η ταυτότητα δεν έφτασε ακόμη) · `granted` · `denied`.
 * Ζωντανά (ADR-923 §5.10.5): το boolean έχανε το `pending`.
 */
export function useCatalogAccess(authority: CatalogAuthority): 'pending' | 'granted' | 'denied' {
  const gate = useCapability(CATALOG_AUTHORITY_PERMISSIONS[authority]);
  if (gate.pending) return 'pending';
  return isGranted(gate.verdict) ? 'granted' : 'denied';
}
