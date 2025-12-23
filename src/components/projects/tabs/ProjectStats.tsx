'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Home, CheckCircle, Ruler } from 'lucide-react';
import type { ProjectStats as StatsType } from '@/types/project';
import { getProjectStats } from '@/services/projects.service';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';

interface ProjectStatsProps {
  projectId: number;
}

const StatCard = ({ icon: Icon, value, label, loading, colorClass }: { icon: React.ElementType, value: string | number, label: string, loading: boolean, colorClass: string }) => {
    const iconSizes = useIconSizes();

    return (
    <Card className={cn("p-4", colorClass)}>
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-white/20">
               <Icon className={iconSizes.md} />
            </div>
            <div>
                {loading ? (
                    <>
                        <Skeleton className="h-6 w-16 mb-1 bg-white/50" />
                        <Skeleton className="h-4 w-24 bg-white/50" />
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
            icon={Home}
            value={loading ? '...' : stats?.totalUnits ?? 0}
            label="Σύνολο Μονάδων"
            loading={loading}
            colorClass="bg-blue-600 text-white"
        />
        <StatCard 
            icon={CheckCircle}
            value={loading ? '...' : stats?.soldUnits ?? 0}
            label="Πωλημένες Μονάδες"
            loading={loading}
            colorClass="bg-green-600 text-white"
        />
        <StatCard 
            icon={Ruler}
            value={loading ? '...' : `${(stats?.totalSoldArea ?? 0).toLocaleString('el-GR')} m²`}
            label="Συνολικό Εμβαδόν Πωληθέντων"
            loading={loading}
            colorClass="bg-purple-600 text-white"
        />
    </div>
  );
}
