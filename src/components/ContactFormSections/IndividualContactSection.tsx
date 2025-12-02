'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getIndividualSortedSections } from '@/config/individual-config';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { PhotoUploadService } from '@/services/photo-upload.service';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

interface IndividualContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleFileChange: (file: File | null) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleUploadedPhotoURL: (photoURL: string) => void;
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
  disabled = false
}: IndividualContactSectionProps) {
  // Get all individual sections from centralized config
  const sections = getIndividualSortedSections();

  // 🔥 Enterprise Upload Handler με Compression
  const handleEnterpriseUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀👤 INDIVIDUAL: Starting enterprise upload με compression...');

    const result = await PhotoUploadService.uploadContactPhoto(
      file,
      undefined, // contactId - θα προστεθεί αργότερα όταν save-άρουμε
      onProgress,
      'profile-modal' // Smart compression για profile modal usage
    );

    console.log('✅👤 INDIVIDUAL: Enterprise upload completed:', {
      url: result.url,
      originalSize: result.compressionInfo?.originalSize,
      compressedSize: result.compressionInfo?.compressedSize,
      savings: result.compressionInfo?.compressionRatio
    });

    return result;
  };

  // 🔗 Enterprise Upload Complete Handler - ενημέρωσε το formData με το uploaded URL
  const handlePhotoUploadComplete = (result: FileUploadResult) => {
    console.log('🎯👤 INDIVIDUAL: Photo upload complete, updating formData με uploaded URL:', result.url);

    // ✅ FIXED: Χρησιμοποιούμε το centralized handler από useContactForm
    // Αυτό θα ενημερώσει σωστά το formData.photoPreview με το uploaded URL
    handleUploadedPhotoURL(result.url);
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

      <EnterprisePhotoUpload
        purpose="photo"
        maxSize={5 * 1024 * 1024} // 5MB
        photoFile={formData.photoFile}
        photoPreview={formData.photoPreview}
        onFileChange={handleFileChange}
        uploadHandler={handleEnterpriseUpload}
        onUploadComplete={handlePhotoUploadComplete}
        disabled={disabled}
        compact={true}
        showProgress={true}
        className="mt-4"
      />
    </>
  );
}