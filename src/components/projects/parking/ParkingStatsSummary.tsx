'use client';

import React from 'react';
import { Car, BarChart3, Package, Ruler, CheckCircle, Users } from 'lucide-react';
import type { ParkingStats } from '@/types/parking';
import { formatCurrency } from '@/lib/intl-utils';
import { UNIFIED_STATUS_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ParkingStatsSummaryProps {
    stats: ParkingStats;
}

export function ParkingStatsSummary({ stats }: ParkingStatsSummaryProps) {
    const { t } = useTranslation('projects');

    const dashboardStats: DashboardStat[] = [
        {
            title: t('parking.stats.total'),
            value: stats.totalSpots,
            icon: Car,
            color: 'blue',
        },
        {
            title: t('parking.stats.sold'),
            value: stats.soldSpots,
            icon: CheckCircle,
            color: 'green',
        },
        {
            title: t('parking.stats.landowner'),
            value: stats.ownerSpots,
            icon: Users,
            color: 'cyan',
        },
        {
            title: t(UNIFIED_STATUS_FILTER_LABELS.AVAILABLE, { ns: 'common' }),
            value: stats.availableSpots,
            icon: Package,
            color: 'gray',
        },
        {
            title: t('parking.stats.totalValue'),
            value: formatCurrency(stats.totalValue),
            icon: BarChart3,
            color: 'orange',
        },
        {
            title: t('parking.stats.area'),
            value: `${stats.totalArea.toFixed(1)} m²`,
            icon: Ruler,
            color: 'purple',
        },
    ];

    return (
        <UnifiedDashboard
            stats={dashboardStats}
            columns={6}
            className=""
        />
    );
}
