'use client';

/**
 * **Η σελίδα κατηγορίας** (ADR-923 §5.13 Σ4): ίδια οθόνη με τη σελίδα προμηθευτή, με το δικό της route slice.
 *
 * @module components/public-catalog/SupplierCategoryView
 */

import React from 'react';

// ADR-744 §18: το route slice φτάνει στον φυλλομετρητή μόνο από client component, όχι από το `page.tsx`.
import routeSlice from '@/i18n/generated/routes/suppliers__alias__c__category.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { SupplierCatalogView, type SupplierCatalogViewProps } from './SupplierCatalogView';

registerRouteSlice(routeSlice);

export function SupplierCategoryView(props: SupplierCatalogViewProps): React.JSX.Element {
  return <SupplierCatalogView {...props} />;
}
