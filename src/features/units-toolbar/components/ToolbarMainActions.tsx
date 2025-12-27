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
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface ToolbarMainActionsProps {
  selectedItemsCount: number;
}

export function ToolbarMainActions({ selectedItemsCount }: ToolbarMainActionsProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const handleNew = () => console.log('Creating new unit...');
  const handleEdit = () => console.log('Editing unit...');
  const handleDelete = () => console.log('Deleting unit...');

  return (
    <div className="flex items-center gap-1 mr-3">
      <ToolbarButton
        tooltip="Νέα Μονάδα (Ctrl+N)"
        onClick={handleNew}
        className={`${colors.text.success} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`} // ✅ SEMANTIC: green -> success
      >
        <Plus className={iconSizes.sm} />
      </ToolbarButton>

      <ToolbarButton
        tooltip="Επεξεργασία Επιλεγμένης (Ctrl+E)"
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
              tooltip="Διαγραφή Επιλεγμένης (Delete)"
              className={`${colors.text.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`} // ✅ SEMANTIC: red -> error
              disabled={selectedItemsCount === 0}
            >
              <Trash2 className={iconSizes.sm} />
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
