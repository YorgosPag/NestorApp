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

interface ToolbarMainActionsProps {
  selectedItemsCount: number;
}

export function ToolbarMainActions({ selectedItemsCount }: ToolbarMainActionsProps) {
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
        tooltip="Νέα Επαφή (Ctrl+N)"
        onClick={handleNew}
        className="text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
      >
        <Plus className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        tooltip="Επεξεργασία Επιλεγμένης (Ctrl+E)"
        onClick={handleEdit}
        className="text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
        disabled={selectedItemsCount === 0}
      >
        <Edit className="w-4 h-4" />
      </ToolbarButton>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div>
            <ToolbarButton
              tooltip="Διαγραφή Επιλεγμένης (Delete)"
              className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
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
              Είστε σίγουροι ότι θέλετε να διαγράψετε {selectedItemsCount} επαφή/ές;
              Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
