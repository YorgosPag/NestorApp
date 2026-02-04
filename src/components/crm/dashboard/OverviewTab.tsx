'use client';

import { useEffect, useState } from 'react';
import { Users, Target, Calendar, Clock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { RecentActivities } from './RecentActivities';
import { QuickActions } from './QuickActions';
import { TeamPerformance } from './TeamPerformance';
import { getOpportunitiesClient } from '@/services/opportunities-client.service';
import { useTranslation } from '@/i18n';
import type { Opportunity } from '@/types/crm';

export function OverviewTab() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t, isNamespaceReady } = useTranslation('crm');

  const [stats, setStats] = useState(() => ([
    { label: 'overview.stats.newLeads', value: '0', icon: Users, color: 'blue', loading: true },
    { label: 'overview.stats.activeOpportunities', value: '0', icon: Target, color: 'green', loading: true },
    { label: 'overview.stats.scheduledViewings', value: '0', icon: Calendar, color: 'purple', loading: true },
    { label: 'overview.stats.pendingTasks', value: '0', icon: Clock, color: 'orange', loading: true }
  ]));

  useEffect(() => {
    if (!isNamespaceReady) return;

    const fetchStats = async () => {
      try {
        const opportunities = await getOpportunitiesClient();
        
        const newLeads = opportunities.filter(opp => opp.stage === 'initial_contact').length;
        const activeOpportunities = opportunities.filter(opp => ['qualification', 'viewing', 'proposal', 'negotiation'].includes(opp.stage)).length;
        const viewings = opportunities.filter(opp => opp.stage === 'viewing').length;
        const pendingTasks = opportunities.filter(opp => opp.status === 'active').length; // Placeholder logic for tasks

        setStats([
          { label: t('overview.stats.newLeads'), value: newLeads.toString(), icon: Users, color: 'blue', loading: false },
          { label: t('overview.stats.activeOpportunities'), value: activeOpportunities.toString(), icon: Target, color: 'green', loading: false },
          { label: t('overview.stats.scheduledViewings'), value: viewings.toString(), icon: Calendar, color: 'purple', loading: false },
          { label: t('overview.stats.pendingTasks'), value: pendingTasks.toString(), icon: Clock, color: 'orange', loading: false }
        ]);

      } catch (error) {
        console.error("Failed to fetch opportunities stats:", error);
        setStats(prev => prev.map(s => ({
          ...s,
          value: t('common:status.unknown'),
          loading: false
        })));
      }
    };

    fetchStats();
  }, [isNamespaceReady, t]);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className={`${colors.bg.primary} rounded-lg shadow p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${colors.text.muted}`}>
                  {stat.label.startsWith('overview.stats.')
                    ? t(stat.label)
                    : stat.label}
                </p>
                {stat.loading ? (
                  <div className={`animate-pulse ${colors.bg.hover} h-8 w-16 rounded-md mt-1`}></div>
                ) : (
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                )}
                <p className={`text-xs mt-1 ${colors.text.muted}`}>
                  {/* Change info can be added here */}
                </p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
                <stat.icon className={`${iconSizes.lg} text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

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
