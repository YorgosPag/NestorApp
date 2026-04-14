'use client';

import React from 'react';
import { FileText, Upload } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function EmptyState() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  return (
    <div className={`flex items-center justify-center h-full ${colors.bg.secondary}`}>
      <div className="text-center space-y-4 max-w-md">
        <FileText className={`${iconSizes['2xl']} ${colors.text.muted} mx-auto`} />
        <div>
          <h3 className={`text-lg font-medium ${colors.text.primary} mb-2`}>
            {t('floorPlan.emptyState.title')}
          </h3>
          <p className={`${colors.text.muted} mb-4`}>
            {t('floorPlan.emptyState.description')}
          </p>
          <div className={`flex items-center justify-center gap-2 text-sm ${colors.text.muted}`}>
            <Upload className={iconSizes.sm} />
            <span>{t('floorPlan.emptyState.uploadHint')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
