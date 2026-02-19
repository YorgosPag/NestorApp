'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BasicInfoCardProps {
    formData: { name: string; description: string };
    updateField: (field: string, value: string | number) => void;
    isEditing: boolean;
    errors: { [key: string]: string };
}

export function BasicInfoCard({ formData, updateField, isEditing, errors }: BasicInfoCardProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const typography = useTypography();
  return (
    <Card>
      <CardHeader className="p-2">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
          {t('tabs.general.basicInfo.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-2">
        <div className="space-y-2">
          <Label>{t('tabs.general.basicInfo.buildingTitle')}</Label>
          <Input
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            disabled={!isEditing}
            className={cn(!isEditing && "bg-muted", errors.name && getStatusBorder('error'))}
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('tabs.general.basicInfo.description')}</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            disabled={!isEditing}
            className={cn(!isEditing && "bg-muted")}
            rows={3}
            placeholder={t('tabs.general.basicInfo.descriptionPlaceholder')}
          />
          <div className="text-xs text-muted-foreground text-right">
            {t('tabs.general.basicInfo.charactersCount', { count: formData.description.length })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
