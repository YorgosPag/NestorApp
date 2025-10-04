'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkersTabContent } from './ika/WorkersTabContent';
import { TimesheetTabContent } from './ika/TimesheetTabContent';
import { StampsCalculationTabContent } from './ika/StampsCalculationTabContent';
import { ApdPaymentsTabContent } from './ika/ApdPaymentsTabContent';

export function IkaTab() {
  return (
    <Tabs defaultValue="workers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="workers">Εργατοτεχνίτες</TabsTrigger>
            <TabsTrigger value="timesheet">Παρουσιολόγιο</TabsTrigger>
            <TabsTrigger value="stamps-calculation">Υπολογισμός Ενσήμων</TabsTrigger>
            <TabsTrigger value="apd-payments">ΑΠΔ & Πληρωμές</TabsTrigger>
        </TabsList>
        <TabsContent value="workers" className="pt-4">
           <WorkersTabContent />
        </TabsContent>
        <TabsContent value="timesheet" className="pt-4">
           <TimesheetTabContent />
        </TabsContent>
        <TabsContent value="stamps-calculation" className="pt-4">
           <StampsCalculationTabContent />
        </TabsContent>
        <TabsContent value="apd-payments" className="pt-4">
           <ApdPaymentsTabContent />
        </TabsContent>
    </Tabs>
  );
}
