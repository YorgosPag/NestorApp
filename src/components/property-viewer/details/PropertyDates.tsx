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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface PropertyDatesProps {
  dates: ExtendedPropertyDetails['dates'];
}

export function PropertyDates({ dates }: PropertyDatesProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

  if (!dates) return null;

  return (
    <div className={spacing.spaceBetween.sm}>
      <h4 className={`text-xs font-medium flex items-center ${spacing.gap.sm}`}>
        <Calendar className={iconSizes.xs} />
        {t('dates.title')}
      </h4>
      <div className={`${spacing.spaceBetween.sm} text-xs ${colors.text.muted}`}>
        {dates.created && <div>{t('dates.created')} {formatDate(new Date(dates.created))}</div>}
        {dates.updated && <div>{t('dates.updated')} {formatDate(new Date(dates.updated))}</div>}
        {dates.available && (
          <div>{t('dates.availability')} {formatDate(new Date(dates.available))}</div>
        )}
      </div>
    </div>
  );
}
