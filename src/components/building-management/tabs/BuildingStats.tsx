
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Home, CheckCircle, Ruler } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { BuildingStats as StatsType } from '@/types/building';
import { getBuildingStats } from '@/services/buildings.service';

interface BuildingStatsProps {
  buildingId: string;
}

const StatCard = ({ icon: Icon, value, label, loading, colorClass }: { icon: React.ElementType, value: string | number, label: string, loading: boolean, colorClass: string }) => {
    const iconSizes = useIconSizes();
    return (
    <Card className={colorClass}>
        <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${colorClass.replace('bg-', 'bg-opacity-20 ')}`}>
               <Icon className={iconSizes.lg} />
            </div>
            <div>
                {loading ? (
                    <>
                        <Skeleton className="h-6 w-16 mb-1" />
                        <Skeleton className="h-4 w-24" />
                    </>
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                    </>
                )}
            </div>
        </CardContent>
    </Card>
    );
};

export function BuildingStats({ buildingId }: BuildingStatsProps) {
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
        console.error("Failed to fetch building stats:", error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [buildingId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
            icon={Home}
            value={loading ? '...' : stats?.totalUnits ?? 0}
            label="Σύνολο Μονάδων"
            loading={loading}
            colorClass="bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
        />
        <StatCard 
            icon={CheckCircle}
            value={loading ? '...' : stats?.soldUnits ?? 0}
            label="Πωλημένες Μονάδες"
            loading={loading}
            colorClass="bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300"
        />
        <StatCard 
            icon={Ruler}
            value={loading ? '...' : `${(stats?.totalSoldArea ?? 0).toLocaleString('el-GR')} m²`}
            label="Συνολικό Εμβαδόν Πωληθέντων"
            loading={loading}
            colorClass="bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
        />
    </div>
  );
}
