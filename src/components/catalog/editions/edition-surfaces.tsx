'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** των εντύπων μέσα στην εφαρμογή (ADR-923 §5.15.3 · ADR-280 §11.8 Β4.1 · ADR-744 §27).
 * @module components/catalog/editions/edition-surfaces
 *
 * 🔑 Ο αναγνώστης (pdf.js + στρώσεις) και το ράφι του αγοραστή μοντάρονται **μόνο** από ενέργεια χρήστη — δεν ανήκουν στο πρώτο
 *    καρέ της «Εκδόσεις καταλόγου» ή των «Συνδέσεων». Πίσω από το `defineLazySurfaces` το chunk τους **περιμένει** τα κείμενά του
 *    (`public-catalog`), άρα κανένα ωμό κλειδί, και ούτε ο κώδικας του προβολέα ούτε τα `editions.*` βαραίνουν τα σφραγισμένα
 *    route slices των δύο σελίδων (CHECK 3.34).
 * ⚠️ Το μητρώο δέχεται `ComponentType<any>`: οι λεπτές προσόψεις παρακάτω ξαναδίνουν τον τύπο, ώστε ο καλών να μη χάνει τον
 *    έλεγχο των props. Λεπτό μητρώο: εισάγει μόνο το factory και τύπους.
 */

import type { CatalogEditionReaderDialogProps, SupplierEditionsDialogProps } from './edition-surface-props';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

const EditionSurfaces = defineLazySurfaces({
  CatalogEditionReaderDialog: {
    load: () => import('./CatalogEditionReaderDialog').then((mod) => ({ default: mod.CatalogEditionReaderDialog })),
  },
  SupplierEditionsDialog: {
    load: () => import('../supply/SupplierEditionsDialog').then((mod) => ({ default: mod.SupplierEditionsDialog })),
  },
});

/** Ο αναγνώστης εντύπου σε διάλογο (ιδιοκτήτης · αγοραστής). */
export function CatalogEditionReaderSlot(props: CatalogEditionReaderDialogProps) {
  return <EditionSurfaces.CatalogEditionReaderDialog {...props} />;
}

/** Τα έντυπα ενός προμηθευτή για τον αγοραστή. */
export function SupplierEditionsSlot(props: SupplierEditionsDialogProps) {
  return <EditionSurfaces.SupplierEditionsDialog {...props} />;
}
