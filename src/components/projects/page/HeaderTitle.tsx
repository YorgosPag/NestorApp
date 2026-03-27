/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function HeaderTitle() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-2">
      <div className={`flex ${iconSizes.xl2} items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg`}>
        <NAVIGATION_ENTITIES.project.icon className={`${iconSizes.md} text-white`} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('header.pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('header.pageSubtitle')}
        </p>
      </div>
    </div>
  );
}
