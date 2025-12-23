'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers } from "@/components/ui/navigation/TabsComponents";
import { FileText, File } from 'lucide-react';
import { ContractsTabContent } from './documents/ContractsTabContent';
import { MiscellaneousTabContent } from './documents/MiscellaneousTabContent';

export function DocumentsProjectTab() {
  const documentTabs = [
    {
      id: 'contracts',
      label: 'Συμβόλαια',
      icon: FileText,
      content: <ContractsTabContent />,
    },
    {
      id: 'miscellaneous',
      label: 'Διάφορα Έγγραφα',
      icon: File,
      content: <MiscellaneousTabContent />,
    }
  ];

  return (
    <TabsOnlyTriggers
      tabs={documentTabs}
      defaultTab="contracts"
      theme="default"
    >
      {documentTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-8 overflow-x-auto">
          {tab.content}
        </TabsContent>
      ))}
    </TabsOnlyTriggers>
  );
}
