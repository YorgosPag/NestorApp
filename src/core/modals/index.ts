/**
 * 🏗️ Core Modals - Κεντρικοποιημένα Modal Components
 *
 * Εξαγωγές για όλα τα κεντρικοποιημένα modal components και hooks.
 */

// Photo Preview Modal System
export { PhotoPreviewModal } from './PhotoPreviewModal';
export type { PhotoPreviewModalProps } from './PhotoPreviewModal';

export {
  usePhotoPreviewModal,
  openContactAvatarModal,
  openGalleryPhotoModal
} from './usePhotoPreviewModal';
export type {
  PhotoPreviewState,
  UsePhotoPreviewModalReturn,
  OpenModalParams
} from './usePhotoPreviewModal';