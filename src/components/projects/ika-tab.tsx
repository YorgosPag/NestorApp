'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers } from "@/components/ui/navigation/TabsComponents";
import { Users, Clock, Calculator, CreditCard } from 'lucide-react';
import { WorkersTabContent } from './ika/WorkersTabContent';
import { TimesheetTabContent } from './ika/TimesheetTabContent';
import { StampsCalculationTabContent } from './ika/StampsCalculationTabContent';
import { ApdPaymentsTabContent } from './ika/ApdPaymentsTabContent';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function IkaTab() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');

  const ikaTabs = [
    {
      id: 'workers',
      label: t('ika.workers'),
      icon: Users,
      content: <WorkersTabContent />,
    },
    {
      id: 'timesheet',
      label: t('ika.timesheet'),
      icon: Clock,
      content: <TimesheetTabContent />,
    },
    {
      id: 'stamps-calculation',
      label: t('ika.stampsCalculation'),
      icon: Calculator,
      content: <StampsCalculationTabContent />,
    },
    {
      id: 'apd-payments',
      label: t('ika.apdPayments'),
      icon: CreditCard,
      content: <ApdPaymentsTabContent />,
    }
  ];

  return (
    <TabsOnlyTriggers
      tabs={ikaTabs}
      defaultTab="workers"
      theme="default"
    >
      {ikaTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-8 overflow-x-auto">
          {tab.content}
        </TabsContent>
      ))}
    </TabsOnlyTriggers>
  );
}
