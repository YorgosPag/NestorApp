'use client';

import React from 'react';
import type { Building } from '@/types/building/contracts';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageTabProps {
  building: Building;
}

export function StorageTab({ building }: StorageTabProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('storage');

  return (
    <div className="p-4">
      <h3>{t('storages.header.title')} - {building.name}</h3>
      <p>{t('storages.header.subtitle')}</p>
    </div>
  );
}

export default StorageTab;