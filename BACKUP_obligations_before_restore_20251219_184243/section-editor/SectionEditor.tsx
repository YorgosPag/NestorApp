"use client";

import React from 'react';
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

export default function SectionEditor({ 
  section, 
  onSave, 
  onDelete, 
  onCancel, 
  isEditing = true 
}: SectionEditorProps) {
  
  const { 
    editedSection, 
    hasUnsavedChanges, 
    updateSection, 
    handleSave, 
    handleCancel 
  } = useSectionEditorState(section, onSave, onCancel);

  const handleDelete = () => {
    if (onDelete) {
      const confirm = window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το άρθρο;');
      if (confirm) {
        onDelete(editedSection.id);
      }
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
          onDelete={onDelete ? handleDelete : undefined}
          onClose={onCancel}
        />
        
        <UnsavedBanner show={hasUnsavedChanges} />
      </CardContent>
    </Card>
  );
}
