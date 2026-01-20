'use client';

import React from 'react';
import UnifiedInbox from '../UnifiedInbox';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';


export function CommunicationsTab() {
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('crm');
  return (
    <div className={`${colors.bg.primary} rounded-lg shadow`}>
       <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">{t('dashboard.communicationsArchive.title')}</h2>
      </div>
      <div className="p-6">
        <UnifiedInbox />
      </div>
    </div>
  );
}
