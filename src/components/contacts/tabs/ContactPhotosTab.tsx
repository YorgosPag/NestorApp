'use client';

import React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';

interface ContactPhotosTabProps {
  data: Contact;
  additionalData?: {
    formData?: ContactFormData;
    disabled?: boolean;
    setFormData?: (data: ContactFormData) => void;
    onPhotoClick?: (index: number) => void;
  };
}

/**
 * 🏢 ENTERPRISE: Contact Photos Tab
 *
 * Centralized tab για διαχείριση φωτογραφιών επαφής.
 * Χρησιμοποιεί το existing UnifiedPhotoManager.
 */
export function ContactPhotosTab({
  data,
  additionalData,
}: ContactPhotosTabProps) {
  // Extract data from additionalData prop (UniversalTabsRenderer pattern)
  const {
    formData,
    disabled = true,
    setFormData,
    onPhotoClick,
  } = additionalData || {};

  const effectiveFormData = formData || data;

  /** Photo data structure for photo manager */
  interface PhotoData {
    file: File | null;
    preview?: string;
    uploadUrl?: string;
    fileName?: string;
    isUploading: boolean;
    uploadProgress: number;
    error?: string;
  }

  const handlePhotosChange = React.useCallback((photos: PhotoData[]) => {
    if (setFormData && formData) {
      setFormData({ ...formData, multiplePhotos: photos });
    }
  }, [setFormData, formData]);

  // Convert legacy multiplePhotoURLs to multiplePhotos format if needed
  const photos = React.useMemo(() => {
    if (effectiveFormData.multiplePhotos) {
      return effectiveFormData.multiplePhotos;
    }

    // Convert from legacy multiplePhotoURLs
    const legacyUrls = (effectiveFormData as unknown as { multiplePhotoURLs?: string[] }).multiplePhotoURLs || [];
    return legacyUrls.map((url: string) => ({
      file: null,
      preview: undefined,
      uploadUrl: url,
      fileName: undefined,
      isUploading: false,
      uploadProgress: 0,
      error: undefined
    }));
  }, [effectiveFormData]);

  return (
    <div className="space-y-6">
      <UnifiedPhotoManager
        photos={photos}
        onPhotosChange={handlePhotosChange}
        disabled={disabled}
        onPhotoClick={onPhotoClick}
        maxPhotos={20}
        storageType="contacts"
        entityId={data.id}
      />
    </div>
  );
}