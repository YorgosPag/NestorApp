"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, X, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface ActionsBarProps {
  isEditing: boolean;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export function ActionsBar({
  isEditing,
  hasUnsavedChanges,
  onSave,
  onCancel,
  onDelete,
  onClose,
}: ActionsBarProps) {
  const iconSizes = useIconSizes();
  if (isEditing) {
    return (
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button 
          onClick={onSave} 
          disabled={!hasUnsavedChanges}
          className="flex items-center gap-2"
        >
          <Save className={iconSizes.sm} />
          Αποθήκευση
        </Button>
        
        <Button 
          variant="outline" 
          onClick={onCancel}
          className="flex items-center gap-2"
        >
          <X className={iconSizes.sm} />
          Ακύρωση
        </Button>
        
        {onDelete && (
          <Button 
            variant="destructive" 
            onClick={onDelete}
            className="flex items-center gap-2 ml-auto"
          >
            <Trash2 className={iconSizes.sm} />
            Διαγραφή
          </Button>
        )}
      </div>
    );
  }

  if (!isEditing && onClose) {
    return (
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Κλείσιμο
        </Button>
      </div>
    );
  }

  return null;
}
