'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Edit, Trash2, MoreVertical } from 'lucide-react';
import type { StorageUnit } from '@/types/storage';

interface StorageRowActionsProps {
  unit: StorageUnit;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (unitId: string) => void;
}

export function StorageRowActions({ unit, onEdit, onDelete }: StorageRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(unit)}>
          <Eye className="w-4 h-4 mr-2" />
          Προβολή
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(unit)}>
          <Edit className="w-4 h-4 mr-2" />
          Επεξεργασία
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(unit.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Διαγραφή
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
