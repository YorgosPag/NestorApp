"use client";

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export const ObligationForm = () => {
  const { t } = useTranslation('obligations');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{t('legacyForms.newTitle')}</h1>
      <p className="text-muted-foreground">{t('legacyForms.newDescription')}</p>
    </div>
  );
};

export default ObligationForm;

