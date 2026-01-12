'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Info } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { StorageUnit, StorageType } from '@/types/storage';
import { cn } from '@/lib/utils';

interface StorageFormBasicInfoProps {
  formData: Partial<StorageUnit>;
  errors: { [key: string]: string };
  updateField: (field: string, value: string | number) => void;
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
  const { getStatusBorder } = useBorderTokens();

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
                className={cn(errors.code && getStatusBorder('error'))}
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
            <Select value={formData.status} onValueChange={(val) => updateField('status', val)}>
              <SelectTrigger>
                <SelectValue placeholder={t('storage.status.available')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{t('storage.status.available')}</SelectItem>
                <SelectItem value="sold">{t('storage.status.sold')}</SelectItem>
                <SelectItem value="reserved">{t('storage.status.reserved')}</SelectItem>
                <SelectItem value="maintenance">{t('storage.status.maintenance')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('storage.form.description')} *</Label>
          <Textarea
            value={formData.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            className={cn(errors.description && getStatusBorder('error'))}
            placeholder={formType === 'storage' ? t('storage.form.placeholders.descriptionStorage') : t('storage.form.placeholders.descriptionParking')}
            rows={2}
          />
          {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
