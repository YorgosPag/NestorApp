"use client";

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

export const ObligationEditForm = () => {
  const { t } = useTranslation('obligations');
  const colors = useSemanticColors();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t('legacyForms.editTitle')}</h1>
      <p className={colors.text.muted}>{t('legacyForms.editDescription')}</p>
    </div>
  );
};

export default ObligationEditForm;

