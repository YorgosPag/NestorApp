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
import type { AxisOptionsDialogProps } from './axis-options-props';
import type { LineAttributeToolsProps, PriceLineDialogProps, PriceLineNoteProps } from './line-tool-props';
import type { ImportSupplierFieldProps } from './supplier-field-props';

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
  /**
   * §5.5.2 Β5.2: ο προμηθευτής της παρτίδας και η μνήμη του — η αναζήτηση επαφών (υπηρεσία + κλειδιά επαφών) και ο διάλογος της
   * μνήμης μόνο όταν η παρτίδα είναι ανοιχτή παρτίδα ιδιοτήτων, ποτέ στο σφραγισμένο route slice.
   */
  CatalogImportSupplier: {
    load: () => import('./ImportSupplierField').then((mod) => ({ default: mod.ImportSupplierField })),
  },
  /**
   * §5.5.2 Β7: νέες τιμές άξονα από τον έλεγχο — βιβλιοθήκη ιδιοτήτων, φόρμα και `review.axis.*` μόνο όταν ο άνθρωπος ανοίξει το
   * πλαίσιο (σπάνια ενέργεια: μόνο σε εύρημα άξονα). Στατικά έφερνε το route slice της σελίδας στα 16042 bytes (ταβάνι 14797).
   */
  CatalogAxisOptions: {
    load: () => import('./AxisOptionsDialog').then((mod) => ({ default: mod.AxisOptionsDialog })),
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

export function ImportSupplierSlot(props: ImportSupplierFieldProps) {
  return <ImportSurfaces.CatalogImportSupplier {...props} />;
}

export function AxisOptionsDialogSlot(props: AxisOptionsDialogProps) {
  return <ImportSurfaces.CatalogAxisOptions {...props} />;
}
