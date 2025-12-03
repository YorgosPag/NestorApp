'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getSortedSections } from '@/config/company-gemi-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import { PhotoUploadService } from '@/services/photoUploadService';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

interface CompanyContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleLogoChange: (file: File | null) => void;
  handleFileChange: (file: File | null) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleUploadedPhotoURL: (photoURL: string) => void;
  disabled?: boolean;
}

export function CompanyContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleLogoChange,
  handleFileChange,
  handleUploadedLogoURL,
  handleUploadedPhotoURL,
  disabled = false
}: CompanyContactSectionProps) {
  // Get all company sections from centralized config
  const sections = getSortedSections();

  return (
    <>
      <GenericFormRenderer
        sections={sections}
        formData={formData}
        onChange={handleChange}
        onSelectChange={handleSelectChange}
        disabled={disabled}
      />

      {/* 🎯 Unified Photo Manager για Company - Λογότυπο + Εκπρόσωπος */}
      <UnifiedPhotoManager
        contactType="company"
        formData={formData}
        handlers={{
          handleLogoChange,
          handleFileChange,
          handleUploadedLogoURL,
          handleUploadedPhotoURL
        }}
        uploadHandlers={{
          logoUploadHandler: PhotoUploadService.handleLogoUpload,
          photoUploadHandler: PhotoUploadService.handlePhotoUpload
        }}
        disabled={disabled}
        className="mt-4"
      />
    </>
  );
}