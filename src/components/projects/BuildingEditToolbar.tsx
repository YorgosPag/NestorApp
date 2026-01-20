'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Pencil, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
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

  return (
    <div className="flex justify-end items-center gap-2">
      {isEditing ? (
        <>
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className={`${iconSizes.sm} mr-2`} />
            {t('editToolbar.save')}
          </Button>
          <Button variant="destructive" size="sm" onClick={onCancel}>
            <X className={`${iconSizes.sm} mr-2`} />
            {t('editToolbar.cancel')}
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className={`${iconSizes.sm} mr-2`} />
          {t('editToolbar.edit')}
        </Button>
      )}
    </div>
  );
}
