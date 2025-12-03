'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getIndividualSortedSections } from '@/config/individual-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
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

  // 🔥 Enterprise Upload Handler με Compression
  const handleEnterpriseUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {

    // 🔙 OLD WORKING SYSTEM: Direct Base64 conversion
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
          photoUploadHandler: handleEnterpriseUpload
        }}
        disabled={disabled}
        className="mt-4"
      />
    </>
  );
}