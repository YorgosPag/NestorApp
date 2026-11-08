'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** της ανταλλαγής ETIM xChange (ADR-934 Σ1γ · ADR-280 §11.8 Β4.1 · ADR-744 §27).
 * @module components/catalog/interop/interop-surfaces
 *
 * 🔑 Η αναφορά εξαγωγής ζωγραφίζεται πίσω από το `defineLazySurfaces`, την ΙΔΙΑ μηχανή με τις διαδρομές: το chunk περιμένει
 *    τα κείμενά του (`awaitedNamespaces`), άρα δεν βγαίνει ποτέ ωμό κλειδί, και τα `xchangeExport.report.*` δεν βαραίνουν το
 *    σφραγισμένο route slice της «Εκδόσεις» (CHECK 3.34). Η αναφορά υπάρχει μόνο αφού κατέβει το αρχείο, άρα δεν ανήκει στο
 *    πρώτο καρέ. Ίδιο σχήμα με το `imports/import-surfaces.tsx` (η αναφορά της εισαγωγής).
 * ⚠️ Το μητρώο δέχεται `ComponentType<any>`: η λεπτή πρόσοψη παρακάτω ξαναδίνει τον τύπο, ώστε ο καλών να μη χάνει τον έλεγχο
 *    των props. Λεπτό μητρώο: εισάγει μόνο το factory και τύπους.
 */

import type { XChangeExportSummary } from '@/subapps/catalog/types/xchange-export';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

const InteropSurfaces = defineLazySurfaces({
  CatalogXChangeExportReport: {
    load: () => import('./XChangeExportReport').then((mod) => ({ default: mod.XChangeExportReport })),
  },
});

export function XChangeExportReportSlot({ summary }: { readonly summary: XChangeExportSummary }) {
  return <InteropSurfaces.CatalogXChangeExportReport summary={summary} />;
}
