'use client';

/**
 * =============================================================================
 * IKA Tab — Parent component for IKA/ΕΦΚΑ sub-tabs
 * =============================================================================
 *
 * Contains 6 sub-tabs:
 * 1. Εργατοτεχνίτες (Workers)
 * 2. Παρουσιολόγιο (Timesheet)
 * 3. Υπολογισμός Ενσήμων (Stamps Calculation)
 * 4. ΑΠΔ & Πληρωμές (APD & Payments)
 * 5. Αναγγελία Έργου (EFKA Declaration)
 * 6. Ρυθμίσεις ΕΦΚΑ (EFKA Settings — Insurance Classes Admin)
 *
 * Receives `project` prop from UniversalTabsRenderer.
 *
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers } from "@/components/ui/navigation/TabsComponents";
import { Users, Clock, Calculator, CreditCard, Landmark, Settings } from 'lucide-react';
import { WorkersTabContent } from './ika/WorkersTabContent';
import { TimesheetTabContent } from './ika/TimesheetTabContent';
import { StampsCalculationTabContent } from './ika/StampsCalculationTabContent';
import { ApdPaymentsTabContent } from './ika/ApdPaymentsTabContent';
import { EfkaDeclarationTabContent } from './ika/EfkaDeclarationTabContent';
import { LaborComplianceSettingsTabContent } from './ika/LaborComplianceSettingsTabContent';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

interface IkaTabProps {
  /** Project data passed from UniversalTabsRenderer */
  project?: { id: string; [key: string]: unknown };
  /** Alternative data prop from UniversalTabsRenderer */
  data?: { id: string; [key: string]: unknown };
}

export function IkaTab({ project, data }: IkaTabProps) {
  const { t } = useTranslation('projects');
  const spacing = useSpacingTokens();

  // Extract projectId from either prop
  const projectData = project ?? data;
  const projectId = projectData?.id;

  const ikaTabs = [
    {
      id: 'workers',
      label: t('ika.workers'),
      icon: Users,
      content: <WorkersTabContent projectId={projectId} />,
    },
    {
      id: 'efka-declaration',
      label: t('ika.efkaDeclaration'),
      icon: Landmark,
      content: <EfkaDeclarationTabContent projectId={projectId} />,
    },
    {
      id: 'timesheet',
      label: t('ika.timesheet'),
      icon: Clock,
      content: <TimesheetTabContent projectId={projectId} />,
    },
    {
      id: 'stamps-calculation',
      label: t('ika.stampsCalculation'),
      icon: Calculator,
      content: <StampsCalculationTabContent projectId={projectId} />,
    },
    {
      id: 'apd-payments',
      label: t('ika.apdPayments'),
      icon: CreditCard,
      content: <ApdPaymentsTabContent projectId={projectId} />,
    },
    {
      id: 'efka-settings',
      label: t('ika.efkaSettings'),
      icon: Settings,
      content: <LaborComplianceSettingsTabContent projectId={projectId} />,
    },
  ];

  return (
    <TabsOnlyTriggers
      tabs={ikaTabs}
      defaultTab="workers"
      theme="default"
    >
      {ikaTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className={cn(spacing.margin.top.xl, "overflow-x-auto")}>
          {tab.content}
        </TabsContent>
      ))}
    </TabsOnlyTriggers>
  );
}
