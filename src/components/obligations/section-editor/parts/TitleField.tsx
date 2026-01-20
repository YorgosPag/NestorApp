"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import type { FieldUpdate } from '../types';

interface TitleFieldProps {
  isEditing: boolean;
  titleValue: string;
  onChange: FieldUpdate;
}

export function TitleField({
  isEditing,
  titleValue,
  onChange,
}: TitleFieldProps) {
  const { t } = useTranslation('obligations');

  return (
    <div className="space-y-2">
      <Label htmlFor="section-title">{t('article.titleLabel')}</Label>
      <Input
        id="section-title"
        value={titleValue}
        onChange={(e) => onChange('title', e.target.value)}
        disabled={!isEditing}
        placeholder={t('article.titleInputPlaceholder')}
      />
    </div>
  );
}
