'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Pencil, X } from 'lucide-react';

interface BuildingEditToolbarProps {
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function BuildingEditToolbar({ isEditing, onEdit, onSave, onCancel }: BuildingEditToolbarProps) {
  return (
    <div className="flex justify-end items-center gap-2">
      {isEditing ? (
        <>
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />
            Αποθήκευση
          </Button>
          <Button variant="destructive" size="sm" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Ακύρωση
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-2" />
          Επεξεργασία
        </Button>
      )}
    </div>
  );
}
