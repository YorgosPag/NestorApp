'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getCompanySortedSections } from '@/config/company-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import { generateContactFileWithCustomName, logFilenameGeneration } from '@/utils/contact-filename-generator';

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
  const sections = getCompanySortedSections();

  // 🔥 Enterprise Logo Upload Handler για Εταιρεία
  const handleEnterpriseLogoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    // 🏷️ Χρήση κεντρικοποιημένης λειτουργικότητας filename generation
    const { customFilename, customFile, originalFilename } = generateContactFileWithCustomName({
      originalFile: file,
      contactData: formData,
      fileType: 'logo'
    });

    // 📝 Centralized logging
    logFilenameGeneration(originalFilename, customFilename, formData, 'logo');

    console.log('🚀🏢 COMPANY: Starting enterprise logo upload με centralized filename...', {
      originalFileName: originalFilename,
      customFileName: customFilename,
      fileSize: file.size,
      fileType: file.type
    });

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

    console.log('✅🏢 COMPANY: Enterprise logo upload completed:', {
      url: result.url,
      originalSize: result.compressionInfo?.originalSize,
      compressedSize: result.compressionInfo?.compressedSize,
      savings: result.compressionInfo?.compressionRatio
    });

    return result;
  };

  // 🔥 Enterprise Photo Upload Handler για Representative Photo
  const handleEnterprisePhotoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    // 🏷️ Χρήση κεντρικοποιημένης λειτουργικότητας filename generation
    const { customFilename, customFile, originalFilename } = generateContactFileWithCustomName({
      originalFile: file,
      contactData: formData,
      fileType: 'representative'
    });

    // 📝 Centralized logging
    logFilenameGeneration(originalFilename, customFilename, formData, 'representative');

    console.log('🚀🏢 COMPANY: Starting enterprise photo upload με centralized filename...', {
      originalFileName: originalFilename,
      customFileName: customFilename,
      fileSize: file.size,
      fileType: file.type
    });

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

    console.log('✅🏢 COMPANY: Enterprise photo upload completed:', {
      url: result.url,
      originalSize: result.compressionInfo?.originalSize,
      compressedSize: result.compressionInfo?.compressedSize,
      savings: result.compressionInfo?.compressionRatio
    });

    return result;
  };

  // 🔗 Logo Upload Complete Handler - ενημέρωσε το formData
  const handleLogoUploadComplete = (result: FileUploadResult) => {
    console.log('🎯🏢 COMPANY: Logo upload complete, updating formData με uploaded URL:', result.url);

    // ✅ FIXED: Χρησιμοποιούμε το centralized handler από useContactForm
    handleUploadedLogoURL(result.url);
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