"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, X, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ActionsBarProps {
  isEditing: boolean;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export function ActionsBar({
  isEditing,
  hasUnsavedChanges,
  onSave,
  onCancel,
  onDelete,
  onClose,
}: ActionsBarProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('common');

  if (isEditing) {
    return (
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button
          onClick={onSave}
          disabled={!hasUnsavedChanges}
          className="flex items-center gap-2"
        >
          <Save className={iconSizes.sm} />
          {t('buttons.save')}
        </Button>

        <Button
          variant="outline"
          onClick={onCancel}
          className="flex items-center gap-2"
        >
          <X className={iconSizes.sm} />
          {t('buttons.cancel')}
        </Button>

        {onDelete && (
          <Button
            variant="destructive"
            onClick={onDelete}
            className="flex items-center gap-2 ml-auto"
          >
            <Trash2 className={iconSizes.sm} />
            {t('buttons.delete')}
          </Button>
        )}
      </div>
    );
  }

  if (!isEditing && onClose) {
    return (
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          {t('buttons.close')}
        </Button>
      </div>
    );
  }

  return null;
}
