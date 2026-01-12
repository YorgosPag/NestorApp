'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Building } from '../../BuildingsPageContent';
import { monthlyProgress } from './utils';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface AnalyticsFinancialProps {
    building: Building;
}

export default function AnalyticsFinancial({ building }: AnalyticsFinancialProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const { quick } = useBorderTokens();
    return (
        <div className="space-y-6">
            {/* Financial Summary */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-green-600">
                            {formatCurrency(building.totalValue || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.financial.totalBudget')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-blue-600">
                            {formatCurrency((building.totalValue || 0) * 0.75)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.financial.spentCost')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-orange-600">
                            {formatCurrency((building.totalValue || 0) * 0.25)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.financial.remainingBudget')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-purple-600">
                            {formatNumber(((building.totalValue || 0) / building.totalArea))}€/m²
                        </div>
                        <div className="text-xs text-muted-foreground">{t('tabs.analytics.financial.costPerSqm')}</div>
                    </CardContent>
                </Card>
            </section>

            {/* Cash Flow */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('tabs.analytics.financial.cashFlows')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {monthlyProgress.map((month, index) => (
                            <div key={month.month} className={`flex items-center justify-between p-3 ${quick.card}`}>
                                <div className="flex items-center gap-3">
                                    <div className="text-sm font-medium w-12">{month.month}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {t('tabs.analytics.financial.monthlyExpense')} {formatCurrency(month.cost)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-sm">
                                        {t('tabs.analytics.financial.cumulative')} {formatCurrency(monthlyProgress.slice(0, index + 1).reduce((sum, m) => sum + m.cost, 0))}
                                    </div>
                                    <div className={cn(`text-sm px-2 py-1 ${quick.input}`,
                                        month.cost < 95000 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                    )}>
                                        {month.cost < 95000 ? t('tabs.analytics.financial.withinBudget') : t('tabs.analytics.financial.attention')}
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
