'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { kpis, getEfficiencyColor } from './utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function KPICards() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');

    // 🏢 ENTERPRISE: Helper function to get efficiency label
    const getEfficiencyLabel = (value: number) => {
        if (value >= 90) return t('tabs.analytics.kpi.excellent');
        if (value >= 75) return t('tabs.analytics.kpi.good');
        return t('tabs.analytics.kpi.needsImprovement');
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{kpis.costEfficiency}%</div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.kpi.costEfficiency')}</div>
                        <div className={cn("text-xs px-2 py-1 rounded mt-1", getEfficiencyColor(kpis.costEfficiency))}>
                            {getEfficiencyLabel(kpis.costEfficiency)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{kpis.timeEfficiency}%</div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.kpi.timeEfficiency')}</div>
                        <div className={cn("text-xs px-2 py-1 rounded mt-1", getEfficiencyColor(kpis.timeEfficiency))}>
                            {getEfficiencyLabel(kpis.timeEfficiency)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{kpis.qualityScore}%</div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.kpi.qualityScore')}</div>
                        <div className={cn("text-xs px-2 py-1 rounded mt-1", getEfficiencyColor(kpis.qualityScore))}>
                            {t('tabs.analytics.kpi.exceptional')}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{kpis.roi}%</div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.kpi.roi')}</div>
                        <div className="text-xs px-2 py-1 rounded mt-1 text-green-800 dark:text-green-300">
                            {t('tabs.analytics.kpi.aboveTarget')}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{kpis.profitMargin}%</div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.kpi.profitMargin')}</div>
                        <div className="text-xs px-2 py-1 rounded mt-1 text-green-800 dark:text-green-300">
                            {t('tabs.analytics.kpi.withinTarget')}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">{kpis.riskLevel}</div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.kpi.riskLevel')}</div>
                        <div className="text-xs px-2 py-1 rounded mt-1 text-green-800 dark:text-green-300">
                            {t('tabs.analytics.kpi.underControl')}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
