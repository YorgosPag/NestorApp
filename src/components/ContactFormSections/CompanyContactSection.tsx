'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getSortedSections } from '@/config/company-gemi-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
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

  // 🔥 Enterprise Logo Upload Handler για Εταιρεία (SIMPLIFIED από Individual)
  const handleEnterpriseLogoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {

    // 🔙 OLD WORKING SYSTEM: Direct Base64 conversion (SAME AS INDIVIDUAL)
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


    return result;
  };

  // 🔥 Simple Photo Upload Handler για Representative Photo (SAME AS INDIVIDUAL)
  const handleEnterprisePhotoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {

    // 🔙 OLD WORKING SYSTEM: Direct Base64 conversion (SAME AS INDIVIDUAL)
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

    return result;
  };

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
          logoUploadHandler: handleEnterpriseLogoUpload,
          photoUploadHandler: handleEnterprisePhotoUpload
        }}
        disabled={disabled}
        className="mt-4"
      />
    </>
  );
}