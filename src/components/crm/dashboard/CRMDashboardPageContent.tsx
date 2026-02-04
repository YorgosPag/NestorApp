'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
import { GenericCRMDashboardTabsRenderer } from '@/components/generic/GenericCRMDashboardTabsRenderer';
import { GenericPeriodSelector } from '@/components/generic/GenericPeriodSelector';
import { getSortedCRMDashboardTabs } from '@/config/crm-dashboard-tabs-config';
import { getSortedPeriods } from '@/config/period-selector-config';
import { TelegramNotifications } from './TelegramNotifications';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function CRMDashboardPageContent() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('crm');

  // Get CRM Dashboard tabs from centralized config
  const crmDashboardTabs = getSortedCRMDashboardTabs();

  // Get periods from centralized config
  const periods = getSortedPeriods();

  return (
    <main className={`min-h-screen ${colors.bg.secondary}`}>
      {/* Header */}
      <header className={`${colors.bg.primary} shadow-sm border-b`}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className={`text-2xl font-bold ${colors.text.foreground}`}>{t('page.title')}</h1>
            <nav className="flex items-center space-x-3" aria-label="Dashboard controls">
              <TelegramNotifications />
              <GenericPeriodSelector
                periods={periods}
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                theme="compact"
              />
              <button className={`px-4 py-2 ${colors.text.inverted} rounded-lg flex items-center gap-2 ${colors.bg.gradient} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}>
                <Plus className={iconSizes.sm} />
                {t('contactsTab.newContact')}
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
