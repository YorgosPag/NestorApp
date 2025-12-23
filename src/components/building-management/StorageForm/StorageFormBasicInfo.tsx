'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StorageUnit, StorageType } from '@/types/storage';
import { cn } from '@/lib/utils';

interface StorageFormBasicInfoProps {
  formData: Partial<StorageUnit>;
  errors: { [key: string]: string };
  updateField: (field: string, value: any) => void;
  generateAutoCode: () => void;
  formType: StorageType;
}

export function StorageFormBasicInfo({
  formData,
  errors,
  updateField,
  generateAutoCode,
  formType
}: StorageFormBasicInfoProps) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className={iconSizes.md} />
          {t('storage.form.basicInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('storage.form.code')} *</Label>
            <div className="flex gap-2">
              <Input
                value={formData.code || ''}
                onChange={(e) => updateField('code', e.target.value)}
                className={cn(errors.code && "border-red-500")}
                placeholder={formType === 'storage' ? t('storage.form.placeholders.codeStorage') : t('storage.form.placeholders.codeParking')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateAutoCode}
              >
                {t('storage.form.auto')}
              </Button>
            </div>
            {errors.code && <p className="text-sm text-red-500">{errors.code}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('storage.form.status')} *</Label>
            <select
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value)}
              className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="available">{t('storage.status.available')}</option>
              <option value="sold">{t('storage.status.sold')}</option>
              <option value="reserved">{t('storage.status.reserved')}</option>
              <option value="maintenance">{t('storage.status.maintenance')}</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('storage.form.description')} *</Label>
          <Textarea
            value={formData.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            className={cn(errors.description && "border-red-500")}
            placeholder={formType === 'storage' ? t('storage.form.placeholders.descriptionStorage') : t('storage.form.placeholders.descriptionParking')}
            rows={2}
          />
          {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
