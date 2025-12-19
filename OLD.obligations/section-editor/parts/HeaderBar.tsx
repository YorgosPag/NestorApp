"use client";

import React from 'react';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ObligationSection } from '@/types/obligations';

interface HeaderBarProps {
  isEditing: boolean;
  editedSection: ObligationSection;
  hasUnsavedChanges: boolean;
  categoryBadgeLabel: string;
}

export function HeaderBar({
  isEditing,
  editedSection,
  hasUnsavedChanges,
  categoryBadgeLabel,
}: HeaderBarProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">
            {isEditing ? 'Επεξεργασία Άρθρου' : 'Προβολή Άρθρου'}
          </CardTitle>
          {editedSection.isRequired && (
            <Badge variant="destructive">Απαραίτητο</Badge>
          )}
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600">
              Μη αποθηκευμένες αλλαγές
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {categoryBadgeLabel}
          </Badge>
        </div>
      </div>
      <CardDescription>
        Άρθρο {editedSection.number}: {editedSection.title}
      </CardDescription>
    </>
  );
}
