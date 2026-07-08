import React from 'react';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useAuth } from '@/auth/hooks/useAuth';
import { createModuleLogger } from '@/lib/telemetry';
import { FILE_TYPE_CONFIG } from '@/config/file-upload-config';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { EnterprisePhotoUploadProps } from '@/components/ui/EnterprisePhotoUpload';
import {
  buildSelectedSlot,
  buildClearedSlot,
  buildUploadedSlot,
  type MultiplePhotosBaseProps,
  type PhotoSlot,
} from './photo-slot-types';

const logger = createModuleLogger('useMultiplePhotosState');

// ============================================================================
// SSoT: shared upload-state hook for MultiplePhotos variants (ADR-596)
// ----------------------------------------------------------------------------
// Owns the slot lifecycle logic that both compact & full variants duplicated:
// canonical tenant fields (ADR-292), stale-closure-safe refs, computed slot
// counts, bulk drop handler, and the per-slot EnterprisePhotoUpload props bag.
// Variants keep ONLY their layout wrapper — no logic branching here.
// ============================================================================

export interface UsePhotoSlotStateReturn {
  usedSlots: number;
  availableSlots: number;
  /** Bulk drop handler: fills the next empty slots with dropped image files. */
  handleMultipleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  /**
   * Bound factory (ADR-595 pattern) → returns the full EnterprisePhotoUpload
   * props for a slot. Spread at the call-site so no clone migrates to the JSX.
   */
  buildCellProps: (photo: PhotoSlot, index: number) => EnterprisePhotoUploadProps;
}

export function usePhotoSlotState(base: MultiplePhotosBaseProps): UsePhotoSlotStateReturn {
  const {
    normalizedPhotos,
    maxPhotos,
    addCacheBuster,
    purpose,
    uploadHandler,
    handleUploadComplete,
    onPhotosChange,
    disabled,
    showProgress,
    contactData,
    onPhotoClick,
  } = base;

  // 🏢 ADR-292: Resolve canonical fields for tenant-isolated upload
  const companyIdResult = useCompanyId();
  const { user } = useAuth();
  const canonicalCompanyId = companyIdResult?.companyId;
  const canonicalCreatedBy = user?.uid;

  // 🔧 Refs to avoid stale closures in async onUploadComplete/onFileChange callbacks.
  // The upload completes asynchronously — by then normalizedPhotos and onPhotosChange
  // from the render closure may be stale. Refs always hold the latest values.
  const normalizedPhotosRef = React.useRef(normalizedPhotos);
  normalizedPhotosRef.current = normalizedPhotos;
  const onPhotosChangeRef = React.useRef(onPhotosChange);
  onPhotosChangeRef.current = onPhotosChange;

  const usedSlots = normalizedPhotos.filter(photo => photo.file || photo.uploadUrl).length;
  const availableSlots = maxPhotos - usedSlots;

  const handleMultipleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );

    if (files.length === 0) return;

    const newPhotos = [...normalizedPhotosRef.current];
    let slotIndex = 0;

    for (const file of files) {
      // Βρίσκουμε το επόμενο κενό slot
      while (slotIndex < maxPhotos && (newPhotos[slotIndex].file || newPhotos[slotIndex].uploadUrl)) {
        slotIndex++;
      }

      // Αν έχουμε φτάσει το όριο, σταματάμε
      if (slotIndex >= maxPhotos) break;

      newPhotos[slotIndex] = buildSelectedSlot(newPhotos[slotIndex], file);
      slotIndex++;
    }

    onPhotosChangeRef.current?.(newPhotos);
  };

  const buildCellProps = (photo: PhotoSlot, index: number): EnterprisePhotoUploadProps => {
    const photoPreviewWithCacheBuster = addCacheBuster(photo.preview || photo.uploadUrl);

    return {
      purpose: purpose ?? 'photo',
      maxSize: FILE_TYPE_CONFIG.image.maxSize,
      photoFile: photo.file,
      photoPreview: photoPreviewWithCacheBuster,
      onFileChange: (file: File | null) => {
        // 🚨 STOP INFINITE LOOPS: Only guard against setting the SAME non-null file.
        // When file===null this is a DELETE request — always allow it through,
        // even when currentFile is already null (uploaded photos have file:null + uploadUrl).
        const freshPhotos = normalizedPhotosRef.current;
        const currentSlot = freshPhotos[index];
        if (file !== null && currentSlot?.file === file) {
          return;
        }
        if (file === null && !currentSlot?.file && !currentSlot?.uploadUrl && !currentSlot?.preview) {
          return; // Nothing to clear
        }

        logger.info('File changed for slot', { index, fileName: file?.name });
        const newPhotos = [...freshPhotos];
        newPhotos[index] = file
          ? buildSelectedSlot(newPhotos[index], file)
          : buildClearedSlot();

        onPhotosChangeRef.current?.(newPhotos);
      },
      uploadHandler,
      onUploadComplete: (result: FileUploadResult) => {
        // 🏢 SINGLE STATE UPDATE: One event → one update (no competing calls).
        // handleUploadComplete does the authoritative formData update; onPhotosChange
        // is the fallback when no dedicated handler exists.
        if (handleUploadComplete) {
          handleUploadComplete(index, result);
          return;
        }

        const currentPhotos = normalizedPhotosRef.current;
        const currentHandler = onPhotosChangeRef.current;

        if (result.success && currentHandler) {
          const newPhotos = [...currentPhotos];
          newPhotos[index] = result.url
            ? buildUploadedSlot(newPhotos[index], result.url)
            : buildClearedSlot();

          currentHandler(newPhotos);
        }
      },
      disabled,
      compact: true,
      showProgress,
      isLoading: photo.isUploading,
      contactData,
      photoIndex: index,
      onPreviewClick: () => {
        if (photoPreviewWithCacheBuster && onPhotoClick) {
          logger.info('Photo clicked', { index });
          onPhotoClick(index);
        }
      },
      companyId: canonicalCompanyId,
      contactId: contactData?.id,
      createdBy: canonicalCreatedBy,
      contactName: undefined, /* SSoT: resolved by usePhotoUploadLogic via resolveContactName() */
    };
  };

  return { usedSlots, availableSlots, handleMultipleDrop, buildCellProps };
}
