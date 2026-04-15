'use client';

import '@/lib/design-system';
import React, { useState, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { Ruler, Euro } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { getPropertiesByOwner } from '@/services/properties.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createStaleCache } from '@/lib/stale-cache';

// 🏢 ENTERPRISE: Centralized Property Icon
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;

// ADR-300: module-level cache keyed by contactId
const customerStatsCache = createStaleCache<Stats | null>('contact-stats');

interface CustomerStatsProps {
  contactId: string;
}

interface Stats {
  propertiesCount: number;
  totalArea: number;
  totalValue: number;
}

const logger = createModuleLogger('CustomerStats');

export function CustomerStats({ contactId }: CustomerStatsProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const [stats, setStats] = useState<Stats | null>(customerStatsCache.get(contactId));
  const [loading, setLoading] = useState(!customerStatsCache.hasLoaded(contactId));

  useEffect(() => {
    const fetchStats = async () => {
      if (!contactId) {
        setLoading(false);
        return;
      }
      if (!customerStatsCache.hasLoaded(contactId)) setLoading(true);
      try {
        const units = await getPropertiesByOwner(contactId);
        const computed = units.length > 0
          ? {
              propertiesCount: units.length,
              totalArea: units.reduce((sum, unit) => sum + (unit.area || 0), 0),
              totalValue: units.reduce((sum, unit) => sum + (unit.price || 0), 0),
            }
          : null;
        customerStatsCache.set(computed, contactId);
        setStats(computed);
      } catch (error) {
        logger.error('Failed to fetch customer stats', { error });
        customerStatsCache.set(null, contactId);
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
      title: t('stats.propertiesCount'),
      value: stats.propertiesCount,
      icon: PropertyIcon,
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
      <h3 className="text-sm font-semibold mb-2">{t('stats.title')}</h3>
      <UnifiedDashboard
        stats={dashboardStats}
        columns={3}
        className=""
      />
    </div>
  );
}
