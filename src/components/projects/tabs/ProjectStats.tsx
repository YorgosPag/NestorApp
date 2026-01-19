'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Ruler } from 'lucide-react';
import type { ProjectStats as StatsType } from '@/types/project';
import { getProjectStats } from '@/services/projects.service';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

interface ProjectStatsProps {
  projectId: number;
}

const StatCard = ({ icon: Icon, value, label, loading, colorClass }: { icon: React.ElementType, value: string | number, label: string, loading: boolean, colorClass: string }) => {
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    const colors = useSemanticColors();

    return (
    <Card className={cn("p-4", colorClass)}>
        <div className="flex items-center gap-4">
            <div className={`p-3 ${quick.card} ${colors.bg.secondary} opacity-60`}>
               <Icon className={iconSizes.md} />
            </div>
            <div>
                {loading ? (
                    <>
                        <Skeleton className={`h-6 w-16 mb-1 ${colors.bg.secondary} opacity-50`} />
                        <Skeleton className={`h-4 w-24 ${colors.bg.secondary} opacity-50`} />
                    </>
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        <div className="text-xs">{label}</div>
                    </>
                )}
            </div>
        </div>
    </Card>
    );
};

export function ProjectStats({ projectId }: ProjectStatsProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
            icon={UnitIcon}
            value={loading ? '...' : stats?.totalUnits ?? 0}
            label={t('stats.totalUnits')}
            loading={loading}
            colorClass={`${colors.bg.info} ${colors.text.inverted}`}
        />
        <StatCard
            icon={CheckCircle}
            value={loading ? '...' : stats?.soldUnits ?? 0}
            label={t('stats.soldUnits')}
            loading={loading}
            colorClass={`${colors.bg.success} ${colors.text.inverted}`}
        />
        <StatCard
            icon={Ruler}
            value={loading ? '...' : `${(stats?.totalSoldArea ?? 0).toLocaleString('el-GR')} m²`}
            label={t('stats.totalAreaSold')}
            loading={loading}
            colorClass={`${colors.bg.accent} ${colors.text.inverted}`}
        />
    </div>
  );
}
