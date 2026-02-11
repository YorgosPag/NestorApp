"use client";

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export const ObligationEditForm = () => {
  const { t } = useTranslation('obligations');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t('legacyForms.editTitle')}</h1>
      <p className="text-muted-foreground">{t('legacyForms.editDescription')}</p>
    </div>
  );
};

export default ObligationEditForm;

