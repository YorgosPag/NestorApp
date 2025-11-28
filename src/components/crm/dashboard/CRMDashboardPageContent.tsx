'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { GenericCRMDashboardTabsRenderer } from '@/components/generic';
import { getSortedCRMDashboardTabs } from '@/config/crm-dashboard-tabs-config';
import { PeriodSelector } from './PeriodSelector';
import { TelegramNotifications } from './TelegramNotifications';

export function CRMDashboardPageContent() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  // Get CRM Dashboard tabs from centralized config
  const crmDashboardTabs = getSortedCRMDashboardTabs();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-card shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">CRM Dashboard</h1>
            <div className="flex items-center space-x-3">
              <TelegramNotifications />
              <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Νέα Επαφή
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8">
            <GenericCRMDashboardTabsRenderer
              tabs={crmDashboardTabs}
              defaultTab="overview"
              selectedPeriod={selectedPeriod}
            />
          </div>
        </div>
      </div>

      {/* Content is now handled by GenericCRMDashboardTabsRenderer */}
    </div>
  );
}