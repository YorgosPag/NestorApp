'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getIndividualSortedSections } from '@/config/individual-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import { PhotoUploadService } from '@/services/photoUploadService';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

interface IndividualContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleFileChange: (file: File | null) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleUploadedPhotoURL: (photoURL: string) => void;
  handleMultiplePhotosChange: (photos: PhotoSlot[]) => void;
  handleMultiplePhotoUploadComplete: (index: number, result: FileUploadResult) => void;
  handleProfilePhotoSelection: (index: number) => void;
  disabled?: boolean;
}

export function IndividualContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleFileChange,
  handleDrop,
  handleDragOver,
  handleUploadedPhotoURL,
  handleMultiplePhotosChange,
  handleMultiplePhotoUploadComplete,
  handleProfilePhotoSelection,
  disabled = false
}: IndividualContactSectionProps) {
  // Get all individual sections from centralized config
  const sections = getIndividualSortedSections();

  // Use centralized PhotoUploadService instead of duplicate handler


  return (
    <>
      <GenericFormRenderer
        sections={sections}
        formData={formData}
        onChange={handleChange}
        onSelectChange={handleSelectChange}
        disabled={disabled}
      />

      {/* 🎯 Unified Photo Manager για Individual - 6 φωτογραφίες + profile selector */}
      <UnifiedPhotoManager
        contactType="individual"
        formData={formData}
        handlers={{
          handleFileChange,
          handleUploadedPhotoURL,
          handleMultiplePhotosChange,
          handleMultiplePhotoUploadComplete,
          handleProfilePhotoSelection
        }}
        uploadHandlers={{
          photoUploadHandler: PhotoUploadService.handlePhotoUpload
        }}
        disabled={disabled}
        className="mt-4"
      />
    </>
  );
}