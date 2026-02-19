'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Ruler } from 'lucide-react';
import type { BuildingStats as StatsType } from '@/types/building';
import { getBuildingStats } from '@/services/buildings.service';
import { formatNumber } from '@/lib/intl-utils';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingStats');

// 🏢 ENTERPRISE: Centralized Unit Icon
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

interface BuildingStatsProps {
  buildingId: string;
}

export function BuildingStats({ buildingId }: BuildingStatsProps) {
  const { t } = useTranslation('building');
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!buildingId) return;
      setLoading(true);
      try {
        const buildingStats = await getBuildingStats(buildingId);
        setStats(buildingStats);
      } catch (error) {
        logger.error('Failed to fetch building stats', { error });
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [buildingId]);

  const dashboardStats: DashboardStat[] = [
    {
      title: t('stats.totalUnits'),
      value: loading ? '...' : stats?.totalUnits ?? 0,
      icon: UnitIcon,
      color: 'blue',
      loading,
    },
    {
      title: t('stats.soldUnits'),
      value: loading ? '...' : stats?.soldUnits ?? 0,
      icon: CheckCircle,
      color: 'green',
      loading,
    },
    {
      title: t('stats.totalSoldArea'),
      value: loading ? '...' : `${formatNumber(stats?.totalSoldArea ?? 0)} m²`,
      icon: Ruler,
      color: 'purple',
      loading,
    },
  ];

  return (
    <UnifiedDashboard
      stats={dashboardStats}
      columns={3}
      className="mb-2"
    />
  );
}
