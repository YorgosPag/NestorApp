'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Pencil, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BuildingEditToolbarProps {
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function BuildingEditToolbar({ isEditing, onEdit, onSave, onCancel }: BuildingEditToolbarProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();

  return (
    <div className={cn("flex justify-end items-center", spacing.gap.sm)}>
      {isEditing ? (
        <>
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className={cn(iconSizes.sm, spacing.margin.right.sm)} />
            {t('editToolbar.save')}
          </Button>
          <Button variant="destructive" size="sm" onClick={onCancel}>
            <X className={cn(iconSizes.sm, spacing.margin.right.sm)} />
            {t('editToolbar.cancel')}
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className={cn(iconSizes.sm, spacing.margin.right.sm)} />
          {t('editToolbar.edit')}
        </Button>
      )}
    </div>
  );
}
