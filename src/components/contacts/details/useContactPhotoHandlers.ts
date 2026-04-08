import { useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

type SetEditedData = React.Dispatch<React.SetStateAction<Partial<ContactFormData>>>;

/**
 * Extracted photo handlers for ContactDetails edit mode.
 *
 * Each handler uses the functional updater pattern (`prev => ...`) so that
 * async upload callbacks never close over stale state.
 *
 * @see ADR-054 (Enterprise Upload System Consolidation)
 */
export function useContactPhotoHandlers(setEditedData: SetEditedData) {
  const handleUploadedLogoURL = useCallback((logoURL: string) => {
    setEditedData(prev => ({
      ...prev,
      logoURL,
      logoPreview: logoURL,
      logoFile: null,
    }));
  }, [setEditedData]);

  const handleUploadedPhotoURL = useCallback((photoURL: string) => {
    setEditedData(prev => ({
      ...prev,
      photoURL,
      photoPreview: photoURL,
      photoFile: null,
    }));
  }, [setEditedData]);

  const handleFileChange = useCallback((file: File | null) => {
    if (file) {
      const preview = URL.createObjectURL(file);
      setEditedData(prev => ({ ...prev, photoFile: file, photoPreview: preview }));
    }
  }, [setEditedData]);

  const handleMultiplePhotosChange = useCallback((photos: PhotoSlot[]) => {
    setEditedData(prev => ({
      ...prev,
      multiplePhotos: photos,
    }));
  }, [setEditedData]);

  const handleLogoChange = useCallback((file: File | null) => {
    if (file) {
      const preview = URL.createObjectURL(file);
      setEditedData(prev => ({ ...prev, logoFile: file, logoPreview: preview }));
    }
  }, [setEditedData]);

  // 🏢 ENTERPRISE: Race-condition-safe per-slot upload completion handler.
  // Uses functional updater so React guarantees `prev` is always the latest
  // state — even if 2+ uploads complete in the same render cycle.
  const handleMultiplePhotoUploadComplete = useCallback((index: number, result: FileUploadResult) => {
    setEditedData(prev => {
      const currentPhotos: PhotoSlot[] = [...(prev.multiplePhotos || [])];
      while (currentPhotos.length <= index) {
        currentPhotos.push({ file: null, isUploading: false, uploadProgress: 0 });
      }

      if (result.url) {
        currentPhotos[index] = {
          ...currentPhotos[index],
          file: null,
          uploadUrl: result.url,
          preview: result.url,
          fileName: result.fileName,
          isUploading: false,
          uploadProgress: 100,
          error: undefined,
        };
      } else {
        currentPhotos[index] = {
          file: null, preview: undefined, uploadUrl: undefined,
          fileName: undefined, isUploading: false, uploadProgress: 0, error: undefined,
        };
      }

      return { ...prev, multiplePhotos: currentPhotos };
    });
  }, [setEditedData]);

  return {
    handleUploadedLogoURL,
    handleUploadedPhotoURL,
    handleFileChange,
    handleMultiplePhotosChange,
    handleMultiplePhotoUploadComplete,
    handleLogoChange,
  } as const;
}
