'use client';

import React from 'react';
import { TabsContent } from "@/components/ui/tabs";
import { TabsOnlyTriggers } from "@/components/ui/navigation/TabsComponents";
import { FileText, File } from 'lucide-react';
import { ContractsTabContent } from './documents/ContractsTabContent';
import { MiscellaneousTabContent } from './documents/MiscellaneousTabContent';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function DocumentsProjectTab() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');

  const documentTabs = [
    {
      id: 'contracts',
      label: t('documentsTab.contracts'),
      icon: FileText,
      content: <ContractsTabContent />,
    },
    {
      id: 'miscellaneous',
      label: t('documentsTab.miscellaneous'),
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
