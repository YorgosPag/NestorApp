// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldUpdate } from '../types';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BasicInfoFieldsProps {
  isEditing: boolean;
  numberValue: string;
  orderValue: number;
  onChange: FieldUpdate;
}

export function BasicInfoFields({
  isEditing,
  numberValue,
  orderValue,
  onChange,
}: BasicInfoFieldsProps) {
  const { t } = useTranslation('obligations');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="section-number">{t('section.articleNumber')}</Label>
        <Input
          id="section-number"
          value={numberValue}
          onChange={(e) => onChange('number', e.target.value)}
          disabled={!isEditing}
          placeholder={t('section.articleNumberPlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="section-order">{t('section.order')}</Label>
        <Input
          id="section-order"
          type="number"
          value={orderValue}
          onChange={(e) => onChange('order', parseInt(e.target.value) || 0)}
          disabled={!isEditing}
          min={0}
        />
      </div>
    </div>
  );
}

