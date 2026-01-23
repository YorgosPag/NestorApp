'use client';

import React from 'react';
import { TrendingUp, CheckCircle } from 'lucide-react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { PropertyStats } from '@/types/property';
import { StatsCard } from './dashboard/StatsCard';
import { StatusCard } from './dashboard/StatusCard';
import { DetailsCard } from './dashboard/DetailsCard';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `€${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `€${(amount / 1000).toFixed(0)}K`;
    }
    return `€${amount.toLocaleString('el-GR')}`;
};

interface PropertyDashboardProps {
  stats: PropertyStats;
}

export function PropertyDashboard({ stats }: PropertyDashboardProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');

    const getStatusLabel = (status: string) => {
        switch (status) {
          case 'sold': return t('dashboard.labels.sold');
          case 'available': return t('dashboard.labels.available');
          case 'reserved': return t('dashboard.labels.reserved');
          case 'owner': return t('dashboard.labels.landowner');
          default: return status;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
          case 'apartment': return t('types.apartment');
          case 'studio': return t('types.studio');
          case 'maisonette': return t('types.maisonette');
          case 'shop': return t('types.shop');
          case 'office': return t('types.office');
          case 'storage': return t('types.storage');
          default: return type;
        }
    };

    // 🏢 ENTERPRISE: Using centralized icons for area and price
    // 🏢 ENTERPRISE: Fallback values for optional stats to ensure type safety
    const statsCardsData = [
        { title: t('dashboard.stats.totalUnits'), value: stats.totalProperties ?? 0, icon: NAVIGATION_ENTITIES.unit.icon, color: "blue" },
        { title: t(UNIFIED_STATUS_FILTER_LABELS.AVAILABLE, { ns: 'common' }), value: stats.availableProperties ?? 0, icon: TrendingUp, color: "gray" },
        { title: t('dashboard.stats.totalValue'), value: formatCurrency(stats.totalValue), icon: NAVIGATION_ENTITIES.price.icon, color: "green" },
        { title: t('dashboard.stats.totalArea'), value: `${Math.round(stats.totalArea ?? 0)} m²`, icon: NAVIGATION_ENTITIES.area.icon, color: "purple" },
        { title: t(UNIFIED_STATUS_FILTER_LABELS.SOLD, { ns: 'common' }), value: stats.soldProperties ?? 0, icon: CheckCircle, color: "red" },
        { title: t('dashboard.stats.averagePrice'), value: formatCurrency(stats.averagePrice), icon: NAVIGATION_ENTITIES.price.icon, color: "orange" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {statsCardsData.map(card => (
                <StatsCard key={card.title} {...card} />
            ))}
            <StatusCard statsByStatus={stats.propertiesByStatus} getStatusLabel={getStatusLabel} />
            <DetailsCard title={t('dashboard.cards.unitTypes')} icon={NAVIGATION_ENTITIES.unit.icon} data={stats.propertiesByType} labelFormatter={getTypeLabel} />
            <DetailsCard title={t('dashboard.cards.distributionByFloor')} icon={NAVIGATION_ENTITIES.floor.icon} data={stats.propertiesByFloor} isFloorData={true} />
            <DetailsCard
                title={t('dashboard.cards.storages')}
                icon={NAVIGATION_ENTITIES.storage.icon}
                data={{
                    [t('dashboard.cards.total')]: stats.totalStorageUnits ?? 0,
                    [t('dashboard.cards.available')]: stats.availableStorageUnits ?? 0,
                    [t('dashboard.cards.sold')]: stats.soldStorageUnits ?? 0,
                }}
                isThreeColumnGrid={true}
            />
        </div>
    );
}
