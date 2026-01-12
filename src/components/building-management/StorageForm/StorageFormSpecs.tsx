'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/intl-utils';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { FormRowSelect } from './form/FormRowSelect';
import { FormRowInput } from './form/FormRowInput';
import { FormRowCoordinates } from './form/FormRowCoordinates';
import type { StorageUnit } from '@/types/storage';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface Props {
  formData: Partial<StorageUnit>;
  errors: { [key: string]: string };
  updateField: (field: string, value: string | number) => void;
  isCalculatingPrice: boolean;
  availableFloors: string[];
}

export function StorageFormSpecs({
  formData,
  errors,
  updateField,
  isCalculatingPrice,
  availableFloors,
}: Props) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {/* 🏢 ENTERPRISE: Using centralized storage icon/color */}
          <NAVIGATION_ENTITIES.storage.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.storage.color)} />
          {t('storage.form.specs.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormRowSelect
            label={t('storage.form.specs.labels.floor')}
            value={formData.floor || ''}
            options={availableFloors}
            onChange={(val) => updateField('floor', val)}
            required
          />
          <FormRowInput
            label={t('storage.form.specs.labels.area')}
            value={formData.area || ''}
            onChange={(val) => updateField('area', val)}
            type="number"
            placeholder={t('storage.form.specs.placeholders.area')}
            error={errors.area}
            required
          />
          <FormRowInput
            label={t('storage.form.specs.labels.price')}
            value={formData.price || ''}
            onChange={(val) => updateField('price', val)}
            type="number"
            placeholder={t('storage.form.specs.placeholders.price')}
            error={errors.price}
            required
            trailingElement={isCalculatingPrice ? (
              <AnimatedSpinner size="small" />
            ) : undefined}
            helper={
              formData.area && formData.price && formData.area > 0
                ? `${formatNumber(Math.round(formData.price / formData.area))} €/m²`
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormRowInput
            label={t('storage.form.specs.labels.linkedProperty')}
            value={formData.linkedProperty || ''}
            onChange={(val) => updateField('linkedProperty', val || null)}
            placeholder={t('storage.form.specs.placeholders.linkedProperty')}
            helper={t('storage.form.specs.helpers.linkedProperty')}
          />

          <FormRowCoordinates
            x={formData.coordinates?.x || 0}
            y={formData.coordinates?.y || 0}
            onChange={(coords) => updateField('coordinates', coords)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
