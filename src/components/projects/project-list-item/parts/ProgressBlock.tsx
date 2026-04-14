
'use client';

import React from 'react';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ProgressBlockProps {
    progress: number;
}

export function ProgressBlock({ progress }: ProgressBlockProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

    return (
        <ThemeProgressBar
            progress={progress}
            label={t('progressBlock.progress')}
            size="md"
            showPercentage
        />
    );
}
