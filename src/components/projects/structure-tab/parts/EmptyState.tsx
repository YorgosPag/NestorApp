'use client';

import React from 'react';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function EmptyState({ projectId }: { projectId: number }) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  return (
    <div className="p-4 text-center">
      <div className="text-gray-500 mb-2">{t('structure.notFound')}</div>
      <div className="text-sm text-gray-400">Project ID: {projectId}</div>
    </div>
  );
}
