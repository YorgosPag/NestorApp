'use client';

import React from 'react';
import { GenericFormTabRenderer } from '@/components/generic';
import { getSortedSections } from '@/config/company-gemi-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import { PhotoUploadService } from '@/services/photoUploadService';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface CompanyContactTabbedSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleLogoChange?: (file: File | null) => void;
  handleFileChange?: (file: File | null) => void;
  handleUploadedLogoURL?: (logoURL: string) => void;
  handleUploadedPhotoURL?: (photoURL: string) => void;
  disabled?: boolean;
}

/**
 * Company Contact Section με tabs
 * Χρησιμοποιεί τα ίδια sections όπως στα Contact Details αλλά σε tab layout
 */
export function CompanyContactTabbedSection({
  formData,
  handleChange,
  handleSelectChange,
  handleLogoChange,
  handleFileChange,
  handleUploadedLogoURL,
  handleUploadedPhotoURL,
  disabled = false
}: CompanyContactTabbedSectionProps) {
  // Get all company GEMI sections from centralized config
  const sections = getSortedSections();

  return (
    <GenericFormTabRenderer
      sections={sections}
      formData={formData}
      onChange={handleChange}
      onSelectChange={handleSelectChange}
      onLogoChange={handleLogoChange}
      disabled={disabled}
      customRenderers={{
        // Custom renderer για το companyPhotos tab - θα περιέχει το UnifiedPhotoManager
        companyPhotos: () => (
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
              logoUploadHandler: (file, onProgress) =>
                PhotoUploadService.handleLogoUpload(file, onProgress, formData),
              photoUploadHandler: (file, onProgress) =>
                PhotoUploadService.handlePhotoUpload(file, onProgress, formData, 'representative')
            }}
            disabled={disabled}
            className="mt-4"
          />
        )
      }}
    />
  );
}