"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, X, Trash2, Edit3, Plus, Copy } from 'lucide-react';

interface ActionsBarProps {
  isEditing: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onAddParagraph?: () => void;
  onDuplicate?: () => void;
  itemType: 'section' | 'article' | 'paragraph';
}

export function ActionsBar({
  isEditing,
  onSave,
  onCancel,
  onDelete,
  onEdit,
  onAddParagraph,
  onDuplicate,
  itemType,
}: ActionsBarProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave}><Save className="h-3 w-3 mr-1" />Αποθήκευση</Button>
        <Button size="sm" variant="outline" onClick={onCancel}><X className="h-3 w-3" /></Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
      <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2"><Edit3 className="h-3 w-3" /></Button>
      {itemType === 'article' && (
        <Button variant="ghost" size="sm" onClick={onAddParagraph} className="h-7 px-2"><Plus className="h-3 w-3" /></Button>
      )}
      {itemType === 'section' && (
        <Button variant="ghost" size="sm" onClick={onDuplicate} className="h-7 px-2"><Copy className="h-3 w-3" /></Button>
      )}
      <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 px-2 text-destructive hover:text-destructive/80"><Trash2 className="h-3 w-3" /></Button>
    </div>
  );
}
