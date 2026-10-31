'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** των πωλήσεων (ADR-280 §11.8 Β4.3 · ADR-744 §33.4).
 * @module components/sales/sales-surfaces
 *
 * Ο διάλογος κράτησης φτάνει την ιεραρχία έργου/ορόφων του DXF (`ProjectHierarchyContext`, `LevelsSystem`), άρα
 * ονομάζει την οικογένεια `dxf-viewer`. Με τοπικό `dynamic()` το chunk του **δεν περίμενε** τα κείμενά του — μόλις το
 * `dxf-viewer` βγει από την εκκίνηση (Β5) θα ζωγράφιζε ωμά κλειδιά. Εδώ περνά από την ΙΔΙΑ μηχανή με τις διαδρομές.
 *
 * Λεπτό μητρώο **ανά τομέα**: εισάγει μόνο το factory, άρα δεν προσθέτει τίποτα στη στατική κλειστότητα του εισαγωγέα.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

export const SalesSurfaces = defineLazySurfaces({
  SalesReserveDialog: {
    load: () => import('@/components/sales/dialogs/ReserveDialog').then(mod => ({ default: mod.ReserveDialog })),
  },
});
