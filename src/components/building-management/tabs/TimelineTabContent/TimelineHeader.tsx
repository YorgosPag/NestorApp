'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface TimelineHeaderProps {
    milestones: { status: string }[];
}

export function TimelineHeader({ milestones }: TimelineHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const completedCount = milestones.filter(m => m.status === 'completed').length;

    return (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold">{t('tabs.timeline.header.title')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('tabs.timeline.header.subtitle')}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <CommonBadge
                  status="company"
                  customLabel={t('tabs.timeline.header.completedCount', { completed: completedCount, total: milestones.length })}
                  variant="outline"
                  size="sm"
                  className="bg-green-50 text-green-700"
                />
            </div>
        </div>
    );
}