/**
 * @fileoverview Pure helper functions for PhotoPreviewModal.
 *
 * Extracted from PhotoPreviewModal.tsx to comply with Google SRP standards
 * (max 500 lines per file). Contains badge creation, title generation,
 * icon selection, and the PhotoPreviewModalProps interface.
 *
 * @module photo-preview-helpers
 */

import { User, Building2 } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { BadgeFactory } from '@/core/badges/BadgeFactory';
import type { UseSemanticColorsReturn } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoPreviewModalProps {
  /** Κατάσταση εμφάνισης του modal */
  open: boolean;
  /** Handler για κλείσιμο του modal */
  onOpenChange: (open: boolean) => void;
  /** URL της φωτογραφίας προς preview */
  photoUrl: string | null | undefined;
  /** Τίτλος της φωτογραφίας (optional) */
  photoTitle?: string;
  /** Contact data για εμφάνιση πληροφοριών (optional) */
  contact?: Contact;
  /** Τύπος φωτογραφίας για κατάλληλο τίτλο */
  photoType?: 'avatar' | 'logo' | 'representative' | 'profile' | 'gallery';
  /** Index της φωτογραφίας (για gallery) */
  photoIndex?: number;
  /** Array φωτογραφιών για gallery navigation (optional) */
  galleryPhotos?: (string | null)[];
  /** Current index στο gallery array (optional) */
  currentGalleryIndex?: number;
  /** Custom CSS classes */
  className?: string;
}

// ============================================================================
// BADGE HELPERS
// ============================================================================

/**
 * Δημιουργεί gallery counter badge με κεντρικοποιημένο badge system.
 * ENTERPRISE: Accepts colors via dependency injection.
 */
export function createGalleryCounterBadge(
  currentIndex: number,
  totalPhotos: number,
  colors: UseSemanticColorsReturn
) {
  return BadgeFactory.createCommonBadge('info', colors, {
    customLabel: `${currentIndex + 1}/${totalPhotos}`,
    variant: 'outline',
    size: 'sm',
    className: colors.text.muted
  });
}

/**
 * Δημιουργεί contact type badge με κεντρικοποιημένο badge system.
 * ENTERPRISE: i18n-enabled with t function parameter and colors DI.
 */
export function createContactTypeBadge(
  contactType: Contact['type'],
  t: (key: string) => string,
  colors: UseSemanticColorsReturn
) {
  let label = '';

  switch (contactType) {
    case 'individual':
      label = t('photoPreview.contactType.individual');
      break;
    case 'company':
      label = t('photoPreview.contactType.company');
      break;
    case 'service':
      label = t('photoPreview.contactType.service');
      break;
    default:
      label = t('photoPreview.contactType.unknown');
  }

  return BadgeFactory.createCommonBadge('info', colors, {
    customLabel: label,
    variant: 'secondary',
    size: 'sm'
  });
}

// ============================================================================
// TITLE & ICON HELPERS
// ============================================================================

/**
 * Δημιουργεί κατάλληλο τίτλο για τη φωτογραφία βάσει τύπου και επαφής.
 * ENTERPRISE: i18n-enabled with t function parameter.
 */
export function generatePhotoTitle(
  contact: Contact | undefined,
  photoType: PhotoPreviewModalProps['photoType'] = 'avatar',
  photoIndex: number | undefined,
  customTitle: string | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  // Αν υπάρχει custom τίτλος, χρησιμοποίησε αυτόν
  if (customTitle) {
    return customTitle;
  }

  // Αν δεν υπάρχει contact, generic τίτλοι
  if (!contact) {
    switch (photoType) {
      case 'avatar':
      case 'profile':
        return t('photoPreview.titles.profile');
      case 'logo':
        return t('photoPreview.titles.logo');
      case 'representative':
        return t('photoPreview.titles.representative');
      case 'gallery':
        return photoIndex !== undefined
          ? t('photoPreview.titles.photoWithIndex', { index: photoIndex + 1 })
          : t('photoPreview.titles.photo');
      default:
        return t('photoPreview.titles.photo');
    }
  }

  // Παίρνουμε το όνομα της επαφής
  const contactName = getContactDisplayName(contact);

  // Επιστρέφουμε μόνο το όνομα - η ετικέτα δεξιά δείχνει τον τύπο/αριθμό
  return contactName;
}

/**
 * Επιστρέφει κατάλληλο icon για τον τύπο φωτογραφίας.
 */
export function getPhotoTypeIcon(photoType: PhotoPreviewModalProps['photoType'] = 'avatar') {
  switch (photoType) {
    case 'avatar':
    case 'profile':
    case 'representative':
      return User;
    case 'logo':
      return Building2;
    case 'gallery':
      return User;
    default:
      return User;
  }
}

// ============================================================================
// SHARE DATA HELPERS
// ============================================================================

/** Maps photo types to i18n keys for share text */
const PHOTO_TYPE_I18N_MAP: Record<string, string> = {
  avatar: 'photoPreview.titles.profile',
  profile: 'photoPreview.titles.profile',
  logo: 'photoPreview.titles.logo',
  representative: 'photoPreview.titles.representative',
  gallery: 'photoPreview.titles.photo',
};

/** Build the localized share text for a photo */
export function buildPhotoShareText(
  photoType: string,
  contact: Contact | undefined,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const photoTypeLabel = t(PHOTO_TYPE_I18N_MAP[photoType] ?? 'photoPreview.titles.photo');

  return contact
    ? t('share.photoCaption', { photoType: photoTypeLabel, name: getContactDisplayName(contact) })
    : t('share.photoCaptionNoContact', { photoType: photoTypeLabel });
}
