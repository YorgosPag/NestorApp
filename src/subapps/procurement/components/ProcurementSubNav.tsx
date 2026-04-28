'use client';

/**
 * ProcurementSubNav — direct consumer of `RouteTabs` (ADR-328 Phase I L4).
 *
 * Sub-navigation between Παραγγελίες and Προσφορές in the Procurement domain.
 * Migrated from `TabsNav variant="radix"` to `RouteTabs` direct as the canonical
 * pattern for new sub-nav consumers.
 *
 * @see ADR-267 §Phase F — Sub-nav SSoT extraction
 * @see ADR-328 §RouteTabs API
 */

import { Package, FileText } from 'lucide-react';
import { RouteTabs } from '@/components/ui/navigation/route-tabs';
import type { TabsNavTab } from '@/components/ui/navigation/tabs-types';

const PROCUREMENT_TABS: readonly TabsNavTab[] = [
  {
    href: '/procurement',
    labelKey: 'nav.purchaseOrders',
    exactMatch: true,
    icon: Package,
    iconColor: 'text-orange-600',
  },
  {
    href: '/procurement/quotes',
    labelKey: 'nav.quotes',
    excludeStartsWith: ['/procurement/quotes/scan'],
    icon: FileText,
    iconColor: 'text-amber-600',
  },
] as const;

export interface ProcurementSubNavProps {
  className?: string;
}

export function ProcurementSubNav({ className }: ProcurementSubNavProps = {}) {
  return (
    <RouteTabs
      tabs={PROCUREMENT_TABS}
      i18nNamespace="procurement"
      ariaLabel="Procurement sub-navigation"
      className={className}
    />
  );
}
