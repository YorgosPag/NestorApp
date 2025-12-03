'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Download, Share2, ZoomIn, ZoomOut, RotateCw, User, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { BadgeFactory } from '@/core/badges/BadgeFactory';

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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Δημιουργεί gallery counter badge με κεντρικοποιημένο badge system
 */
function createGalleryCounterBadge(currentIndex: number, totalPhotos: number) {
  return BadgeFactory.createCommonBadge('info', {
    customLabel: `${currentIndex + 1}/${totalPhotos}`,
    variant: 'outline',
    size: 'sm',
    className: 'text-muted-foreground'
  });
}

/**
 * Δημιουργεί contact type badge με κεντρικοποιημένο badge system
 */
function createContactTypeBadge(contactType: Contact['type']) {
  let label = '';

  switch (contactType) {
    case 'individual':
      label = 'Φυσικό Πρόσωπο';
      break;
    case 'company':
      label = 'Νομικό Πρόσωπο';
      break;
    case 'service':
      label = 'Δημόσια Υπηρεσία';
      break;
    default:
      label = 'Άγνωστος Τύπος';
  }

  return BadgeFactory.createCommonBadge('info', {
    customLabel: label,
    variant: 'secondary',
    size: 'sm'
  });
}

/**
 * Δημιουργεί κατάλληλο τίτλο για τη φωτογραφία βάσει τύπου και επαφής
 */
function generatePhotoTitle(
  contact?: Contact,
  photoType: PhotoPreviewModalProps['photoType'] = 'avatar',
  photoIndex?: number,
  customTitle?: string
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
        return 'Φωτογραφία Προφίλ';
      case 'logo':
        return 'Λογότυπο';
      case 'representative':
        return 'Φωτογραφία Εκπροσώπου';
      case 'gallery':
        return photoIndex !== undefined ? `Φωτογραφία ${photoIndex + 1}` : 'Φωτογραφία';
      default:
        return 'Φωτογραφία';
    }
  }

  // Παίρνουμε το όνομα της επαφής
  const contactName = getContactDisplayName(contact);

  // Δημιουργούμε τίτλο βάσει τύπου φωτογραφίας
  switch (photoType) {
    case 'avatar':
    case 'profile':
      return `${contactName} - Φωτογραφία Προφίλ`;
    case 'logo':
      return `${contactName} - Λογότυπο`;
    case 'representative':
      return `${contactName} - Φωτογραφία Εκπροσώπου`;
    case 'gallery':
      return photoIndex !== undefined
        ? `${contactName} - Φωτογραφία ${photoIndex + 1}`
        : `${contactName} - Φωτογραφία`;
    default:
      return `${contactName} - Φωτογραφία`;
  }
}

/**
 * Επιστρέφει κατάλληλο icon για τον τύπο φωτογραφίας
 */
