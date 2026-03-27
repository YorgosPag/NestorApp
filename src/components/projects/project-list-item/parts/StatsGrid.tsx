
'use client';

import React from 'react';
import type { Project } from '../types';
import { formatCurrency } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusColor } from '@/lib/design-system';

interface StatsGridProps {
    project: Project;
}

export function StatsGrid({ project }: StatsGridProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');

    return (
        <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
                <p className="text-muted-foreground">{t('statsGrid.area')}</p>
                <p className="font-medium">{project.totalArea?.toLocaleString('el-GR') || 'N/A'} m²</p>
            </div>
            <div>
                <p className="text-muted-foreground">{t('statsGrid.value')}</p>
                <p className={`font-medium ${getStatusColor('active', 'text')}`}>{formatCurrency(project.totalValue || 0)}</p>
            </div>
        </div>
    );
}
