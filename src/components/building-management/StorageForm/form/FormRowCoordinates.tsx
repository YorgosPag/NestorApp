'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface Props {
  x: number;
  y: number;
  onChange: (coords: { x: number, y: number }) => void;
}

export function FormRowCoordinates({ x, y, onChange }: Props) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');

  return (
    <div className="space-y-2">
      <Label>{t('storage.form.specs.labels.coordinates')}</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          value={x}
          onChange={(e) => onChange({ x: parseFloat(e.target.value) || 0, y })}
          placeholder="X"
        />
        <Input
          type="number"
          value={y}
          onChange={(e) => onChange({ x, y: parseFloat(e.target.value) || 0 })}
          placeholder="Y"
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('storage.form.specs.helpers.coordinates')}</p>
    </div>
  );
}
