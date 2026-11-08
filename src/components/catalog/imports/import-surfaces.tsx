'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** της σελίδας εισαγωγών (ADR-923 §5.5 · ADR-280 §11.8 Β4.1 · ADR-744 §27).
 * @module components/catalog/imports/import-surfaces
 *
 * 🔑 Η αναφορά ETIM xChange ζωγραφίζεται πίσω από το `defineLazySurfaces`, την ΙΔΙΑ μηχανή με τις διαδρομές: το chunk περιμένει
 *    τα κείμενά του (`awaitedNamespaces`), άρα δεν βγαίνει ποτέ ωμό κλειδί, και τα `xchange.*` δεν βαραίνουν το σφραγισμένο
 *    route slice της σελίδας (CHECK 3.34). Η αναφορά υπάρχει μόνο σε παρτίδα xChange, άρα δεν ανήκει στο πρώτο καρέ.
 * ⚠️ Το μητρώο δέχεται `ComponentType<any>`: η λεπτή πρόσοψη παρακάτω ξαναδίνει τον τύπο, ώστε ο καλών να μη χάνει τον έλεγχο
 *    των props. Λεπτό μητρώο: εισάγει μόνο το factory και τύπους.
 */

import type { XChangeImportReport } from '@/subapps/catalog/interop/etim/xchange-report';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';
import type { LineAttributeToolsProps } from './line-tool-props';

const ImportSurfaces = defineLazySurfaces({
  CatalogXChangeReport: {
    load: () => import('./XChangeReportNote').then((mod) => ({ default: mod.XChangeReportNote })),
  },
  /** §5.5.2 Β3: αντιστοίχιση γραμμής / νέα ιδιότητα — βιβλιοθήκη και φόρμα ιδιότητας μόνο όταν ο άνθρωπος ανοίξει ενέργεια. */
  CatalogLineAttributeTools: {
    load: () => import('./LineAttributeTools').then((mod) => ({ default: mod.LineAttributeTools })),
  },
});

export function XChangeReportSlot({ report }: { readonly report: XChangeImportReport }) {
  return <ImportSurfaces.CatalogXChangeReport report={report} />;
}

export function LineAttributeToolsSlot(props: LineAttributeToolsProps) {
  return <ImportSurfaces.CatalogLineAttributeTools {...props} />;
}
