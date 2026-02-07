'use client';

import { useEffect, useState } from 'react';
import { Users, Target, Calendar, Clock } from 'lucide-react';
import { RecentActivities } from './RecentActivities';
import { QuickActions } from './QuickActions';
import { TeamPerformance } from './TeamPerformance';
import { getOpportunitiesClient } from '@/services/opportunities-client.service';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { useTranslation } from '@/i18n';
import type { Opportunity } from '@/types/crm';

export function OverviewTab() {
  const { t, isNamespaceReady } = useTranslation('crm');
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStat[]>([]);

  useEffect(() => {
    if (!isNamespaceReady) return;

    const fetchStats = async () => {
      try {
        const opportunities = await getOpportunitiesClient();

        const newLeads = opportunities.filter(opp => opp.stage === 'initial_contact').length;
        const activeOpportunities = opportunities.filter(opp => ['qualification', 'viewing', 'proposal', 'negotiation'].includes(opp.stage)).length;
        const viewings = opportunities.filter(opp => opp.stage === 'viewing').length;
        const pendingTasks = opportunities.filter(opp => opp.status === 'active').length;

        setDashboardStats([
          {
            title: t('overview.stats.newLeads'),
            value: newLeads.toString(),
            icon: Users,
            color: 'blue',
          },
          {
            title: t('overview.stats.activeOpportunities'),
            value: activeOpportunities.toString(),
            icon: Target,
            color: 'green',
          },
          {
            title: t('overview.stats.scheduledViewings'),
            value: viewings.toString(),
            icon: Calendar,
            color: 'purple',
          },
          {
            title: t('overview.stats.pendingTasks'),
            value: pendingTasks.toString(),
            icon: Clock,
            color: 'orange',
          },
        ]);
      } catch (error) {
        console.error("Failed to fetch opportunities stats:", error);
        setDashboardStats([
          { title: t('overview.stats.newLeads'), value: t('common:status.unknown'), icon: Users, color: 'blue' },
          { title: t('overview.stats.activeOpportunities'), value: t('common:status.unknown'), icon: Target, color: 'green' },
          { title: t('overview.stats.scheduledViewings'), value: t('common:status.unknown'), icon: Calendar, color: 'purple' },
          { title: t('overview.stats.pendingTasks'), value: t('common:status.unknown'), icon: Clock, color: 'orange' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isNamespaceReady, t]);

  // Build loading stats for initial render
  const loadingStats: DashboardStat[] = [
    { title: 'New Leads', value: '0', icon: Users, color: 'blue', loading: true },
    { title: 'Active Opportunities', value: '0', icon: Target, color: 'green', loading: true },
    { title: 'Scheduled Viewings', value: '0', icon: Calendar, color: 'purple', loading: true },
    { title: 'Pending Tasks', value: '0', icon: Clock, color: 'orange', loading: true },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid — 🏢 ENTERPRISE: Centralized UnifiedDashboard */}
      <UnifiedDashboard
        stats={loading ? loadingStats : dashboardStats}
        columns={4}
        className=""
      />

      {/* Recent Activities & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivities />
        <QuickActions />
      </div>

      {/* Team Performance */}
      <TeamPerformance />
    </div>
  );
}
