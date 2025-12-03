'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Download, Share2, ZoomIn, ZoomOut, RotateCw, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';

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
  /** Custom CSS classes */
  className?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
  className
}: PhotoPreviewModalProps) {
  // State για zoom functionality (μελλοντική επέκταση)
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);

  // Αν δεν υπάρχει φωτογραφία, δεν εμφανίζουμε το modal
  if (!photoUrl) {
    return null;
  }

  // Δημιουργούμε τον τίτλο
  const title = generatePhotoTitle(contact, photoType, photoIndex, photoTitle);
  const IconComponent = getPhotoTypeIcon(photoType);

  // Handlers
  const handleDownload = () => {
    // Δημιουργούμε link για download
    const link = document.createElement('a');
    link.href = photoUrl;
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
          url: photoUrl,
        });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback: Copy URL to clipboard
      try {
        await navigator.clipboard.writeText(photoUrl);
        // TODO: Add toast notification
        console.log('URL copied to clipboard');
      } catch (err) {
        console.error('Failed to copy URL');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-4xl h-[90vh] flex flex-col ${className}`}>
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <IconComponent className="w-5 h-5" />
            {title}
          </DialogTitle>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
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
              src={photoUrl}
              alt={title}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
              onError={(e) => {
                console.error('Failed to load image:', photoUrl);
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
              {contact.type && (
                <span className="text-xs bg-muted px-2 py-1 rounded">
                  {contact.type === 'individual' ? 'Φυσικό Πρόσωπο' :
                   contact.type === 'company' ? 'Νομικό Πρόσωπο' :
                   'Δημόσια Υπηρεσία'}
                </span>
              )}
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