'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Ruler } from 'lucide-react';
import type { ProjectStats as StatsType } from '@/types/project';
import { getProjectStats } from '@/services/projects.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

interface ProjectStatsProps {
  projectId: string;
}

export function ProjectStats({ projectId }: ProjectStatsProps) {
  const { t } = useTranslation('projects');
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!projectId) return;
      setLoading(true);
      try {
        const projectStats = await getProjectStats(projectId);
        setStats(projectStats);
      } catch (error) {
        console.error("Failed to fetch project stats:", error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [projectId]);

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
      title: t('stats.totalAreaSold'),
      value: loading ? '...' : `${(stats?.totalSoldArea ?? 0).toLocaleString('el-GR')} m²`,
      icon: Ruler,
      color: 'purple',
      loading,
    },
  ];

  return (
    <UnifiedDashboard
      stats={dashboardStats}
      columns={3}
      className="mb-6"
    />
  );
}
