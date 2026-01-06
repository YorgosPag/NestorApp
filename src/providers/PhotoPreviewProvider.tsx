'use client';

import React, { createContext, useContext } from 'react';
import { PhotoPreviewModal } from '@/core/modals/PhotoPreviewModal';
import {
  usePhotoPreviewModal,
  openContactAvatarModal,
  openGalleryPhotoModal,
  type UsePhotoPreviewModalReturn
} from '@/core/modals/usePhotoPreviewModal';

// ============================================================================
// CONTEXT DEFINITION
// ============================================================================

/**
 * 🌐 Global PhotoPreview Context
 *
 * Παρέχει κεντρικοποιημένη πρόσβαση στο PhotoPreviewModal σε όλη την εφαρμογή.
 * Αντικαθιστά τα scattered instances του usePhotoPreviewModal.
 */
const PhotoPreviewContext = createContext<UsePhotoPreviewModalReturn | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface PhotoPreviewProviderProps {
  children: React.ReactNode;
}

/**
 * 🏢 ENTERPRISE: Global PhotoPreview Provider
 *
 * Κεντρικοποιημένος provider που διαχειρίζεται το PhotoPreviewModal για όλη την εφαρμογή.
 *
 * Features:
 * - Single instance του PhotoPreviewModal στο DOM
 * - Global state management για photo preview
 * - Backward compatible με existing usePhotoPreviewModal interface
 * - Enterprise-class performance με ένα modal για όλη την εφαρμογή
 *
 * Usage:
 * ```tsx
 * // Στο layout.tsx:
 * <PhotoPreviewProvider>
 *   <App />
 * </PhotoPreviewProvider>
 *
 * // Στα components:
 * const photoModal = useGlobalPhotoPreview();
 * photoModal.openModal({ photoUrl, contact });
 * ```
 *
 * Architecture:
 * - Χρησιμοποιεί το existing usePhotoPreviewModal hook εσωτερικά
 * - Παρέχει το ίδιο interface μέσω Context
 * - Το modal rendered μόνο εδώ (όχι σε κάθε component)
 */
export function PhotoPreviewProvider({ children }: PhotoPreviewProviderProps) {
  // 🏢 ENTERPRISE: Χρησιμοποιούμε το existing hook για backward compatibility
  const photoModalHook = usePhotoPreviewModal();
  // Debug disabled: PhotoPreviewProvider initialization

  return (
    <PhotoPreviewContext.Provider value={photoModalHook}>
      {children}

      {/* 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ MODAL: Μόνο ένα instance σε όλη την εφαρμογή */}
      <PhotoPreviewModal {...photoModalHook.modalProps} />
    </PhotoPreviewContext.Provider>
  );
}

// ============================================================================
// GLOBAL HOOK
// ============================================================================

/**
 * 🎣 Global PhotoPreview Hook
 *
 * Κεντρικοποιημένη πρόσβαση στο PhotoPreviewModal από οποιοδήποτε component.
 * Αντικαθιστά τα local usePhotoPreviewModal instances.
 *
 * @throws {Error} Αν χρησιμοποιηθεί εκτός PhotoPreviewProvider
 *
 * @example
 * ```tsx
 * function ContactCard({ contact }) {
 *   const photoModal = useGlobalPhotoPreview();
 *
 *   return (
 *     <img
 *       src={contact.photoURL}
 *       onClick={() => photoModal.openModal({
 *         photoUrl: contact.photoURL,
 *         contact
 *       })}
 *     />
 *   );
 * }
 * ```
 */
export function useGlobalPhotoPreview(): UsePhotoPreviewModalReturn {
  const context = useContext(PhotoPreviewContext);

  if (!context) {
    throw new Error(
      'useGlobalPhotoPreview must be used within a PhotoPreviewProvider. ' +
      'Make sure to wrap your app with <PhotoPreviewProvider>.'
    );
  }

  return context;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * 🖼️ Global Avatar Modal Helper
 *
 * Convenience function για άνοιγμα contact avatar με το global modal.
 * Wrapper γύρω από το openContactAvatarModal που χρησιμοποιεί το global context.
 */
export function useOpenContactAvatar() {
  const photoModal = useGlobalPhotoPreview();

  return React.useCallback((
    contact: Parameters<typeof openContactAvatarModal>[1],
    photoType?: Parameters<typeof openContactAvatarModal>[2]
  ) => {
    openContactAvatarModal(photoModal, contact, photoType);
  }, [photoModal]);
}

/**
 * 📸 Global Gallery Modal Helper
 *
 * Convenience function για άνοιγμα photo gallery με το global modal.
 * Wrapper γύρω από το openGalleryPhotoModal που χρησιμοποιεί το global context.
 */
export function useOpenGalleryPhoto() {
  const photoModal = useGlobalPhotoPreview();

  return React.useCallback((
    contact: Parameters<typeof openGalleryPhotoModal>[1],
    photoIndex: Parameters<typeof openGalleryPhotoModal>[2],
    customGalleryPhotos?: Parameters<typeof openGalleryPhotoModal>[3]
  ) => {
    openGalleryPhotoModal(photoModal, contact, photoIndex, customGalleryPhotos);
  }, [photoModal]);
}

export default PhotoPreviewProvider;