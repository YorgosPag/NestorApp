/**
 * @fileoverview ADR-915 §41.5 — **οι λέξεις μιας γραμμής** του μητρώου: όνομα εγγράφου · δήμος ακινήτου · «σε N ημέρες».
 * @related RegistryRowCells.tsx (πίνακας — πρώτο καρέ) · RegistryRowItem.tsx / RegistryGapItem.tsx (η κάρτα — στο πάνελ)
 * @module components/document-registry/registry-row-text
 *
 * 🔑 Ζουν **εδώ**, όχι μέσα στην κάρτα: ο πίνακας (πρώτο καρέ) και η κάρτα (κομμάτι κώδικα που φορτώνεται με το άνοιγμα
 *    του πάνελ) λένε το ίδιο όνομα με τον ΙΔΙΟ κανόνα — και ο πίνακας δεν σέρνει την κάρτα στην κλειστότητα (CHECK 3.34).
 * ⚠️ Κυριολεκτικά κλειδιά (`REGISTRY_KEYS.*`): ο γεννήτορας του route slice τα λύνει στατικά.
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { daysBetweenDateKeys } from '@/lib/calendar/date-key';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { REGISTRY_KEYS } from '@/components/document-registry/document-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];
type Names = Pick<DocumentRegistryResponse, 'files' | 'properties'>;

/**
 * Πώς λέγεται το έγγραφο: όνομα αρχείου · «δηλωμένο χωρίς αρχείο» (Α3) · «εγκρίθηκε στον έλεγχο» (Φ4δ Ε8 — το αρχείο,
 * αν υπάρχει, δεν διαβάστηκε από το μητρώο, άρα δεν έχει όνομα εδώ).
 */
export function documentNameOf(t: Translate, document: RegistryDocument, names: Names): string {
  switch (document.origin.kind) {
    case 'declared': return t(REGISTRY_KEYS.declared);
    case 'attested': return t(REGISTRY_KEYS.attested);
    case 'file': return names.files[document.origin.fileId]?.name ?? t(REGISTRY_KEYS.fileUnnamed);
  }
}

/** Ο δήμος του ακινήτου της γραμμής — `null` όταν δεν ρωτήθηκε ή δεν αποδεικνύεται (ADR-915 §24). */
export function areaIdOf(propertyId: string | null, names: Pick<DocumentRegistryResponse, 'properties'>): string | null {
  return propertyId === null ? null : names.properties[propertyId]?.areaId ?? null;
}

/** «σε 12 ημέρες» / «πριν από 3 ημέρες» — από το `asOf` της απόκρισης, ποτέ από το ρολόι. */
export function relativeText(t: Translate, expiresOn: string, asOf: string): string | null {
  const days = daysBetweenDateKeys(asOf, expiresOn);
  if (days === null) return null;
  return days >= 0 ? t(REGISTRY_KEYS.daysLeft, { count: days }) : t(REGISTRY_KEYS.daysAgo, { count: -days });
}
