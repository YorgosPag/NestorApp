/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Target, Users, TrendingUp, CheckCircle } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

import { PageHeader } from '@/core/headers';
import { PageContainer } from '@/core/containers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  AdvancedFiltersPanel,
  crmDashboardFiltersConfig,
  defaultCrmDashboardFilters,
  type CrmDashboardFilterState,
} from '@/components/core/AdvancedFilters';
import { PipelineTab } from '@/components/crm/dashboard/PipelineTab';
import { useOpportunities } from '@/components/crm/hooks/useOpportunities';

export default function CrmLeadsPage() {
  const { t } = useTranslation('crm');

  // Dashboard toggle
  const [showDashboard, setShowDashboard] = useState(false);

  // Advanced filters
  const [filters, setFilters] = useState<CrmDashboardFilterState>(defaultCrmDashboardFilters);

  // Opportunities data for stats
  const { opportunities } = useOpportunities();

  // Dashboard stats — computed from opportunities
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const total = opportunities.length;
    const active = opportunities.filter(o => o.status === 'active').length;
    const negotiation = opportunities.filter(o => o.stage === 'negotiation').length;
    const won = opportunities.filter(o => o.stage === 'closed_won').length;

    return [
      { title: t('leads.stats.totalLeads'), value: total, icon: Target, color: 'blue' as const },
      { title: t('leads.stats.activeLeads'), value: active, icon: Users, color: 'green' as const },
      { title: t('leads.stats.inNegotiation'), value: negotiation, icon: TrendingUp, color: 'orange' as const },
      { title: t('leads.stats.won'), value: won, icon: CheckCircle, color: 'purple' as const },
    ];
  }, [opportunities, t]);

  const handleDashboardToggle = useCallback(() => {
    setShowDashboard(prev => !prev);
  }, []);

  return (
    <PageContainer ariaLabel={t('leads.title')}>
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: Target,
          title: t('leads.title'),
          subtitle: t('leads.description'),
        }}
        actions={{
          showDashboard,
          onDashboardToggle: handleDashboardToggle,
        }}
      />

      {showDashboard && (
        <section role="region" aria-label={t('leads.stats.totalLeads')}>
          <UnifiedDashboard stats={dashboardStats} columns={4} />
        </section>
      )}

      <aside className="hidden md:block" role="complementary">
        <AdvancedFiltersPanel
          config={crmDashboardFiltersConfig}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </aside>

      <PipelineTab />
    </PageContainer>
  );
}
