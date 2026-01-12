'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { Target, CheckCircle, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { Building } from '../../BuildingsPageContent';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export default function AnalyticsProgress({ building }: { building: Building }) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('tabs.analytics.progress.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={`text-center p-4 ${quick.card}`}>
                            <div className="text-3xl font-bold text-blue-600 mb-2">{building.progress}%</div>
                            <div className="text-sm text-muted-foreground">{t('tabs.analytics.progress.totalProgress')}</div>
                            <ThemeProgressBar
                              progress={building.progress}
                              label=""
                              size="md"
                              showPercentage={false}
                            />
                        </div>

                        <div className={`text-center p-4 ${quick.card}`}>
                            <div className="text-3xl font-bold text-green-600 mb-2">88%</div>
                            <div className="text-sm text-muted-foreground">{t('tabs.analytics.progress.efficiency')}</div>
                            <ThemeProgressBar
                              progress={88}
                              label=""
                              size="md"
                              showPercentage={false}
                            />
                        </div>

                        <div className={`text-center p-4 ${quick.card}`}>
                            <div className="text-3xl font-bold text-orange-600 mb-2">12</div>
                            <div className="text-sm text-muted-foreground">{t('tabs.analytics.progress.daysDelay')}</div>
                            <div className="mt-2 text-xs text-orange-600">
                                {t('tabs.analytics.progress.withinAcceptableLimits')}
                            </div>
                        </div>
                    </div>

                    <section className={`mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 ${quick.card}`}>
                        <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                            <Target className={`${iconSizes.md} text-blue-600`} />
                            {t('tabs.analytics.progress.forecastsAndRecommendations')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                                    <CheckCircle className={iconSizes.sm} />
                                    {t('tabs.analytics.progress.positivePoints')}
                                </div>
                                <ul className="space-y-1 text-green-600 dark:text-green-500">
                                    <li>• {t('tabs.analytics.progress.positive1')}</li>
                                    <li>• {t('tabs.analytics.progress.positive2')}</li>
                                    <li>• {t('tabs.analytics.progress.positive3')}</li>
                                </ul>
                            </div>
                            <div>
                                <div className="font-medium text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
                                    <AlertTriangle className={iconSizes.sm} />
                                    {t('tabs.analytics.progress.suggestedImprovements')}
                                </div>
                                <ul className="space-y-1 text-orange-600 dark:text-orange-500">
                                    <li>• {t('tabs.analytics.progress.improvement1')}</li>
                                    <li>• {t('tabs.analytics.progress.improvement2')}</li>
                                    <li>• {t('tabs.analytics.progress.improvement3')}</li>
                                </ul>
                            </div>
                        </div>
                    </section>
                </div>
            </CardContent>
        </Card>
    );
}
