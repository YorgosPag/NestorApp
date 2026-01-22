'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';
import { formatDate } from '@/lib/intl-utils'; // ✅ Using centralized function
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

interface PropertyDatesProps {
  dates: ExtendedPropertyDetails['dates'];
}

export function PropertyDates({ dates }: PropertyDatesProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  if (!dates) return null;

  return (
    <div className={spacing.spaceBetween.sm}>
      <h4 className={`text-xs font-medium flex items-center ${spacing.gap.sm}`}>
        <Calendar className={iconSizes.xs} />
        {t('dates.title')}
      </h4>
      <div className={`${spacing.spaceBetween.sm} text-xs text-muted-foreground`}>
        {dates.created && <div>{t('dates.created')} {formatDate(new Date(dates.created))}</div>}
        {dates.updated && <div>{t('dates.updated')} {formatDate(new Date(dates.updated))}</div>}
        {dates.available && (
          <div>{t('dates.availability')} {formatDate(new Date(dates.available))}</div>
        )}
      </div>
    </div>
  );
}
