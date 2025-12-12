'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { GenericCRMDashboardTabsRenderer, GenericPeriodSelector } from '@/components/generic';
import { getSortedCRMDashboardTabs } from '@/config/crm-dashboard-tabs-config';
import { getSortedPeriods } from '@/config/period-selector-config';
import { TelegramNotifications } from './TelegramNotifications';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

export function CRMDashboardPageContent() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  // Get CRM Dashboard tabs from centralized config
  const crmDashboardTabs = getSortedCRMDashboardTabs();

  // Get periods from centralized config
  const periods = getSortedPeriods();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-card shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">CRM Dashboard</h1>
            <nav className="flex items-center space-x-3" aria-label="Dashboard controls">
              <TelegramNotifications />
              <GenericPeriodSelector
                periods={periods}
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                theme="compact"
              />
              <button className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}>
                <Plus className="w-4 h-4" />
                Νέα Επαφή
              </button>
            </nav>
          </div>

          {/* Tabs */}
          <section className="mt-8" aria-label="Dashboard tabs">
            <GenericCRMDashboardTabsRenderer
              tabs={crmDashboardTabs}
              defaultTab="overview"
              selectedPeriod={selectedPeriod}
            />
          </section>
        </div>
      </header>

      {/* Content is now handled by GenericCRMDashboardTabsRenderer */}
    </main>
  );
}