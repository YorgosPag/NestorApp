'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { AlertCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function CriticalPathCard() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertCircle className={`${iconSizes.md} text-orange-500`} />
                    {t('tabs.timeline.criticalPath.title')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg dark:bg-orange-950/30">
                        <div>
                            <p className="font-medium text-orange-900 dark:text-orange-300">{t('tabs.timeline.criticalPath.mecInstallations')}</p>
                            <p className="text-sm text-orange-700 dark:text-orange-400">{t('tabs.timeline.criticalPath.affectsDelivery')}</p>
                        </div>
                        <CommonBadge
                            status="company"
                            customLabel={t('tabs.timeline.criticalPath.daysDelay', { days: 5 })}
                            variant="outline"
                            className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg dark:bg-yellow-950/30">
                        <div>
                            <p className="font-medium text-yellow-900 dark:text-yellow-300">{t('tabs.timeline.criticalPath.finalWorks')}</p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">{t('tabs.timeline.criticalPath.dependsOnPrevious')}</p>
                        </div>
                        <CommonBadge
                            status="company"
                            customLabel={t('tabs.timeline.criticalPath.waiting')}
                            variant="outline"
                            className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}