// 🏢 ENTERPRISE: Refactored to use centralized systems — Salesforce/HubSpot pattern (2026-02-08)
// PageContainer + PageHeader + UnifiedDashboard + AdvancedFiltersPanel + Tabs
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, LayoutDashboard, Users, Target, Calendar, Clock } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized systems
import { PageContainer, ListContainer } from '@/core/containers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters';
import { crmDashboardFiltersConfig, defaultCrmDashboardFilters } from '@/components/core/AdvancedFilters/configs';
import type { CrmDashboardFilterState } from '@/components/core/AdvancedFilters/configs';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
// 🏢 ENTERPRISE: Direct imports
import { GenericCRMDashboardTabsRenderer } from '@/components/generic/GenericCRMDashboardTabsRenderer';
import { getSortedCRMDashboardTabs } from '@/config/crm-dashboard-tabs-config';
import { TelegramNotifications } from './TelegramNotifications';
import { useAuth } from '@/auth/contexts/AuthContext';
import { getOpportunitiesClient } from '@/services/opportunities-client.service';
import type { Opportunity } from '@/types/crm';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CRMDashboardPageContent');

export function CRMDashboardPageContent() {
  const layout = useLayoutClasses();
  const { t } = useTranslation('crm');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<CrmDashboardFilterState>(defaultCrmDashboardFilters);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const crmDashboardTabs = getSortedCRMDashboardTabs();

  // 🏢 ENTERPRISE: Fetch opportunities for global stats (Salesforce pattern)
  const fetchOpportunities = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingStats(true);
      const data = await getOpportunitiesClient();
      setOpportunities(data);
    } catch (error) {
      logger.error('Error fetching CRM stats', { error });
    } finally {
      setLoadingStats(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchOpportunities();
    }
  }, [authLoading, isAuthenticated, fetchOpportunities]);

  // 🏢 ENTERPRISE: Filtered opportunities based on global AdvancedFilters
  const filteredOpportunities = useMemo(() => {
    let list = [...opportunities];

    if (filters.stage !== 'all') {
      list = list.filter(opp => opp.stage === filters.stage);
    }
    if (filters.status !== 'all') {
      list = list.filter(opp => opp.status === filters.status);
    }
    if (filters.searchTerm) {
      const q = filters.searchTerm.toLowerCase();
      list = list.filter(opp =>
        opp.fullName?.toLowerCase().includes(q) ||
        opp.email?.toLowerCase().includes(q) ||
        opp.phone?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [opportunities, filters]);

  // 🏢 ENTERPRISE: Stats from filtered data (click-to-filter ready)
  const dashboardStats = useMemo<DashboardStat[]>(() => {
    const data = filteredOpportunities;
    const newLeads = data.filter(opp => opp.stage === 'initial_contact').length;
    const activeOpps = data.filter(opp =>
      ['qualification', 'viewing', 'proposal', 'negotiation'].includes(opp.stage)
    ).length;
    const viewings = data.filter(opp => opp.stage === 'viewing').length;
    const pendingTasks = data.filter(opp => opp.status === 'active').length;

    return [
      { title: t('overview.stats.newLeads'), value: loadingStats ? '...' : newLeads, icon: Users, color: 'blue' as const },
      { title: t('overview.stats.activeOpportunities'), value: loadingStats ? '...' : activeOpps, icon: Target, color: 'green' as const },
      { title: t('overview.stats.scheduledViewings'), value: loadingStats ? '...' : viewings, icon: Calendar, color: 'purple' as const },
      { title: t('overview.stats.pendingTasks'), value: loadingStats ? '...' : pendingTasks, icon: Clock, color: 'orange' as const }
    ];
  }, [filteredOpportunities, loadingStats, t]);

  return (
    <PageContainer ariaLabel={t('page.title')}>
      {/* 🏢 ENTERPRISE: Centralized PageHeader — Salesforce-style */}
      <PageHeader
        variant="sticky-rounded"
        layout="single-row"
        title={{
          icon: LayoutDashboard,
          title: t('page.title'),
          badge: <TelegramNotifications />
        }}
        actions={{
          addButton: {
            label: t('contactsTab.newContact'),
            onClick: () => { /* TODO: open create contact modal */ },
            icon: Plus
          }
        }}
      />

      {/* 🏢 ENTERPRISE: Global Stats — UnifiedDashboard (toggle with eye icon) */}
      <section className={layout.widthFull} aria-label={t('overview.stats.newLeads')}>
        <UnifiedDashboard
          stats={dashboardStats}
          columns={4}
          className={`${layout.dashboardPadding} overflow-hidden`}
        />
      </section>

      {/* 🏢 ENTERPRISE: Global Filters — AdvancedFiltersPanel (Salesforce/HubSpot pattern) */}
      <AdvancedFiltersPanel<CrmDashboardFilterState>
        config={crmDashboardFiltersConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultOpen={false}
        defaultFilters={defaultCrmDashboardFilters}
      />

      {/* 🏢 ENTERPRISE: Tab content with centralized ListContainer */}
      <ListContainer>
        <section className={`${layout.flexColGap4} flex-1 min-h-0`}>
          <GenericCRMDashboardTabsRenderer
            tabs={crmDashboardTabs}
            defaultTab="overview"
            selectedPeriod={filters.period !== 'all' ? filters.period : 'week'}
          />
        </section>
      </ListContainer>
    </PageContainer>
  );
}
