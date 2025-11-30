'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getIndividualSortedSections } from '@/config/individual-config';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface IndividualContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleFileChange: (file: File | null) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  disabled?: boolean;
}

export function IndividualContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleFileChange,
  handleDrop,
  handleDragOver,
  disabled = false
}: IndividualContactSectionProps) {
  // Get all individual sections from centralized config
  const sections = getIndividualSortedSections();

  return (
    <>
      <GenericFormRenderer
        sections={sections}
        formData={formData}
        onChange={handleChange}
        onSelectChange={handleSelectChange}
        disabled={disabled}
      />

      <EnterprisePhotoUpload
        purpose="photo"
        maxSize={5 * 1024 * 1024} // 5MB
        photoFile={formData.photoFile}
        photoPreview={formData.photoPreview}
        onFileChange={handleFileChange}
        disabled={disabled}
      />
    </>
  );
}