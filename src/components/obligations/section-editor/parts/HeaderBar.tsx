"use client";

import React from 'react';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ObligationSection } from '@/types/obligations';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  const { t } = useTranslation('obligations');

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">
            {isEditing ? t('sectionEditor.header.edit') : t('sectionEditor.header.preview')}
          </CardTitle>
          {editedSection.isRequired && (
            <Badge variant="destructive">{t('section.required')}</Badge>
          )}
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600">
              {t('sectionEditor.header.unsavedChanges')}
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
        {t('sectionEditor.header.articlePrefix')} {editedSection.number}: {editedSection.title}
      </CardDescription>
    </>
  );
}

