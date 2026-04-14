/* eslint-disable design-system/prefer-design-system-imports */
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
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('ProjectStats');

// 🏢 ENTERPRISE: Centralized Property Icon
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;

interface ProjectStatsProps {
  projectId: string;
}

export function ProjectStats({ projectId }: ProjectStatsProps) {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
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
        logger.error('Failed to fetch project stats:', { error: error });
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [projectId]);

  const dashboardStats: DashboardStat[] = [
    {
      title: t('stats.totalProperties'),
      value: loading ? '...' : stats?.totalProperties ?? 0,
      icon: PropertyIcon,
      color: 'blue',
      loading,
    },
    {
      title: t('stats.soldProperties'),
      value: loading ? '...' : stats?.soldProperties ?? 0,
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
      className="mb-2"
    />
  );
}
