'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Pencil, Unlink2, Trash2 } from 'lucide-react';

interface Props {
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}

export function StorageCardActions({ onEdit, onDelete }: Props) {
  return (
    <nav className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm" onClick={(e) => { e.stopPropagation(); }}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Προβολή</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Επεξεργασία</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm text-amber-600 hover:text-amber-700" onClick={(e) => { e.stopPropagation(); }}>
            <Unlink2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Αποσύνδεση</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Διαγραφή</TooltipContent>
      </Tooltip>
    </nav>
  );
}
