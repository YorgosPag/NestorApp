/* eslint-disable design-system/prefer-design-system-imports */

'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface CompletionRowProps {
    completionDate?: string;
}

export function CompletionRow({ completionDate }: CompletionRowProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
    if (!completionDate) return null;

    return (
        <div className="mt-2 pt-2 border-t border-border/50">
            <div className={cn("flex items-center gap-1", typography.special.tertiary)}>
                <Calendar className={iconSizes.xs} />
                <span>{t('timeline.deliveryLabel')} {formatDate(completionDate)}</span>
            </div>
        </div>
    );
}
