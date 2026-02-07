"use client";

import { Users, Plus, Star, Activity } from "lucide-react";
import { useTranslation } from "@/i18n";
import { UnifiedDashboard } from "@/components/property-management/dashboard/UnifiedDashboard";
import type { DashboardStat } from "@/components/property-management/dashboard/UnifiedDashboard";
import type { QuickStats } from "@/types/dashboard";

interface StatsCardsProps {
  stats: QuickStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useTranslation('dashboard');

  const dashboardStats: DashboardStat[] = [
    {
      title: t('stats.totalContacts'),
      value: stats.totalContacts.toLocaleString("el-GR"),
      description: `+12.5% ${t('stats.periods.lastMonth')}`,
      icon: Users,
      color: 'blue',
    },
    {
      title: t('stats.newContacts'),
      value: stats.newThisMonth,
      description: t('stats.periods.thisMonth'),
      icon: Plus,
      color: 'green',
    },
    {
      title: t('stats.favorites'),
      value: stats.favorites,
      description: t('stats.quickAccess'),
      icon: Star,
      color: 'yellow',
    },
    {
      title: t('stats.activeToday'),
      value: stats.activeToday,
      description: t('stats.periods.last24h'),
      icon: Activity,
      color: 'orange',
    },
  ];

  return (
    <section role="region" aria-label={t('aria.statsSection')}>
      <UnifiedDashboard
        stats={dashboardStats}
        columns={4}
        className=""
      />
    </section>
  );
}
