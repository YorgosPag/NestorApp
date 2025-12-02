'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getCompanySortedSections } from '@/config/company-config';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import { PhotoUploadService } from '@/services/photo-upload.service';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

interface CompanyContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleLogoChange: (file: File | null) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleMultiplePhotosChange: (photos: PhotoSlot[]) => void;
  handleMultiplePhotoUploadComplete: (index: number, result: FileUploadResult) => void;
  disabled?: boolean;
}

export function CompanyContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleLogoChange,
  handleUploadedLogoURL,
  handleMultiplePhotosChange,
  handleMultiplePhotoUploadComplete,
  disabled = false
}: CompanyContactSectionProps) {
  // Get all company sections from centralized config
  const sections = getCompanySortedSections();

  // 🔥 Enterprise Logo Upload Handler για Εταιρεία
  const handleEnterpriseLogoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀🏢 COMPANY: Starting enterprise logo upload με compression...', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const result = await PhotoUploadService.uploadCompanyLogo(
      file,
      undefined, // companyId - θα προστεθεί αργότερα όταν save-άρουμε
      onProgress
    );

    console.log('✅🏢 COMPANY: Enterprise logo upload completed:', {
      url: result.url,
      originalSize: result.compressionInfo?.originalSize,
      compressedSize: result.compressionInfo?.compressedSize,
      savings: result.compressionInfo?.compressionRatio
    });

    return result;
  };

  // 🔥 Enterprise Photo Upload Handler για Multiple Photos
  const handleEnterprisePhotoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀🏢 COMPANY: Starting enterprise photo upload για Company Gallery με compression...', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const result = await PhotoUploadService.uploadContactPhoto(
      file,
      undefined, // contactId - θα προστεθεί αργότερα όταν save-άρουμε
      onProgress,
      'profile-modal' // Smart compression για company gallery
    );

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

      {/* Enterprise Logo Upload */}
      <EnterprisePhotoUpload
        purpose="logo"
        maxSize={5 * 1024 * 1024} // 5MB for logos
        photoFile={formData.logoFile}
        photoPreview={formData.logoPreview}
        onFileChange={handleLogoChange}
        uploadHandler={handleEnterpriseLogoUpload}
        onUploadComplete={handleLogoUploadComplete}
        disabled={disabled}
        compact={true}
        showProgress={true}
        className="mt-4"
      />

      {/* Multiple Photos Upload για Εταιρεία */}
      <MultiplePhotosUpload
        maxPhotos={5}
        photos={formData.multiplePhotos}
        onPhotosChange={handleMultiplePhotosChange}
        onPhotoUploadComplete={handleMultiplePhotoUploadComplete}
        uploadHandler={handleEnterprisePhotoUpload}
        disabled={disabled}
        compact={true}
        showProgress={true}
        purpose="photo"
        className="mt-4"
      />
    </>
  );
}