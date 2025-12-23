'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers } from "@/components/ui/navigation/TabsComponents";
import { Users, Clock, Calculator, CreditCard } from 'lucide-react';
import { WorkersTabContent } from './ika/WorkersTabContent';
import { TimesheetTabContent } from './ika/TimesheetTabContent';
import { StampsCalculationTabContent } from './ika/StampsCalculationTabContent';
import { ApdPaymentsTabContent } from './ika/ApdPaymentsTabContent';

export function IkaTab() {
  const ikaTabs = [
    {
      id: 'workers',
      label: 'Εργατοτεχνίτες',
      icon: Users,
      content: <WorkersTabContent />,
    },
    {
      id: 'timesheet',
      label: 'Παρουσιολόγιο',
      icon: Clock,
      content: <TimesheetTabContent />,
    },
    {
      id: 'stamps-calculation',
      label: 'Υπολογισμός Ενσήμων',
      icon: Calculator,
      content: <StampsCalculationTabContent />,
    },
    {
      id: 'apd-payments',
      label: 'ΑΠΔ & Πληρωμές',
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
