'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { PhotoPreviewModal, usePhotoPreviewModal, openContactAvatarModal, openGalleryPhotoModal } from '@/core/modals';
import { Users, Building2, Landmark, Edit, Trash2 } from 'lucide-react';
import type { Contact, ContactType, ContactStatus } from '@/types/contacts';
import { getContactDisplayName, getContactInitials } from '@/types/contacts';
import { cn } from '@/lib/utils';

const TYPE_INFO: Record<ContactType, { icon: React.ElementType; name: string }> = {
    individual: { icon: Users, name: 'Φυσικό Πρόσωπο' },
    company: { icon: Building2, name: 'Νομικό Πρόσωπο' },
    service: { icon: Landmark, name: 'Δημόσια Υπηρεσία' }
};

const TYPE_FALLBACK = { icon: Users, name: 'Άγνωστος Τύπος' };

interface ContactDetailsHeaderProps {
  contact: Contact;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
}

export function ContactDetailsHeader({ contact, onEditContact, onDeleteContact }: ContactDetailsHeaderProps) {
  const photoModal = usePhotoPreviewModal();
  const type = contact.type as ContactType;
  const { icon: Icon, name: typeName } = TYPE_INFO[type] ?? TYPE_FALLBACK;
  const status = (contact as any).status as ContactStatus | undefined;
  const displayName = getContactDisplayName(contact);
  const initials = getContactInitials(contact);

  // 🎯 SMART AVATAR LOGIC: Different URL based on contact type
  const getAvatarImageUrl = () => {
    switch (type) {
      case 'individual':
        return (contact as any).photoURL; // Personal photo
      case 'company':
        return (contact as any).logoURL; // Company logo
      case 'service':
        return (contact as any).logoURL; // Service logo (NOT photoURL which is for representative)
      default:
        return (contact as any).photoURL;
    }
  };

  const avatarImageUrl = getAvatarImageUrl();

  // Handler για άνοιγμα photo modal με smart gallery logic για όλους τους τύπους
  const handleAvatarClick = () => {
    if (!avatarImageUrl) return;

    // 🎯 SMART LOGIC: Gallery navigation για Individual με multiplePhotoURLs
    if (type === 'individual' && (contact as any).multiplePhotoURLs?.length > 0) {
      const multiplePhotos = (contact as any).multiplePhotoURLs;
      const currentPhotoIndex = multiplePhotos.findIndex((url: string) => url === avatarImageUrl);
      const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

      // Άνοιγμα με gallery navigation (βελάκια working!)
      openGalleryPhotoModal(photoModal, contact, photoIndex);

    } else if (type === 'company') {
      // 🎯 NEW: Gallery navigation για Company [logoURL, photoURL]
      const logoURL = (contact as any).logoURL;
      const photoURL = (contact as any).photoURL; // Representative photo
      const galleryPhotos = [logoURL, photoURL].filter(Boolean); // Remove null/undefined

      if (galleryPhotos.length > 1) {
        // Multiple photos available - use gallery navigation
        const currentPhotoIndex = galleryPhotos.findIndex((url: string) => url === avatarImageUrl);
        const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

        // Create temporary contact with multiplePhotoURLs for gallery
        const galleryContact = { ...contact, multiplePhotoURLs: galleryPhotos };
        openGalleryPhotoModal(photoModal, galleryContact, photoIndex);
      } else {
        // Single photo fallback
        const photoType = avatarImageUrl === logoURL ? 'logo' : 'avatar';
        openContactAvatarModal(photoModal, contact, photoType);
      }

    } else if (type === 'service') {
      // 🎯 NEW: Gallery navigation για Service [logoURL, photoURL]
      const logoURL = (contact as any).logoURL;
      const photoURL = (contact as any).photoURL; // Representative photo
      const galleryPhotos = [logoURL, photoURL].filter(Boolean); // Remove null/undefined

      if (galleryPhotos.length > 1) {
        // Multiple photos available - use gallery navigation
        const currentPhotoIndex = galleryPhotos.findIndex((url: string) => url === avatarImageUrl);
        const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

        // Create temporary contact with multiplePhotoURLs for gallery
        const galleryContact = { ...contact, multiplePhotoURLs: galleryPhotos };
        openGalleryPhotoModal(photoModal, galleryContact, photoIndex);
      } else {
        // Single photo fallback
        const photoType = avatarImageUrl === logoURL ? 'logo' : 'avatar';
        openContactAvatarModal(photoModal, contact, photoType);
      }

    } else {
      // Fallback για Individual χωρίς multiple photos ή other types
      openContactAvatarModal(photoModal, contact, 'avatar');
    }
  };

  return (
    <>
      <EntityDetailsHeader
        icon={Icon}
        title={displayName}
        avatarImageUrl={avatarImageUrl}
        onAvatarClick={avatarImageUrl ? handleAvatarClick : undefined}
        actions={[
          {
            label: 'Επεξεργασία Επαφής',
            onClick: () => onEditContact?.(),
            icon: Edit,
            className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
          },
          {
            label: 'Διαγραφή Επαφής',
            onClick: () => onDeleteContact?.(),
            icon: Trash2,
            className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
          }
        ]}
        variant="detailed"
      >
        {/* Centralized ContactBadge Components */}
        <div className="flex gap-2 mt-2">
          <ContactBadge status={type as any} variant="outline" size="sm" />
          {status && <ContactBadge status={status} size="sm" />}
        </div>
      </EntityDetailsHeader>

      {/* ✅ Κεντρικοποιημένο Photo Preview Modal */}
      <PhotoPreviewModal {...photoModal.modalProps} />
    </>
  );
}
