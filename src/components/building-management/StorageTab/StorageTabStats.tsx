'use client';

import React from 'react';
import { Package, CheckCircle, Euro, Ruler } from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageTabStatsProps {
    storageCount: number;
    available: number;
    totalValue: number;
    totalArea: number;
}

export function StorageTabStats({
    storageCount,
    available,
    totalValue,
    totalArea,
}: StorageTabStatsProps) {
    const { t } = useTranslation('building');

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
            value: `€${(totalValue / 1000).toFixed(0)}K`,
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
