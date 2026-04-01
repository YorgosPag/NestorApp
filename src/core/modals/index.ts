/**
 * 🏗️ Core Modals - Κεντρικοποιημένα Modal Components
 *
 * Εξαγωγές για όλα τα κεντρικοποιημένα modal components και hooks.
 * ✅ ENTERPRISE: Smart Dialog Engine integration για 90% code reduction
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

// ============================================================================
// 🏢 ENTERPRISE SMART DIALOG ENGINE - FORTUNE 500 LEVEL SYSTEM
// ============================================================================

// Smart Dialog Configuration Engine
export { SmartDialogEngine, smartDialogEngine, createSmartDialog } from './SmartDialogEngine';
export type {
  DialogEntityType,
  DialogOperationType,
  SmartDialogConfiguration,
  SmartDialogField,
  SmartDialogAction,
  ValidationRule,
  SmartDialogEngineState,
} from './smart-dialog-types';