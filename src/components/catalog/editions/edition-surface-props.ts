/**
 * @fileoverview Τα props των τεμπέλικων επιφανειών εντύπων (ADR-923 §5.15.3) — **μόνο τύποι**, ώστε το μητρώο
 *   (`edition-surfaces.tsx`) να μη φτάνει, ούτε μέσω `import type`, στα modules που φέρνουν κείμενα και τον προβολέα: ο γράφος του
 *   γεννήτορα i18n τα ακολουθεί, και τότε η επιφάνεια θα έπαυε να είναι όριο (CHECK 3.34).
 * @module components/catalog/editions/edition-surface-props
 */

import type { IssuePdfLicense } from '@/components/file-manager/pdf-range-transport';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';

export interface CatalogEditionReaderDialogProps {
  /** Το έντυπο που άνοιξε ο άνθρωπος. */
  readonly edition: CatalogEditionView;
  /** Όλα όσα βλέπει ο θεατής — από εδώ βρίσκεται το ισχύον του ίδιου ραφιού. */
  readonly editions: readonly CatalogEditionView[];
  readonly issueOf: (editionId: string) => IssuePdfLicense;
  readonly onClose: () => void;
}

export interface SupplierEditionsDialogProps {
  readonly relationshipId: string;
  readonly supplierName: string;
  readonly onClose: () => void;
}
