'use client';

import { useState, useCallback } from 'react';
import type { Contact } from '@/types/contacts';
import type { PhotoPreviewModalProps } from './PhotoPreviewModal';
import type { PhotoGalleryPreviews } from './photo-preview-helpers';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('usePhotoPreviewModal');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoPreviewState {
  /** Κατάσταση εμφάνισης του modal */
  isOpen: boolean;
  /** URL της φωτογραφίας προς preview */
  photoUrl: string | null;
  /** Τίτλος της φωτογραφίας */
  photoTitle?: string;
  /** Contact data */
  contact?: Contact;
  /** Τύπος φωτογραφίας */
  photoType: PhotoPreviewModalProps['photoType'];
  /** Index της φωτογραφίας (για gallery) */
  photoIndex?: number;
  /** Array φωτογραφιών για gallery navigation */
  galleryPhotos?: (string | null)[];
  /** Παράγωγα ανά θέση του `galleryPhotos` (ADR-899 Ε2) — η εικόνα που **δείχνεται**· το URL μένει για λήψη/κοινή χρήση */
  galleryPreviews?: PhotoGalleryPreviews;
  /** Current index στο gallery array */
  currentGalleryIndex?: number;
}

export interface UsePhotoPreviewModalReturn {
  /** Τρέχουσα κατάσταση του modal */
  state: PhotoPreviewState;
  /** Άνοιγμα modal με φωτογραφία */
  openModal: (params: OpenModalParams) => void;
  /** Κλείσιμο modal */
  closeModal: () => void;
  /** Toggle modal state */
  toggleModal: () => void;
  /** Props για το PhotoPreviewModal component — **παράγονται** από το state (ένα πεδίο, ένα σημείο δήλωσης) */
  modalProps: Omit<PhotoPreviewState, 'isOpen'> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}

