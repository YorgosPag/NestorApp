'use client';

import React from 'react';
import { GenericFormTabRenderer } from '@/components/generic';
import { getSortedSections } from '@/config/company-gemi-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

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

  // 🔥 Enterprise Logo Upload Handler για Company (SAME AS CompanyContactSection)
  const handleEnterpriseLogoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀🏢 COMPANY TABBED: Starting logo upload με simple Base64 conversion...');

    const result = await new Promise<FileUploadResult>((resolve, reject) => {
      const reader = new FileReader();
      onProgress({ progress: 0, bytesTransferred: 0, totalBytes: file.size });

      reader.onload = (e) => {
        const base64URL = e.target?.result as string;
        onProgress({ progress: 100, bytesTransferred: file.size, totalBytes: file.size });
        resolve({
          success: true,
          url: base64URL,
          fileName: file.name,
          compressionInfo: {
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 1.0,
            quality: 1.0
          }
        });
      };

      reader.onerror = () => reject(new Error('Base64 conversion failed'));
      reader.readAsDataURL(file);
    });

    console.log('✅🏢 COMPANY TABBED: Logo upload completed');
    return result;
  };

  // 🔥 Enterprise Photo Upload Handler για Company (SAME AS CompanyContactSection)
  const handleEnterprisePhotoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀🏢 COMPANY TABBED: Starting representative photo upload με simple Base64...');

    const result = await new Promise<FileUploadResult>((resolve, reject) => {
      const reader = new FileReader();
      onProgress({ progress: 0, bytesTransferred: 0, totalBytes: file.size });

      reader.onload = (e) => {
        const base64URL = e.target?.result as string;
        onProgress({ progress: 100, bytesTransferred: file.size, totalBytes: file.size });
        resolve({
          success: true,
          url: base64URL,
          fileName: file.name,
          compressionInfo: {
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 1.0,
            quality: 1.0
          }
        });
      };

      reader.onerror = () => reject(new Error('Base64 conversion failed'));
      reader.readAsDataURL(file);
    });

    console.log('✅🏢 COMPANY TABBED: Representative photo upload completed');
    return result;
  };

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
              logoUploadHandler: handleEnterpriseLogoUpload,
              photoUploadHandler: handleEnterprisePhotoUpload
            }}
            disabled={disabled}
            className="mt-4"
          />
        )
      }}
    />
  );
}