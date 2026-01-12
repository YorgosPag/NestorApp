'use client';

/**
 * 🏢 ENTERPRISE: UnitsToolbarMainActions with full i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ToolbarMainActionsProps {
  selectedItemsCount: number;
}

export function ToolbarMainActions({ selectedItemsCount }: ToolbarMainActionsProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const handleNew = () => console.log('Creating new unit...');
  const handleEdit = () => console.log('Editing unit...');
  const handleDelete = () => console.log('Deleting unit...');

  return (
    <div className="flex items-center gap-1 mr-3">
      <ToolbarButton
        tooltip={t('toolbar.actions.new')}
        onClick={handleNew}
        className={`${colors.text.success} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`} // ✅ SEMANTIC: green -> success
      >
        <Plus className={iconSizes.sm} />
      </ToolbarButton>

      <ToolbarButton
        tooltip={t('toolbar.actions.edit')}
        onClick={handleEdit}
        className={`${colors.text.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`} // ✅ SEMANTIC: blue -> info
        disabled={selectedItemsCount === 0}
      >
        <Edit className={iconSizes.sm} />
      </ToolbarButton>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div>
            <ToolbarButton
              tooltip={t('toolbar.actions.delete')}
              className={`${colors.text.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`} // ✅ SEMANTIC: red -> error
              disabled={selectedItemsCount === 0}
            >
              <Trash2 className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialog.deleteConfirmation.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialog.deleteConfirmation.message', { count: selectedItemsCount })}
              {t('dialog.deleteConfirmation.warning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={`${colors.bg.error} ${HOVER_BACKGROUND_EFFECTS.MUTED}`}
            >
              {t('dialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