export interface OpenModalParams {
  /** URL της φωτογραφίας */
  photoUrl: string | null | undefined;
  /** Contact data (optional) */
  contact?: Contact;
  /** Τύπος φωτογραφίας */
  photoType?: PhotoPreviewModalProps['photoType'];
  /** Custom τίτλος (optional) */
  photoTitle?: string;
  /** Index φωτογραφίας για gallery (optional) */
  photoIndex?: number;
  /** Array φωτογραφιών για gallery navigation (optional) */
  galleryPhotos?: (string | null)[];
  /** Παράγωγα ανά θέση του `galleryPhotos` (ADR-899 Ε2) — η εικόνα που **δείχνεται**· το URL μένει για λήψη/κοινή χρήση */
  galleryPreviews?: PhotoGalleryPreviews;
  /** Current index στο gallery array (optional) */
  currentGalleryIndex?: number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🎣 Κεντρικοποιημένο Hook για Photo Preview Modal
 *
 * Διαχειρίζεται τη state και τις actions για το PhotoPreviewModal.
 * Παρέχει απλό API για άνοιγμα/κλείσιμο και περιέχει όλη την απαραίτητη λογική.
 *
 * @example
 * ```tsx
 * // Βασική χρήση
 * function ContactCard({ contact }) {
 *   const photoModal = usePhotoPreviewModal();
 *
 *   return (
 *     <div>
 *       <img
 *         src={contact.photoURL}
 *         onClick={() => photoModal.openModal({
 *           photoUrl: contact.photoURL,
 *           contact,
 *           photoType: 'avatar'
 *         })}
 *       />
 *       <PhotoPreviewModal {...photoModal.modalProps} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Χρήση με multiple photos (gallery)
 * function PhotoGallery({ contact, photos }) {
 *   const photoModal = usePhotoPreviewModal();
 *
 *   return (
 *     <div>
 *       {photos.map((photo, index) => (
 *         <img
 *           key={index}
 *           src={photo}
 *           onClick={() => photoModal.openModal({
 *             photoUrl: photo,
 *             contact,
 *             photoType: 'gallery',
 *             photoIndex: index
 *           })}
 *         />
 *       ))}
 *       <PhotoPreviewModal {...photoModal.modalProps} />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePhotoPreviewModal(): UsePhotoPreviewModalReturn {
  // State
  const [state, setState] = useState<PhotoPreviewState>({
    isOpen: false,
    photoUrl: null,
    photoType: 'avatar'
  });

  // Actions
  const openModal = useCallback((params: OpenModalParams) => {
    const {
      photoUrl,
      contact,
      photoType = 'avatar',
      photoTitle,
      photoIndex,
      galleryPhotos,
      galleryPreviews,
      currentGalleryIndex
    } = params;

    // Αν δεν υπάρχει φωτογραφία, δεν ανοίγουμε modal
    if (!photoUrl) {
      logger.warn('usePhotoPreviewModal: No photoUrl provided');
      return;
    }

    setState({
      isOpen: true,
      photoUrl,
      contact,
      photoType,
      photoTitle,
      photoIndex,
      galleryPhotos,
      galleryPreviews,
      currentGalleryIndex
    });
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  const toggleModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: !prev.isOpen
    }));
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      // Αν προσπαθούν να ανοίξουν το modal χωρίς να έχουν καλέσει openModal πρώτα
      logger.warn('usePhotoPreviewModal: Use openModal() to open the modal with photo data');
      return;
    }
    // Κλείνουμε το modal
    closeModal();
  }, [closeModal]);

  // Modal Props που περνάνε στο PhotoPreviewModal component
  const modalProps = {
    open: state.isOpen,
    onOpenChange: handleOpenChange,
    photoUrl: state.photoUrl,
    photoTitle: state.photoTitle,
    contact: state.contact,
    photoType: state.photoType,
    photoIndex: state.photoIndex,
    galleryPhotos: state.galleryPhotos,
    galleryPreviews: state.galleryPreviews,
    currentGalleryIndex: state.currentGalleryIndex
  };

  return {
    state,
    openModal,
    closeModal,
    toggleModal,
    modalProps
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Helper function για άνοιγμα modal με contact avatar
 */
export function openContactAvatarModal(
  modal: UsePhotoPreviewModalReturn,
  contact: Contact,
  photoType: PhotoPreviewModalProps['photoType'] = 'avatar'
) {
  // Προσδιορίζουμε το URL της φωτογραφίας βάσει τύπου επαφής
  let photoUrl: string | null = null;

  switch (contact.type) {
    case 'individual':
      // Για Individual: χρησιμοποιούμε photoURL ή την πρώτη από multiplePhotoURLs
      photoUrl = contact.photoURL ||
                 (contact.multiplePhotoURLs && contact.multiplePhotoURLs[0]) ||
                 null;
      break;

    case 'company':
      if (photoType === 'logo') {
        photoUrl = contact.logoURL || null;
      } else {
        // Representative photo
        photoUrl = contact.photoURL || contact.representativePhotoURL || null;
      }
      break;

    case 'service':
      photoUrl = contact.logoURL || null;
      break;

    default:
      photoUrl = null;
  }

  modal.openModal({
    photoUrl,
    contact,
    photoType
  });
}

/**
 * Helper function για άνοιγμα modal με multiple photos (gallery)
 */
export function openGalleryPhotoModal(
  modal: UsePhotoPreviewModalReturn,
  contact: Contact,
  photoIndex: number,
  customGalleryPhotos?: (string | null)[]
) {
  // Use custom gallery photos if provided, otherwise fall back to contact.multiplePhotoURLs
  const galleryPhotos = customGalleryPhotos || contact.multiplePhotoURLs || [];
  const photoUrl = galleryPhotos[photoIndex] || null;

  modal.openModal({
    photoUrl,
    contact,
    photoType: 'gallery',
    photoIndex,
    galleryPhotos,
    currentGalleryIndex: photoIndex
  });
}

export default usePhotoPreviewModal;
