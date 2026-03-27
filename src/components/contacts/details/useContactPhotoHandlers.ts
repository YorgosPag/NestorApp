import { useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

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
    console.log('🔴 PHOTO DEBUG [useContactPhotoHandlers] handleMultiplePhotosChange', {
      photosCount: photos.length,
      filled: photos.filter(p => p.file || p.uploadUrl || p.preview).length,
      slots: photos.map((p, i) => ({
        i, f: !!p.file, u: !!p.uploadUrl, p: !!p.preview,
        pUrl: p.preview?.substring(0, 40),
      })),
    });
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

  return {
    handleUploadedLogoURL,
    handleUploadedPhotoURL,
    handleFileChange,
    handleMultiplePhotosChange,
    handleLogoChange,
  } as const;
}
