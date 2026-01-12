'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { formatCurrency } from '@/lib/intl-utils';
import { Lightbulb } from 'lucide-react';
import { costBreakdown, monthlyProgress } from './utils';
import { analyticsOverviewStyles } from './AnalyticsOverview.styles';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function AnalyticsOverview() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('tabs.analytics.overview.costAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {costBreakdown.map((item) => (
                            <div key={item.category}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">{item.category}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {formatCurrency(item.amount)} ({item.percentage}%)
                                    </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-3">
                                    <div
                                        className={cn("h-3 rounded-full", TRANSITION_PRESETS.SLOW_ALL, item.color)}
                                        style={analyticsOverviewStyles.progressBars.item(item.percentage)}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <aside className={`mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 ${quick.card}`}>
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                            <Lightbulb className={iconSizes.sm} />
                            {t('tabs.analytics.overview.analysis')}
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            {t('tabs.analytics.overview.analysisText')}
                        </p>
                    </aside>
                </CardContent>
            </Card>

            {/* Progress Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('tabs.analytics.overview.progressVsPlanned')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {monthlyProgress.map((month) => (
                            <div key={month.month} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{month.month}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {t('tabs.analytics.overview.planned')} {month.planned}% | {t('tabs.analytics.overview.actual')} {month.actual}%
                                    </span>
                                </div>
                                <div className="relative">
                                    <div className="w-full bg-muted rounded-full h-4">
                                        <div
                                            className="h-4 bg-blue-200 dark:bg-blue-800 rounded-full"
                                            style={analyticsOverviewStyles.progressBars.planned(month.planned)}
                                        ></div>
                                        <div
                                            className="absolute top-0 h-4 bg-primary rounded-full"
                                            style={analyticsOverviewStyles.progressBars.actual(month.actual)}
                                        ></div>
                                        <div className="absolute right-2 top-0 text-xs font-medium text-primary-foreground">
                                            {month.actual}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
