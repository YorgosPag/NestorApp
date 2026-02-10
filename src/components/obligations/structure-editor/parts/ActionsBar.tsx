// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, X, Trash2, Edit3, Plus, Copy } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ActionsBarProps {
  isEditing: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onAddParagraph?: () => void;
  onDuplicate?: () => void;
  itemType: 'section' | 'article' | 'paragraph';
}

export function ActionsBar({
  isEditing,
  onSave,
  onCancel,
  onDelete,
  onEdit,
  onAddParagraph,
  onDuplicate,
  itemType,
}: ActionsBarProps) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave}><Save className={`${iconSizes.xs} mr-1`} />{t('buttons.save')}</Button>
        <Button size="sm" variant="outline" onClick={onCancel}><X className={iconSizes.xs} /></Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
      <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2"><Edit3 className={iconSizes.xs} /></Button>
      {itemType === 'article' && (
        <Button variant="ghost" size="sm" onClick={onAddParagraph} className="h-7 px-2"><Plus className={iconSizes.xs} /></Button>
      )}
      {itemType === 'section' && (
        <Button variant="ghost" size="sm" onClick={onDuplicate} className="h-7 px-2"><Copy className={iconSizes.xs} /></Button>
      )}
      <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 px-2 text-destructive hover:text-destructive/80"><Trash2 className={iconSizes.xs} /></Button>
    </div>
  );
}
