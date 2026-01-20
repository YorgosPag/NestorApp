"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useSectionEditorState } from './hooks/useSectionEditorState';
import { categoryLabels } from './constants';
import { HeaderBar } from './parts/HeaderBar';
import { BasicInfoFields } from './parts/BasicInfoFields';
import { TitleField } from './parts/TitleField';
import { CategoryRequiredFields } from './parts/CategoryRequiredFields';
import { ContentEditor } from './parts/ContentEditor';
import { ActionsBar } from './parts/ActionsBar';
import { UnsavedBanner } from './parts/UnsavedBanner';
import type { SectionEditorProps } from './types';
import { WarningConfirmDialog } from '@/components/ui/ConfirmDialog'; // 🏢 ENTERPRISE: Centralized modal confirmation
import { useTranslation } from '@/i18n/hooks/useTranslation'; // 🏢 ENTERPRISE: i18n support

export default function SectionEditor({
  section,
  onSave,
  onDelete,
  onCancel,
  isEditing = true
}: SectionEditorProps) {
  const { t } = useTranslation('common'); // 🏢 ENTERPRISE: i18n translation

  const {
    editedSection,
    hasUnsavedChanges,
    updateSection,
    handleSave,
    handleCancel
  } = useSectionEditorState(section, onSave, onCancel);

  // =========================================================================
  // DELETE CONFIRMATION STATE - 🏢 ENTERPRISE: Modal dialog (center screen)
  // =========================================================================
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  /**
   * 🏢 ENTERPRISE: Opens delete confirmation modal (center screen)
   * Replaces showConfirmDialog (toast) with proper AlertDialog modal
   */
  const handleDeleteClick = () => {
    if (onDelete) {
      setDeleteConfirmOpen(true);
    }
  };

  /**
   * 🏢 ENTERPRISE: Executes delete after user confirms in modal
   */
  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete(editedSection.id);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <HeaderBar
          isEditing={isEditing}
          editedSection={editedSection}
          hasUnsavedChanges={hasUnsavedChanges}
          categoryBadgeLabel={categoryLabels[editedSection.category]}
        />
      </CardHeader>
      
      <CardContent className="space-y-6">
        <BasicInfoFields
          isEditing={isEditing}
          numberValue={editedSection.number}
          orderValue={editedSection.order}
          onChange={updateSection}
        />
        
        <TitleField
          isEditing={isEditing}
          titleValue={editedSection.title}
          onChange={updateSection}
        />

        <CategoryRequiredFields
          isEditing={isEditing}
          category={editedSection.category}
          isRequired={editedSection.isRequired}
          categoryLabels={categoryLabels}
          onChange={updateSection}
        />

        <ContentEditor
          value={editedSection.content}
          onChange={(content) => updateSection('content', content)}
        />
        
        <ActionsBar
          isEditing={isEditing}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={onDelete ? handleDeleteClick : undefined}
          onClose={onCancel}
        />
        
        <UnsavedBanner show={hasUnsavedChanges} />

        {/* 🏢 ENTERPRISE: Centralized Delete Confirmation Modal (center screen) */}
        <WarningConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title={t('obligations.deleteTitle', 'Διαγραφή Άρθρου')}
          description={t('obligations.deleteConfirm', 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το άρθρο;')}
          onConfirm={handleDeleteConfirm}
          confirmText={t('buttons.delete', 'Διαγραφή')}
          cancelText={t('buttons.cancel', 'Ακύρωση')}
        />
      </CardContent>
    </Card>
  );
}
