'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

const BUILDING_CATEGORIES = ['residential', 'commercial', 'mixed', 'industrial'] as const;

interface BasicInfoCardProps {
    /** ADR-233 §3.4: `code` is the locked building identifier ("Κτήριο Α"). Read-only. */
    formData: { code?: string; name: string; description: string; category?: string };
    updateField: (field: string, value: string | number) => void;
    isEditing: boolean;
    errors: { [key: string]: string };
}

export function BasicInfoCard({ formData, updateField, isEditing, errors }: BasicInfoCardProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
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
        {/* 🏢 ADR-233 §3.4: locked building code, read-only — auto-suggested per project */}
        <div className="space-y-2">
          <Label>{t('tabs.general.basicInfo.buildingCode')}</Label>
          <Input
            value={formData.code ?? ''}
            readOnly
            placeholder={t('tabs.general.basicInfo.buildingCodePlaceholder')}
            className="bg-muted"
          />
        </div>

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
          <Label>{t('tabs.general.basicInfo.category')}</Label>
          <Select
            value={formData.category || ''}
            onValueChange={(value) => updateField('category', value)}
            disabled={!isEditing}
          >
            <SelectTrigger className={cn(!isEditing && 'bg-muted')}>
              <SelectValue placeholder={t('tabs.general.basicInfo.categoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {t(`categories.${cat}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <div className={cn("text-xs text-right", colors.text.muted)}>
            {t('tabs.general.basicInfo.charactersCount', { count: formData.description.length })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
