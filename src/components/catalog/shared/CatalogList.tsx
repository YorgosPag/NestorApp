'use client';

/**
 * @fileoverview **Τα στοιχεία των λιστών του καταλόγου** — ενότητα με τίτλο και γραμμή που επιλέγεται (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/CatalogList
 *
 * 🔑 Λεπτό περιτύλιγμα του ουδέτερου `components/shared/lists/SelectableList` (ADR-928 Φ3γ-0): δίνει μόνο τη λέξη
 *    «Αποθήκευση…» από το namespace του καταλόγου. Η γραμμή είναι κουμπί με `aria-current`· η εκκρεμής αποθήκευση
 *    φαίνεται με λέξη, όχι μόνο με χρώμα.
 */

import {
  SelectableListItem,
  SelectableListSection,
  type SelectableListBadge,
  type SelectableListItemProps,
} from '@/components/shared/lists/SelectableList';
import { useCatalogText } from './catalog-ui-hooks';

export const CatalogListSection = SelectableListSection;

export type CatalogListBadge = SelectableListBadge;

interface CatalogListItemProps extends Omit<SelectableListItemProps, 'pendingLabel'> {
  readonly pending?: boolean;
}

export function CatalogListItem({ pending = false, ...props }: CatalogListItemProps) {
  const { t } = useCatalogText();
  return <SelectableListItem {...props} pendingLabel={pending ? t('common.saving') : undefined} />;
}