function getPhotoTypeIcon(photoType: PhotoPreviewModalProps['photoType'] = 'avatar') {
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
// MAIN COMPONENT
// ============================================================================

/**
 * 🖼️ Κεντρικοποιημένο Photo Preview Modal Component
 *
 * Εμφανίζει φωτογραφίες σε modal με δυνατότητες:
 * - Full-screen preview
 * - Κατάλληλους τίτλους βάσει contact data
 * - Download functionality
 * - Zoom controls (future enhancement)
 *
 * @example
 * ```tsx
 * // Χρήση στο ContactDetailsHeader
 * <PhotoPreviewModal
 *   open={showPhotoModal}
 *   onOpenChange={setShowPhotoModal}
 *   photoUrl={contact?.photoURL}
 *   contact={contact}
 *   photoType="avatar"
 * />
 *
 * // Χρήση στο ContactListItem
 * <PhotoPreviewModal
 *   open={showPhotoModal}
 *   onOpenChange={setShowPhotoModal}
 *   photoUrl={contact?.photoURL}
 *   contact={contact}
 *   photoType="profile"
 * />
 * ```
 */
export function PhotoPreviewModal({
  open,
  onOpenChange,
  photoUrl,
  photoTitle,
  contact,
  photoType = 'avatar',
  photoIndex,
  galleryPhotos,
  currentGalleryIndex,
  className
}: PhotoPreviewModalProps) {
  // ============================================================================
  // ALL HOOKS MUST BE AT TOP LEVEL - BEFORE ANY EARLY RETURNS
  // ============================================================================

  // State για zoom functionality (μελλοντική επέκταση)
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // State για gallery navigation
  const [currentIndex, setCurrentIndex] = useState(currentGalleryIndex || 0);

  // Refs για keyboard navigation (αποφεύγουν stale closures)
  const currentIndexRef = useRef(currentIndex);
  const isGalleryModeRef = useRef(false);
  const totalPhotosRef = useRef(0);

  // Gallery logic - πάντα χρησιμοποιούμε το current gallery photo αν είμαστε σε gallery mode
  const isGalleryMode = galleryPhotos && galleryPhotos.length > 0;
  const currentPhoto = isGalleryMode ? galleryPhotos[currentIndex] : photoUrl;
  const validPhotos = galleryPhotos?.filter(photo => photo !== null) || [];
  const totalPhotos = validPhotos.length;

  // Update refs when values change
  currentIndexRef.current = currentIndex;
  isGalleryModeRef.current = !!isGalleryMode;
  totalPhotosRef.current = totalPhotos;

  // Update currentIndex when currentGalleryIndex prop changes
  useEffect(() => {
    if (currentGalleryIndex !== undefined) {
      setCurrentIndex(currentGalleryIndex);
    }
  }, [currentGalleryIndex]);

  // Keyboard navigation με refs (χωρίς dependency issues)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Χρησιμοποιούμε refs για fresh values
      const currentGalleryMode = isGalleryModeRef.current;
      const currentTotal = totalPhotosRef.current;

      if (!currentGalleryMode || currentTotal <= 1) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onOpenChange(false);
        }
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          setCurrentIndex(prevIndex => prevIndex > 0 ? prevIndex - 1 : currentTotal - 1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          setCurrentIndex(prevIndex => prevIndex < currentTotal - 1 ? prevIndex + 1 : 0);
          break;
        case 'Escape':
          event.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // ============================================================================
  // EARLY RETURNS AFTER ALL HOOKS
  // ============================================================================

  // Αν δεν υπάρχει φωτογραφία, δεν εμφανίζουμε το modal
  if (!currentPhoto) {
    return null;
  }

  // ============================================================================
  // REGULAR LOGIC AFTER EARLY RETURNS
  // ============================================================================

  // Δημιουργούμε τον τίτλο
  const displayIndex = isGalleryMode ? currentIndex : photoIndex;
  const title = generatePhotoTitle(contact, photoType, displayIndex, photoTitle);
  const IconComponent = getPhotoTypeIcon(photoType);

  // Navigation handlers για gallery
  const handlePreviousPhoto = () => {
    if (!isGalleryMode || totalPhotos <= 1) return;
    setCurrentIndex(prevIndex => prevIndex > 0 ? prevIndex - 1 : totalPhotos - 1);
  };

  const handleNextPhoto = () => {
    if (!isGalleryMode || totalPhotos <= 1) return;
    setCurrentIndex(prevIndex => prevIndex < totalPhotos - 1 ? prevIndex + 1 : 0);
  };

  // Handlers
  const handleDownload = () => {
    // Δημιουργούμε link για download
    const link = document.createElement('a');
    link.href = currentPhoto;
    link.download = `${title}.jpg`;
    link.click();
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Δείτε τη φωτογραφία: ${title}`,
          url: currentPhoto,
        });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback: Copy URL to clipboard
      try {
        await navigator.clipboard.writeText(currentPhoto);
        // TODO: Add toast notification
        console.log('URL copied to clipboard');
      } catch (err) {
        console.error('Failed to copy URL');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-4xl h-[90vh] flex flex-col ${className} [&>button]:hidden`}>
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <IconComponent className="w-5 h-5" />
              {title}
            </DialogTitle>

            {/* Gallery Counter - Using Centralized Badge System */}
            {isGalleryMode && totalPhotos > 1 && (() => {
              const galleryBadge = createGalleryCounterBadge(currentIndex, totalPhotos);
              return (
                <Badge
                  variant={galleryBadge.variant}
                  className={galleryBadge.className}
                >
                  {galleryBadge.label}
                </Badge>
              );
            })()}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Gallery Navigation - μόνο αν έχουμε περισσότερες από 1 φωτογραφίες */}
            {isGalleryMode && totalPhotos > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePreviousPhoto}
                  title="Προηγούμενη φωτογραφία"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextPhoto}
                  title="Επόμενη φωτογραφία"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.25}
              title="Μικρότερο"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              title="Μεγαλύτερο"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotate}
              title="Περιστροφή"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              title="Κοινοποίηση"
            >
              <Share2 className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              title="Λήψη"
            >
              <Download className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              title="Κλείσιμο"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Photo Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-50 rounded-lg">
          <div className="relative max-w-full max-h-full">
            <img
              src={currentPhoto}
              alt={title}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
              onError={(e) => {
                console.error('Failed to load image:', currentPhoto);
                // TODO: Show error state
              }}
            />
          </div>
        </div>

        {/* Footer Info */}
        {contact && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-2">
              <IconComponent className="w-4 h-4" />
              <span>{getContactDisplayName(contact)}</span>
              {contact.type && (() => {
                const contactTypeBadge = createContactTypeBadge(contact.type);
                return (
                  <Badge
                    variant={contactTypeBadge.variant}
                    className={contactTypeBadge.className}
                  >
                    {contactTypeBadge.label}
                  </Badge>
                );
              })()}
            </div>
            <div className="text-xs">
              Zoom: {Math.round(zoom * 100)}%
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PhotoPreviewModal;