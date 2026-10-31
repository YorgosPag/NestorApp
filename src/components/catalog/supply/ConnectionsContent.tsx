'use client';

/**
 * @fileoverview **Η σελίδα «Συνδέσεις»** (ADR-923 §5.12): οι πελάτες μου · οι προμηθευτές μου. Ένας χώρος μπορεί να είναι και
 *   τα δύο, άρα μία σελίδα με δύο καρτέλες, κάθε μία με τη δική της όψη από τον διακομιστή.
 * @related CustomersPanel.tsx · SuppliersPanel.tsx · hooks/catalog/useSupplyViews.ts
 * @module components/catalog/supply/ConnectionsContent
 *
 * 🔑 Η καρτέλα ζει στη διεύθυνση (`?tab=suppliers`), ώστε ο σύνδεσμος να ανοίγει ακριβώς εκεί.
 */

import React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { useCatalogSelection } from '../shared/use-catalog-selection';
import { CustomersPanel } from './CustomersPanel';
import { SuppliersPanel } from './SuppliersPanel';

// 🔴 ADR-744 §18 — το `catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/o__workspace__catalog__connections.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const SUPPLIERS_TAB = 'suppliers';
const CUSTOMERS_TAB = 'customers';

export function ConnectionsContent() {
  const { t } = useCatalogText();
  const selection = useCatalogSelection('tab');
  const tab = selection.selected === SUPPLIERS_TAB ? SUPPLIERS_TAB : CUSTOMERS_TAB;
  return (
    <CatalogPageFrame title={t('supply.page.title')} lead={t('supply.page.lead')} state="ready">
      <Tabs value={tab} onValueChange={(next) => selection.select(next === CUSTOMERS_TAB ? null : next)} className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList className="self-start">
          <TabsTrigger value={CUSTOMERS_TAB}>{t('supply.page.customers')}</TabsTrigger>
          <TabsTrigger value={SUPPLIERS_TAB}>{t('supply.page.suppliers')}</TabsTrigger>
        </TabsList>
        <TabsContent value={CUSTOMERS_TAB} className="mt-0 min-h-0 flex-1"><CustomersPanel /></TabsContent>
        <TabsContent value={SUPPLIERS_TAB} className="mt-0 min-h-0 flex-1"><SuppliersPanel /></TabsContent>
      </Tabs>
    </CatalogPageFrame>
  );
}
