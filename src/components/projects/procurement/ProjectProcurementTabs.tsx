'use client';

/**
 * @module components/projects/procurement/ProjectProcurementTabs
 * @enterprise ADR-330 §5.1 S2 — Project Procurement RouteTabs SSoT
 *
 * Renders the 4 sub-tab strip (Overview / RFQ / Quote / PO) inside
 * `/projects/[id]/procurement/*`. URL-driven via RouteTabs (ADR-328 D8).
 */

import { useMemo } from 'react';
import { BarChart3, Send, FileText, Package } from 'lucide-react';
import { RouteTabs } from '@/components/ui/navigation/route-tabs';
import type { TabsNavTab } from '@/components/ui/navigation/tabs-types';
import { getProjectProcurementUrl } from '@/lib/navigation/procurement-urls';

export interface ProjectProcurementTabsProps {
  projectId: string;
  className?: string;
}

export function ProjectProcurementTabs({
  projectId,
  className,
}: ProjectProcurementTabsProps) {
  const tabs = useMemo<readonly TabsNavTab[]>(
    () => [
      {
        href: getProjectProcurementUrl(projectId, 'overview'),
        labelKey: 'tabs.subtabs.procurement.overview',
        icon: BarChart3,
        iconColor: 'text-primary',
      },
      {
        href: getProjectProcurementUrl(projectId, 'rfq'),
        labelKey: 'tabs.subtabs.procurement.rfq',
        icon: Send,
        iconColor: 'text-foreground',
      },
      {
        href: getProjectProcurementUrl(projectId, 'quote'),
        labelKey: 'tabs.subtabs.procurement.quote',
        icon: FileText,
        iconColor: 'text-[hsl(var(--text-warning))]',
      },
      {
        href: getProjectProcurementUrl(projectId, 'po'),
        labelKey: 'tabs.subtabs.procurement.po',
        icon: Package,
        iconColor: 'text-[hsl(var(--text-warning))]',
      },
    ],
    [projectId],
  );

  return (
    <RouteTabs
      tabs={tabs}
      i18nNamespace="projects"
      ariaLabel="Project procurement sub-navigation"
      className={className}
    />
  );
}
