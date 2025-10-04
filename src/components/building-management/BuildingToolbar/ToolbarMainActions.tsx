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

interface ToolbarMainActionsProps {
  selectedItemsCount: number;
}

export function ToolbarMainActions({ selectedItemsCount }: ToolbarMainActionsProps) {
  const { t } = useTranslation('properties');
  
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
        className="text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
      >
        <Plus className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        tooltip={t('toolbar.actions.edit')}
        onClick={handleEditBuilding}
        className="text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
        disabled={selectedItemsCount === 0}
      >
        <Edit className="w-4 h-4" />
      </ToolbarButton>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div>
            <ToolbarButton
              tooltip={t('toolbar.actions.delete')}
              className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
              disabled={selectedItemsCount === 0}
            >
              <Trash2 className="w-4 h-4" />
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
              className="bg-red-600 hover:bg-red-700"
            >
              {t('dialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
