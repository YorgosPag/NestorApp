'use client';

import React from 'react';
import { Package, CheckCircle, Euro, Ruler } from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
import { priceTotalsView } from '@/lib/listings/listing-price-label';
import type { PriceTotalsByRole } from '@/lib/properties/price-totals';

interface StorageTabStatsProps {
    storageCount: number;
    available: number;
    priceTotals: PriceTotalsByRole;
    totalArea: number;
}

export function StorageTabStats({
    storageCount,
    available,
    priceTotals,
    totalArea,
}: StorageTabStatsProps) {
    const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

    const dashboardStats: DashboardStat[] = [
        {
            title: t('storageStats.storages'),
            value: storageCount,
            icon: Package,
            color: 'blue',
        },
        {
            title: t('storageStats.available'),
            value: available,
            icon: CheckCircle,
            color: 'green',
        },
        {
            title: t('storageStats.totalValue'),
            ...priceTotalsView(t, priceTotals, 'total'),
            icon: Euro,
            color: 'gray',
        },
        {
            title: t('storageStats.totalArea'),
            value: `${totalArea.toFixed(1)} m²`,
            icon: Ruler,
            color: 'blue',
        },
    ];

    return (
        <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            className=""
        />
    );
}
