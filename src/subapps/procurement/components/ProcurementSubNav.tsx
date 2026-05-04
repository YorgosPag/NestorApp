'use client';

/**
 * ProcurementSubNav — direct consumer of `RouteTabs` (ADR-328 Phase I L4).
 *
 * Sub-navigation for the Procurement Hub top-level section.
 * Tabs: Hub (landing) | Vendors | Materials | Agreements | Analytics.
 * Vendors/Materials/Agreements/Analytics are "coming soon" placeholder pages.
 *
 * @see ADR-330 §1.C — Top-level Hub redesign (S5)
 * @see ADR-328 §RouteTabs API
 */

import { LayoutGrid, Users2, Layers, ScrollText, BarChart3, ClipboardList, FileText, Package } from 'lucide-react';
import { RouteTabs } from '@/components/ui/navigation/route-tabs';
import type { TabsNavTab } from '@/components/ui/navigation/tabs-types';

const PROCUREMENT_TABS: readonly TabsNavTab[] = [
  {
    href: '/procurement',
    labelKey: 'nav.hub',
    exactMatch: true,
    icon: LayoutGrid,
    iconColor: 'text-blue-600',
  },
  {
    href: '/procurement/rfqs',
    labelKey: 'nav.rfqs',
    icon: ClipboardList,
    iconColor: 'text-teal-600',
  },
  {
    href: '/procurement/quotes',
    labelKey: 'nav.quotes',
    icon: FileText,
    iconColor: 'text-orange-600',
  },
  {
    href: '/procurement/purchase-orders',
    labelKey: 'nav.purchaseOrders',
    icon: Package,
    iconColor: 'text-indigo-600',
  },
  {
    href: '/procurement/vendors',
    labelKey: 'nav.vendors',
    icon: Users2,
    iconColor: 'text-green-600',
  },
  {
    href: '/procurement/materials',
    labelKey: 'nav.materials',
    icon: Layers,
    iconColor: 'text-yellow-600',
  },
  {
    href: '/procurement/agreements',
    labelKey: 'nav.agreements',
    icon: ScrollText,
    iconColor: 'text-purple-600',
  },
  {
    href: '/procurement/analytics',
    labelKey: 'nav.analytics',
    icon: BarChart3,
    iconColor: 'text-red-600',
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
