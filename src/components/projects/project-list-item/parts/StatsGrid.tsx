
'use client';

import React from 'react';
import type { Project } from '../types';
import { formatCurrency } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';

interface StatsGridProps {
    project: Project;
}

export function StatsGrid({ project }: StatsGridProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const typography = useTypography();
    const colors = useSemanticColors();

    return (
        <div className={cn("grid grid-cols-2 gap-2", typography.body.xs)}>
            <div>
                <p className={colors.text.muted}>{t('statsGrid.area')}</p>
                <p className={typography.label.xs}>{project.totalArea?.toLocaleString('el-GR') || 'N/A'} m²</p>
            </div>
            <div>
                <p className={colors.text.muted}>{t('statsGrid.value')}</p>
                <p className={cn(typography.label.xs, getStatusColor('active', 'text'))}>{formatCurrency(project.totalValue || 0)}</p>
            </div>
        </div>
    );
}
