'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Home, Ruler, Euro } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { getUnitsByOwner } from '@/services/units.service';
import type { Property } from '@/types/property-viewer';

interface CustomerStatsProps {
  contactId: string;
}

interface Stats {
  unitsCount: number;
  totalArea: number;
  totalValue: number;
}

const StatCard = ({ icon: Icon, value, label, loading, colorClass }: { icon: React.ElementType, value: string | number, label: string, loading: boolean, colorClass: string }) => (
    <Card className={colorClass}>
        <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-2 rounded-lg ${colorClass.replace('bg-', 'bg-opacity-20 ')}`}>
               <Icon className="w-6 h-6" />
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

export function CustomerStats({ contactId }: CustomerStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!contactId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const units = await getUnitsByOwner(contactId);
        if (units.length > 0) {
            const unitsCount = units.length;
            const totalArea = units.reduce((sum, unit) => sum + (unit.area || 0), 0);
            const totalValue = units.reduce((sum, unit) => sum + (unit.price || 0), 0);
            setStats({ unitsCount, totalArea, totalValue });
        } else {
            setStats(null);
        }
      } catch (error) {
        console.error("Failed to fetch customer stats:", error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [contactId]);

  if (loading) {
    return null; // Render nothing on server and initial client render to prevent hydration mismatch
  }
  
  if (!stats) {
    return null; // Don't render the component if there are no stats to show
  }

  return (
    <div>
        <h4 className="text-sm font-semibold mb-2">Στατιστικά Ιδιοκτησίας</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard 
                icon={Home}
                value={stats.unitsCount}
                label="Αριθμός Μονάδων"
                loading={false}
                colorClass="bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
            />
             <StatCard 
                icon={Ruler}
                value={`${formatNumber(stats.totalArea)} m²`}
                label="Συνολικό Εμβαδόν"
                loading={false}
                colorClass="bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
            />
             <StatCard 
                icon={Euro}
                value={formatCurrency(stats.totalValue)}
                label="Συνολική Αξία"
                loading={false}
                colorClass="bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300"
            />
        </div>
    </div>
  );
}
