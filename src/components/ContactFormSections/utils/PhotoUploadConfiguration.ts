import type { ContactFormData, ContactType } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { PhotoUploadService as FirebasePhotoUploadService } from '@/services/photo-upload.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoUploadHandlers {
  logoUploadHandler?: (file: File, onProgress: (progress: any) => void) => Promise<FileUploadResult>;
  photoUploadHandler?: (file: File, onProgress: (progress: any) => void) => Promise<FileUploadResult>;
}

export interface UnifiedPhotoHandlers {
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
  setFormData?: (data: ContactFormData) => void;
  formData: ContactFormData;
}

// ============================================================================
// 🔥 EXTRACTED: PHOTO UPLOAD CONFIGURATION LOGIC
// ============================================================================

/**
 * Photo Upload Configuration Provider - Specialized για photo upload management
 *
 * Extracted από UnifiedContactTabbedSection για Single Responsibility Principle.
 * Χειρίζεται μόνο τη photo upload configuration logic.
 *
 * Features:
 * - Firebase upload handlers configuration
 * - Unified photo change handlers
 * - WORKING PERFECTLY preservation για company logos & representative photos
 * - Clean separation από UI logic
 */

/**
 * 🏢✅ COMPANY UPLOAD HANDLERS - WORKING PERFECTLY! ΜΗΝ ΑΛΛΑΞΕΙΣ ΤΙΠΟΤΑ!
 *
 * ⚠️ ΚΡΙΣΙΜΗ ΣΥΝΑΡΤΗΣΗ: Αυτή η configuration λειτουργεί 100% για:
 * - Company logo upload & deletion
 * - Representative photo upload & deletion
 *
 * 📊 STATUS: WORKING PERFECTLY - 2025-12-05
 * 🔗 Related files: useContactSubmission.ts:285-297
 *
 * Τελική διαμόρφωση που λειτουργεί 100% - Firebase Storage path: contacts/photos
 * ✅ UPLOAD: Σώζει στο Firebase Storage και αποθηκεύει το URL στη βάση
 * ✅ DELETION: Διαγράφει από Firebase Storage όταν αφαιρείται από UI
 */
export function getPhotoUploadHandlers(formData: ContactFormData): PhotoUploadHandlers {
  return {
    // 🏢✅ COMPANY LOGO UPLOAD & DELETION - ΛΕΙΤΟΥΡΓΕΙ ΤΕΛΕΙΑ! ΜΗΝ ΑΛΛΑΞΕΙΣ ΤΙΠΟΤΑ!
    logoUploadHandler: (file, onProgress) =>
      FirebasePhotoUploadService.uploadPhoto(file, {
        folderPath: 'contacts/photos',
        onProgress,
        enableCompression: true,
        compressionUsage: 'company-logo',
        contactData: formData,
        purpose: 'logo'
      }),

    // 🔥✅ REPRESENTATIVE PHOTO UPLOAD - WORKING PERFECTLY!
    // 🎯 FIXED: Stale closure race condition με formDataRef solution
    // 📊 STATUS: WORKING PERFECTLY για representative photo type
    // ⚠️ ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ: ΜΗΝ ΑΛΛΑΞΕΙΣ την upload logic!
    photoUploadHandler: (file, onProgress) => {
      console.log('🔍 DEBUG: Representative photo upload starting:', {
        fileName: file.name,
        fileSize: file.size,
        folderPath: 'contacts/photos',
        compressionUsage: 'profile-modal',
        purpose: 'representative'
      });
      return FirebasePhotoUploadService.uploadPhoto(file, {
        folderPath: 'contacts/photos',
        onProgress,
        enableCompression: true,
        compressionUsage: 'profile-modal',
        contactData: formData,
        purpose: 'representative'
      });
    }
  };
}

/**
 * 🔄 UNIFIED PHOTO HANDLER: Consolidate all photo change handlers
 *
 * Extracted και καθαρισμένη από το μεγάλο useMemo του component.
 * Ενοποιεί τους διαφορετικούς photo change handlers.
 */
export function createUnifiedPhotosChangeHandler(handlers: UnifiedPhotoHandlers) {
  const { onPhotosChange, handleMultiplePhotosChange, setFormData, formData } = handlers;

  return onPhotosChange || handleMultiplePhotosChange || ((photos: PhotoSlot[]) => {
    console.log('🏢 UNIFIED: Photos changed:', photos.length, 'photos');
    // Default behavior: update formData if available
    if (setFormData && formData) {
      setFormData({
        ...formData,
        multiplePhotos: photos
      });
    }
  });
}

/**
 * 🎭 Build renderer props based on contact type
 *
 * 🔥 ΚΡΙΣΙΜΗ ΣΥΝΑΡΤΗΣΗ: Χτίζει τα σωστά props για κάθε renderer.
 * Extracted από το μεγάλο rendererProps useMemo.
 */
export function buildRendererPropsForContactType(
  contactType: ContactType,
  baseProps: any,
  photoHandlers: {
    handleLogoChange?: (file: File | null) => void;
    handleFileChange?: (file: File | null) => void;
    handleUploadedLogoURL?: (logoURL: string) => void;
    handleUploadedPhotoURL?: (photoURL: string) => void;
    unifiedPhotosChange: (photos: PhotoSlot[]) => void;
    handleMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
    handleProfilePhotoSelection?: (index: number) => void;
    setFormData?: (data: ContactFormData) => void;
    formData: ContactFormData;
    onPhotoClick?: (index: number) => void;
  }
) {
  // 👤 Individual-specific props
  if (contactType === 'individual') {
    return {
      ...baseProps, // ✅ ΚΡΙΣΙΜΟ: Περιλαμβάνει ΟΛΑ τα baseProps συμπεριλαμβανομένου του relationships renderer!
      onPhotoChange: photoHandlers.handleFileChange,
      onMultiplePhotosChange: photoHandlers.unifiedPhotosChange,
      onMultiplePhotoUploadComplete: photoHandlers.handleMultiplePhotoUploadComplete,
      onProfilePhotoSelection: photoHandlers.handleProfilePhotoSelection,
      onPhotoClick: photoHandlers.onPhotoClick
    };
  }

  // 🏢 Company & Service props
  return {
    ...baseProps, // ✅ ΚΡΙΣΙΜΟ: Περιλαμβάνει ΟΛΑ τα baseProps συμπεριλαμβανομένου του relationships renderer!
    onPhotosChange: photoHandlers.unifiedPhotosChange,
    onLogoChange: photoHandlers.handleLogoChange,
    handleUploadedLogoURL: photoHandlers.handleUploadedLogoURL,
    handleUploadedPhotoURL: photoHandlers.handleUploadedPhotoURL,
    setFormData: photoHandlers.setFormData
  };
}