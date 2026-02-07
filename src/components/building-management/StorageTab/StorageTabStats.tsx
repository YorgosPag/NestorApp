'use client';

import React from 'react';
import { Package, Car, CheckCircle, Euro } from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageTabStatsProps {
    storageCount: number;
    parkingCount: number;
    available: number;
    totalValue: number;
}

export function StorageTabStats({
    storageCount,
    parkingCount,
    available,
    totalValue,
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
            title: t('storageStats.parkingSpaces'),
            value: parkingCount,
            icon: Car,
            color: 'orange',
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
    ];

    return (
        <UnifiedDashboard
            stats={dashboardStats}
            columns={4}
            className=""
        />
    );
}
