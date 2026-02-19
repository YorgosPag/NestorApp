'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, DollarSign, TrendingUp, Scale } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface HeaderProps {
    timeRange: '1M' | '3M' | '6M' | '1Y';
    setTimeRange: (value: '1M' | '3M' | '6M' | '1Y') => void;
    analyticsView: 'overview' | 'financial' | 'progress' | 'comparison';
    setAnalyticsView: (value: 'overview' | 'financial' | 'progress' | 'comparison') => void;
}

export default function Header({ timeRange, setTimeRange, analyticsView, setAnalyticsView }: HeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();

    // 🏢 ENTERPRISE: i18n-enabled view configuration
    const viewConfig = [
        { id: 'overview', labelKey: 'tabs.analytics.views.overview', icon: <BarChart3 className={`${iconSizes.sm} mr-2`} /> },
        { id: 'financial', labelKey: 'tabs.analytics.views.financial', icon: <DollarSign className={`${iconSizes.sm} mr-2`} /> },
        { id: 'progress', labelKey: 'tabs.analytics.views.progress', icon: <TrendingUp className={`${iconSizes.sm} mr-2`} /> },
        { id: 'comparison', labelKey: 'tabs.analytics.views.comparison', icon: <Scale className={`${iconSizes.sm} mr-2`} /> }
    ];

    return (
        <header>
            <section className="flex items-center justify-between">
                <hgroup>
                    <h3 className="text-lg font-semibold">{t('tabs.analytics.title')}</h3>
                    <p className="text-sm text-muted-foreground">
                        {t('tabs.analytics.subtitle')}
                    </p>
                </hgroup>
                <nav className="flex items-center gap-2">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('tabs.analytics.timeRange.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1M">{t('tabs.analytics.timeRange.lastMonth')}</SelectItem>
                            <SelectItem value="3M">{t('tabs.analytics.timeRange.last3Months')}</SelectItem>
                            <SelectItem value="6M">{t('tabs.analytics.timeRange.last6Months')}</SelectItem>
                            <SelectItem value="1Y">{t('tabs.analytics.timeRange.lastYear')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                        <BarChart3 className={`${iconSizes.sm} mr-2`} /> {t('tabs.analytics.exportReport')}
                    </Button>
                </nav>
            </section>

            <nav className="flex gap-2 mt-2">
                {viewConfig.map((view) => (
                    <Button
                        key={view.id}
                        variant={analyticsView === view.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAnalyticsView(view.id as 'overview' | 'financial' | 'progress' | 'comparison')}
                    >
                        {view.icon} {t(view.labelKey)}
                    </Button>
                ))}
            </nav>
        </header>
    );
}
