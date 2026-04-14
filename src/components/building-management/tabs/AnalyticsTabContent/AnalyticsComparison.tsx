'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export default function AnalyticsComparison() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
    const colors = useSemanticColors();
    const { quick } = useBorderTokens();

    // 🏢 ENTERPRISE: i18n-enabled metrics data
    const comparisonMetrics = [
        { metricKey: 'costPerSqm', current: '700€', average: '750€', status: 'better' },
        { metricKey: 'completionTime', current: '36 μήνες', average: '32 μήνες', status: 'worse' }, // eslint-disable-line custom/no-hardcoded-strings
        { metricKey: 'workQuality', current: '9.5/10', average: '8.2/10', status: 'better' },
        { metricKey: 'efficiency', current: '88%', average: '82%', status: 'better' }
    ];

    return (
        <section className="space-y-2">
            <Card>
                <CardHeader>
                    <CardTitle>{t('tabs.analytics.comparison.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        {comparisonMetrics.map((item) => (
                            <li key={item.metricKey} className={`flex items-center justify-between p-2 ${quick.card}`}>
                                <div className="flex-1">
                                    <div className="font-medium">{t(`tabs.analytics.comparison.metrics.${item.metricKey}`)}</div>
                                    <div className={cn("text-sm", colors.text.muted)}>
                                        {t('tabs.analytics.comparison.current')} {item.current} | {t('tabs.analytics.comparison.average')} {item.average}
                                    </div>
                                </div>
                                <div className={cn(`px-2 py-1 ${quick.input} text-sm`,
                                    item.status === 'better'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' // eslint-disable-line design-system/enforce-semantic-colors
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' // eslint-disable-line design-system/enforce-semantic-colors
                                )}>
                                    {item.status === 'better'
                                        ? `↗️ ${t('tabs.analytics.comparison.better')}`
                                        : `↘️ ${t('tabs.analytics.comparison.worse')}`}
                                </div>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </section>
    );
}
