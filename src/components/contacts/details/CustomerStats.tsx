'use client';

import React, { useState, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { Ruler, Euro } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { getUnitsByOwner } from '@/services/units.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

interface CustomerStatsProps {
  contactId: string;
}

interface Stats {
  unitsCount: number;
  totalArea: number;
  totalValue: number;
}

const logger = createModuleLogger('CustomerStats');

export function CustomerStats({ contactId }: CustomerStatsProps) {
  const { t } = useTranslation('contacts');
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
        logger.error('Failed to fetch customer stats', { error });
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [contactId]);

  if (loading) {
    return null;
  }

  if (!stats) {
    return null;
  }

  const dashboardStats: DashboardStat[] = [
    {
      title: t('stats.unitsCount'),
      value: stats.unitsCount,
      icon: UnitIcon,
      color: 'blue',
    },
    {
      title: t('stats.totalArea'),
      value: `${formatNumber(stats.totalArea)} m²`,
      icon: Ruler,
      color: 'purple',
    },
    {
      title: t('stats.totalValue'),
      value: formatCurrency(stats.totalValue),
      icon: Euro,
      color: 'green',
    },
  ];

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{t('stats.title')}</h4>
      <UnifiedDashboard
        stats={dashboardStats}
        columns={3}
        className=""
      />
    </div>
  );
}
