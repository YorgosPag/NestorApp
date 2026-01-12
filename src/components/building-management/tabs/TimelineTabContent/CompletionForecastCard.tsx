'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, Lightbulb } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatDate } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface CompletionForecastCardProps {
    milestones: { status: string; date: string }[];
}

export function CompletionForecastCard({ milestones }: CompletionForecastCardProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    const lastMilestone = milestones[milestones.length - 1];
    const delayDays = 5; // Mock data for delay

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className={`${iconSizes.md} text-green-500`} />
                    {t('tabs.timeline.forecast.title')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">{t('tabs.timeline.forecast.originalSchedule')}</span>
                            <span className="font-medium">{formatDate(lastMilestone.date)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">{t('tabs.timeline.forecast.currentForecast')}</span>
                            <span className="font-medium text-orange-600">
                                {(() => {
                                    const d = new Date(lastMilestone.date);
                                    d.setDate(d.getDate() + delayDays);
                                    return formatDate(d);
                                })()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{t('tabs.timeline.forecast.delay')}</span>
                            <CommonBadge
                                status="building"
                                customLabel={t('tabs.timeline.forecast.days', { days: delayDays })}
                                variant="outline"
                                className="bg-orange-100 text-orange-700"
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground">
                        <p className="mb-2 flex items-center gap-2">
                            <Lightbulb className={`${iconSizes.sm} text-yellow-500`} />
                            <strong>{t('tabs.timeline.forecast.tip')}</strong>
                        </p>
                        <p>{t('tabs.timeline.forecast.tipContent')}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}