"use client";

import React from 'react';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
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
            <CommonBadge
              status="company"
              customLabel="Απαραίτητο"
              variant="destructive"
            />
          )}
          {hasUnsavedChanges && (
            <CommonBadge
              status="company"
              customLabel="Μη αποθηκευμένες αλλαγές"
              variant="outline"
              className="text-orange-600"
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <CommonBadge
            status="company"
            customLabel={categoryBadgeLabel}
            variant="outline"
          />
        </div>
      </div>
      <CardDescription>
        Άρθρο {editedSection.number}: {editedSection.title}
      </CardDescription>
    </>
  );
}
