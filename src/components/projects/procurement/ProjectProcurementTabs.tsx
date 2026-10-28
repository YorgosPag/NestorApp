'use client';

/**
 * @module components/projects/procurement/ProjectProcurementTabs
 * @enterprise ADR-330 §5.1 S2 — Project Procurement RouteTabs SSoT
 *
 * Renders the 5 sub-tab strip (Overview / RFQ / Quote / PO / Coverage — ADR-330 §5.1 S3.2) inside
 * `/projects/[id]/procurement/*`. URL-driven via RouteTabs (ADR-328 D8).
 */

import { useMemo } from 'react';
import { BarChart3, Send, FileText, Package, ListChecks } from 'lucide-react';
import { RouteTabs } from '@/components/ui/navigation/route-tabs';
import type { TabsNavTab } from '@/components/ui/navigation/tabs-types';
import {
  getProjectProcurementUrl,
  type ProjectProcurementSection,
} from '@/lib/navigation/procurement-urls';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * 🔑 ΣΕ ΕΠΙΠΕΔΟ MODULE, ΟΧΙ ΜΕΣΑ ΣΤΟ `useMemo` (ADR-327 · ADR-744 §18). Αυτό το αρχείο το αποδίδει
 * **layout** ⇒ ρίζα κελύφους, και ο generator του slice λύνει το `t(tab.labelKey)` του `RouteTabs` από τα
 * literals δηλώσεων **module** (`harvestPropertyValues`). Όσο οι καρτέλες ζούσαν μέσα στη συνάρτηση, τα
 * `tabs.subtabs.procurement.*` έλειπαν από το slice και ο server έβαφε ωμό κλειδί ⇒ hydration mismatch.
 */
const PROCUREMENT_SUBTABS: ReadonlyArray<
  Omit<TabsNavTab, 'href'> & { readonly section: ProjectProcurementSection }
> = [
  { section: 'overview', labelKey: 'tabs.subtabs.procurement.overview', icon: BarChart3, iconColor: 'text-primary' },
  { section: 'rfq', labelKey: 'tabs.subtabs.procurement.rfq', icon: Send, iconColor: 'text-foreground' },
  { section: 'quote', labelKey: 'tabs.subtabs.procurement.quote', icon: FileText, iconColor: 'text-[hsl(var(--text-warning))]' },
  { section: 'po', labelKey: 'tabs.subtabs.procurement.po', icon: Package, iconColor: 'text-[hsl(var(--text-warning))]' },
  { section: 'coverage', labelKey: 'tabs.subtabs.procurement.coverage', icon: ListChecks, iconColor: 'text-foreground' },
];

export interface ProjectProcurementTabsProps {
  projectId: string;
  className?: string;
}

export function ProjectProcurementTabs({
  projectId,
  className,
}: ProjectProcurementTabsProps) {
  const { t } = useTranslation('projects');
  const tabs = useMemo<readonly TabsNavTab[]>(
    () => PROCUREMENT_SUBTABS.map(({ section, ...tab }) => ({
      ...tab,
      href: getProjectProcurementUrl(projectId, section),
    })),
    [projectId],
  );

  return (
    <RouteTabs
      tabs={tabs}
      i18nNamespace="projects"
      ariaLabel={t('tabs.subtabs.procurement.navLabel')}
      className={className}
    />
  );
}
