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
} from '@/components/ui/alert-dialog';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

interface ToolbarMainActionsProps {
  selectedItemsCount: number;
}

export function ToolbarMainActions({ selectedItemsCount }: ToolbarMainActionsProps) {
  const handleNew = () => console.log('Creating new unit...');
  const handleEdit = () => console.log('Editing unit...');
  const handleDelete = () => console.log('Deleting unit...');

  return (
    <div className="flex items-center gap-1 mr-3">
      <ToolbarButton
        tooltip="Νέα Μονάδα (Ctrl+N)"
        onClick={handleNew}
        className={`text-green-600 dark:text-green-500 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`}
      >
        <Plus className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        tooltip="Επεξεργασία Επιλεγμένης (Ctrl+E)"
        onClick={handleEdit}
        className={`text-blue-600 dark:text-blue-500 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
        disabled={selectedItemsCount === 0}
      >
        <Edit className="w-4 h-4" />
      </ToolbarButton>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div>
            <ToolbarButton
              tooltip="Διαγραφή Επιλεγμένης (Delete)"
              className={`text-red-600 dark:text-red-500 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
              disabled={selectedItemsCount === 0}
            >
              <Trash2 className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Επιβεβαίωση Διαγραφής</AlertDialogTitle>
            <AlertDialogDescription>
              Είστε σίγουροι ότι θέλετε να διαγράψετε {selectedItemsCount} μονάδα/ες;
              Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={`bg-red-600 ${HOVER_BACKGROUND_EFFECTS.MUTED}`}
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
