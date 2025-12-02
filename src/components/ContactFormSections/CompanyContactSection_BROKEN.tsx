'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getSortedSections } from '@/config/company-gemi-config';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { PhotoUploadService } from '@/services/photo-upload.service';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

interface CompanyContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleLogoChange: (file: File | null) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  disabled?: boolean;
}

export function CompanyContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleLogoChange,
  handleUploadedLogoURL,
  disabled = false
}: CompanyContactSectionProps) {
  // 🚨 COMPONENT RENDER TEST
  console.log('🧪 RENDER TEST: CompanyContactSection is rendering now!', { timestamp: new Date().getTime() });

  // Get all company GEMI sections from centralized config
  const sections = getSortedSections();

  // DEBUG LOG - inside function body
  console.log('🔍 DEBUG: handleEnterpriseLogoUpload will be created...');

  // 🔥 Enterprise Logo Upload Handler με Compression
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

  // 🔗 Upload Complete Handler - ενημέρωσε το formData με το uploaded URL
  const handleLogoUploadComplete = (result: FileUploadResult) => {
    console.log('🎯🏢 COMPANY: Logo upload complete, updating formData με uploaded URL:', result.url);

    // ✅ FIXED: Χρησιμοποιούμε το centralized handler από useContactForm
    // Αυτό θα ενημερώσει σωστά το formData.logoPreview με το uploaded URL
    handleUploadedLogoURL(result.url);
  };

  // DEBUG LOG - after function definitions
  console.log('🔍 DEBUG: handleEnterpriseLogoUpload exists?', !!handleEnterpriseLogoUpload);
  console.log('🔍 DEBUG: typeof handleEnterpriseLogoUpload:', typeof handleEnterpriseLogoUpload);

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
        purpose="logo"
        maxSize={5 * 1024 * 1024} // 5MB for company logos
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
    </>
  );
}