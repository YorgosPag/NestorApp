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

import { LayoutGrid, Users2, Layers, ScrollText, BarChart3, ClipboardList, FileText, Package, BookOpen, FileSignature } from 'lucide-react';
import { RouteTabs } from '@/components/ui/navigation/route-tabs';
import type { TabsNavTab } from '@/components/ui/navigation/tabs-types';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const PROCUREMENT_TABS: readonly TabsNavTab[] = [
  {
    href: '/procurement',
    labelKey: 'nav.hub',
    exactMatch: true,
    icon: LayoutGrid,
    iconColor: 'text-primary',
  },
  {
    href: '/procurement/rfqs',
    labelKey: 'nav.rfqs',
    icon: ClipboardList,
    iconColor: 'text-[hsl(var(--text-info))]',
  },
  {
    href: '/procurement/quotes',
    labelKey: 'nav.quotes',
    icon: FileText,
    iconColor: 'text-[hsl(var(--text-warning))]',
  },
  {
    href: '/procurement/purchase-orders',
    labelKey: 'nav.purchaseOrders',
    icon: Package,
    iconColor: 'text-primary',
  },
  {
    href: '/procurement/vendors',
    labelKey: 'nav.vendors',
    icon: Users2,
    iconColor: 'text-[hsl(var(--text-success))]',
  },
  {
    href: '/procurement/materials',
    labelKey: 'nav.materials',
    icon: Layers,
    iconColor: 'text-[hsl(var(--text-warning))]',
  },
  {
    href: '/procurement/agreements',
    labelKey: 'nav.agreements',
    icon: ScrollText,
    iconColor: 'text-foreground',
  },
  {
    // ADR-928 §5.24 — κύριες συμβάσεις υπεργολαβίας (της εταιρείας)· η βιβλιοθήκη κάτω από το ίδιο πρόθεμα είναι δική της καρτέλα.
    href: '/procurement/subcontracts',
    labelKey: 'nav.subcontractMasters',
    excludeStartsWith: ['/procurement/subcontracts/library'],
    icon: FileSignature,
    iconColor: 'text-foreground',
  },
  {
    // ADR-928 Φ3γ-0 — βιβλιοθήκη ρητρών/προτύπων υπεργολαβίας: ανάγνωση για κάθε εσωτερικό μέλος, πράξεις με δικαίωμα.
    href: '/procurement/subcontracts/library',
    labelKey: 'nav.subcontractLibrary',
    icon: BookOpen,
    iconColor: 'text-[hsl(var(--text-info))]',
  },
  {
    href: '/procurement/analytics',
    labelKey: 'nav.analytics',
    icon: BarChart3,
    iconColor: 'text-destructive',
  },
] as const;

export interface ProcurementSubNavProps {
  className?: string;
}

export function ProcurementSubNav({ className }: ProcurementSubNavProps = {}) {
  const { t } = useTranslation('procurement');
  return (
    <RouteTabs
      tabs={PROCUREMENT_TABS}
      i18nNamespace="procurement"
      ariaLabel={t('nav.ariaLabel')}
      className={className}
    />
  );
}
