/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { kpis, getEfficiencyColor } from './utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export default function KPICards() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const colors = useSemanticColors();

    // 🏢 ENTERPRISE: Helper function to get efficiency label
    const getEfficiencyLabel = (value: number) => {
        if (value >= 90) return t('tabs.analytics.kpi.excellent');
        if (value >= 75) return t('tabs.analytics.kpi.good');
        return t('tabs.analytics.kpi.needsImprovement');
    };

    return (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Card>
                <CardContent className="p-2">
                    <figure className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{kpis.costEfficiency}%</p>
                        <figcaption className={cn("text-xs", colors.text.muted)}>{t('tabs.analytics.kpi.costEfficiency')}</figcaption>
                        <span className={cn("text-xs px-2 py-1 rounded mt-1 inline-block", getEfficiencyColor(kpis.costEfficiency))}>
                            {getEfficiencyLabel(kpis.costEfficiency)}
                        </span>
                    </figure>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2">
                    <figure className="text-center">
                        <p className="text-2xl font-bold text-green-600">{kpis.timeEfficiency}%</p>
                        <figcaption className={cn("text-xs", colors.text.muted)}>{t('tabs.analytics.kpi.timeEfficiency')}</figcaption>
                        <span className={cn("text-xs px-2 py-1 rounded mt-1 inline-block", getEfficiencyColor(kpis.timeEfficiency))}>
                            {getEfficiencyLabel(kpis.timeEfficiency)}
                        </span>
                    </figure>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2">
                    <figure className="text-center">
                        <p className="text-2xl font-bold text-purple-600">{kpis.qualityScore}%</p>
                        <figcaption className={cn("text-xs", colors.text.muted)}>{t('tabs.analytics.kpi.qualityScore')}</figcaption>
                        <span className={cn("text-xs px-2 py-1 rounded mt-1 inline-block", getEfficiencyColor(kpis.qualityScore))}>
                            {t('tabs.analytics.kpi.exceptional')}
                        </span>
                    </figure>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2">
                    <figure className="text-center">
                        <p className="text-2xl font-bold text-orange-600">{kpis.roi}%</p>
                        <figcaption className={cn("text-xs", colors.text.muted)}>{t('tabs.analytics.kpi.roi')}</figcaption>
                        <span className="text-xs px-2 py-1 rounded mt-1 inline-block text-green-800 dark:text-green-300">
                            {t('tabs.analytics.kpi.aboveTarget')}
                        </span>
                    </figure>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2">
                    <figure className="text-center">
                        <p className="text-2xl font-bold text-red-600">{kpis.profitMargin}%</p>
                        <figcaption className={cn("text-xs", colors.text.muted)}>{t('tabs.analytics.kpi.profitMargin')}</figcaption>
                        <span className="text-xs px-2 py-1 rounded mt-1 inline-block text-green-800 dark:text-green-300">
                            {t('tabs.analytics.kpi.withinTarget')}
                        </span>
                    </figure>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-2">
                    <figure className="text-center">
                        <p className="text-2xl font-bold text-gray-600">{kpis.riskLevel}</p>
                        <figcaption className={cn("text-xs", colors.text.muted)}>{t('tabs.analytics.kpi.riskLevel')}</figcaption>
                        <span className="text-xs px-2 py-1 rounded mt-1 inline-block text-green-800 dark:text-green-300">
                            {t('tabs.analytics.kpi.underControl')}
                        </span>
                    </figure>
                </CardContent>
            </Card>
        </section>
    );
}
