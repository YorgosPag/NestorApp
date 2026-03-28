'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

interface StatusCardProps {
    statsByStatus: Record<string, number>;
    getStatusLabel: (status: string) => string;
}

export function StatusCard({ statsByStatus, getStatusLabel }: StatusCardProps) {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const { t } = useTranslation('units');
    const spacing = useSpacingTokens();
    // 🎯 DOMAIN SEPARATION: Operational status colors (Physical Truth - No Sales!)
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ready': return colors.bg.success;
            case 'underConstruction': return colors.bg.warning;
            case 'inspection': return colors.bg.info;
            case 'maintenance': return colors.bg.error;
            case 'draft': return colors.bg.muted;
            default: return colors.bg.muted;
        }
    };
    
    return (
        <Card>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${spacing.padding.sm} pb-2`}>
                <CardTitle className="text-sm font-medium">{t('page.dashboard.unitStatus')}</CardTitle>
                <Activity className={`${iconSizes.sm} ${colors.text.muted}`} />
            </CardHeader>
            <CardContent className={`${spacing.padding.sm} pt-0`}>
                <div className="space-y-2">
                    {Object.entries(statsByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`${iconSizes.xs} ${iconSizes.xs} rounded-full ${getStatusColor(status)}`} />
                                <span className="text-xs">{t(getStatusLabel(status))}</span>
                            </div>
                            <span className="text-xs font-medium">{count}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
