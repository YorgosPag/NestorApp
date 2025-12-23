'use client';

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
import { useTranslation } from "@/i18n";
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

interface ToolbarMainActionsProps {
  selectedItemsCount: number;
}

export function ToolbarMainActions({ selectedItemsCount }: ToolbarMainActionsProps) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  
  const handleNewBuilding = () => {
    console.log('Creating new building...');
  };

  const handleEditBuilding = () => {
    console.log('Editing building...');
  };

  const handleDeleteBuilding = () => {
    console.log('Deleting building...');
  };

  return (
    <div className="flex items-center gap-1 mr-3">
      <ToolbarButton
        tooltip={t('toolbar.actions.new')}
        onClick={handleNewBuilding}
        className={INTERACTIVE_PATTERNS.SUCCESS_HOVER}
      >
        <Plus className={iconSizes.sm} />
      </ToolbarButton>

      <ToolbarButton
        tooltip={t('toolbar.actions.edit')}
        onClick={handleEditBuilding}
        className={INTERACTIVE_PATTERNS.PRIMARY_HOVER}
        disabled={selectedItemsCount === 0}
      >
        <Edit className={iconSizes.sm} />
      </ToolbarButton>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div>
            <ToolbarButton
              tooltip={t('toolbar.actions.delete')}
              className={INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}
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
              onClick={handleDeleteBuilding}
              className={INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}
            >
              {t('dialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
