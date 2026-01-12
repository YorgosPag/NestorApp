'use client';

/**
 * 🏢 ENTERPRISE: ContactsToolbarMainActions with full i18n support
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
} from "@/components/ui/alert-dialog";
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Plus, Edit, Trash2 } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ToolbarMainActionsProps {
  selectedItemsCount: number;
}

export function ToolbarMainActions({ selectedItemsCount }: ToolbarMainActionsProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const handleNew = () => {
    // Debug logging removed
  };
  const handleEdit = () => {
    // Debug logging removed
  };
  const handleDelete = () => {
    // Debug logging removed
  };

  return (
    <div className="flex items-center gap-1 mr-3">
      <ToolbarButton
        tooltip={t('toolbar.actions.new')}
        onClick={handleNew}
        className={`text-green-600 dark:text-green-500 ${HOVER_TEXT_EFFECTS.GREEN_SUBTLE} ${HOVER_BACKGROUND_EFFECTS.GREEN_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
      >
        <Plus className={iconSizes.sm} />
      </ToolbarButton>

      <ToolbarButton
        tooltip={t('toolbar.actions.edit')}
        onClick={handleEdit}
        className={`text-blue-600 dark:text-blue-500 ${HOVER_TEXT_EFFECTS.BLUE_SUBTLE} ${HOVER_BACKGROUND_EFFECTS.BLUE_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
        disabled={selectedItemsCount === 0}
      >
        <Edit className={iconSizes.sm} />
      </ToolbarButton>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div>
            <ToolbarButton
              tooltip={t('toolbar.actions.delete')}
              className={`text-red-600 dark:text-red-500 ${HOVER_TEXT_EFFECTS.RED_SUBTLE} ${HOVER_BACKGROUND_EFFECTS.RED_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
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
              className={`bg-red-600 ${HOVER_BACKGROUND_EFFECTS.RED_DARKER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
            >
              {t('dialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
