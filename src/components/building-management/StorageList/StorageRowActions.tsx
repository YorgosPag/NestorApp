'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Pencil, Unlink2, Trash2, Loader2 } from 'lucide-react';
import type { StorageUnit } from '@/types/storage';

interface StorageRowActionsProps {
  unit: StorageUnit;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (unitId: string) => void;
  deletingId?: string | null;
  unlinkingId?: string | null;
  onUnlink?: (unit: StorageUnit) => void;
}

export function StorageRowActions({ unit, onEdit, onDelete, deletingId, unlinkingId, onUnlink }: StorageRowActionsProps) {
  return (
    <nav className="flex justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Προβολή</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(unit)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Επεξεργασία</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-amber-600 hover:text-amber-700"
            onClick={() => onUnlink?.(unit)}
            disabled={unlinkingId === unit.id}
          >
            {unlinkingId === unit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink2 className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Αποσύνδεση</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(unit.id)}
            disabled={deletingId === unit.id}
          >
            {deletingId === unit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Διαγραφή</TooltipContent>
      </Tooltip>
    </nav>
  );
}
