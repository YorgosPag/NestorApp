'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface TimelineHeaderProps {
    milestones: { status: string }[];
}

export function TimelineHeader({ milestones }: TimelineHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const colors = useSemanticColors();
    const completedCount = milestones.filter(m => m.status === 'completed').length;

    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
                <h3 className="text-lg font-semibold">{t('tabs.timeline.header.title')}</h3>
                <p className={cn("text-sm", colors.text.muted)}>
                    {t('tabs.timeline.header.subtitle')}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <CommonBadge
                  status="company"
                  customLabel={t('tabs.timeline.header.completedCount', { completed: completedCount, total: milestones.length })}
                  variant="outline"
                  size="sm"
                  className="bg-[hsl(var(--bg-success))]/10 text-[hsl(var(--text-success))]"
                />
            </div>
        </div>
    );
}