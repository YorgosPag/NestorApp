'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
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
      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm" onClick={(e) => { e.stopPropagation(); }} title="Προβολή">
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Επεξεργασία">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm text-amber-600 hover:text-amber-700" onClick={(e) => { e.stopPropagation(); }} title="Αποσύνδεση">
        <Unlink2 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Διαγραφή">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </nav>
  );
}
