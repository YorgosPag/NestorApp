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
import type { LineAttributeToolsProps, PriceLineDialogProps, PriceLineNoteProps } from './line-tool-props';

const ImportSurfaces = defineLazySurfaces({
  CatalogXChangeReport: {
    load: () => import('./XChangeReportNote').then((mod) => ({ default: mod.XChangeReportNote })),
  },
  /** §5.5.2 Β3: αντιστοίχιση γραμμής / νέα ιδιότητα — βιβλιοθήκη και φόρμα ιδιότητας μόνο όταν ο άνθρωπος ανοίξει ενέργεια. */
  CatalogLineAttributeTools: {
    load: () => import('./LineAttributeTools').then((mod) => ({ default: mod.LineAttributeTools })),
  },
  /**
   * §5.5.2 Β4: η γραμμή τιμής — ο επιλογέας μονάδας (namespace `uom`) μόνο όταν υπάρχει γραμμή τιμής ή ανοίξει ο διάλογος. ΜΙΑ
   * επιφάνεια για διάλογο και σημείωση: ένα ζεύγος (διαδρομή, namespace), όχι δύο.
   */
  CatalogPriceLineTools: {
    load: () => import('./PriceLineControls').then((mod) => ({ default: mod.PriceLineTools })),
  },
});

export function XChangeReportSlot({ report }: { readonly report: XChangeImportReport }) {
  return <ImportSurfaces.CatalogXChangeReport report={report} />;
}

export function LineAttributeToolsSlot(props: LineAttributeToolsProps) {
  return <ImportSurfaces.CatalogLineAttributeTools {...props} />;
}

export function PriceLineDialogSlot(props: PriceLineDialogProps) {
  return <ImportSurfaces.CatalogPriceLineTools kind="dialog" {...props} />;
}

export function PriceLineNoteSlot(props: PriceLineNoteProps) {
  return <ImportSurfaces.CatalogPriceLineTools kind="note" {...props} />;
}
