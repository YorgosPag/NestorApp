'use client';

/**
 * ProcurementSubNav — wrapper sopra TabsNav SSoT
 *
 * Sub-navigation tra Παραγγελίες e Προσφορές nel dominio Procurement.
 *
 * @see ADR-267 §Phase F — Sub-nav SSoT extraction
 */

import { TabsNav, type TabsNavTab } from '@/components/shared/TabsNav';

const PROCUREMENT_TABS: readonly TabsNavTab[] = [
  {
    href: '/procurement',
    labelKey: 'nav.purchaseOrders',
    exactMatch: true,
  },
  {
    href: '/procurement/quotes',
    labelKey: 'nav.quotes',
    excludeStartsWith: ['/procurement/quotes/scan'],
  },
] as const;

export function ProcurementSubNav() {
  return (
    <TabsNav
      tabs={PROCUREMENT_TABS}
      i18nNamespace="procurement"
      ariaLabel="Procurement sub-navigation"
    />
  );
}
