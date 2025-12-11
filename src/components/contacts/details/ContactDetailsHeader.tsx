'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { EditableText } from '@/components/ui/EditableText';
import { openContactAvatarModal, openGalleryPhotoModal } from '@/core/modals';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { Users, Building2, Landmark, Edit, Trash2, Check, X } from 'lucide-react';
import type {
  Contact,
  ContactType,
  ContactStatus,
  IndividualContact,
  CompanyContact,
  ServiceContact
} from '@/types/contacts';
import { getContactDisplayName, getContactInitials } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { cn } from '@/lib/utils';
import { CONTACT_TYPES, getContactIcon, getContactLabel } from '@/constants/contacts';

// 🎯 CENTRALIZED: Use centralized contact constants instead of hardcoded values
const getTypeInfo = (type: ContactType) => ({
  icon: getContactIcon(type),
  name: getContactLabel(type, 'singular')
});

const TYPE_FALLBACK = { icon: Users, name: 'Άγνωστος Τύπος' };

interface ContactDetailsHeaderProps {
  contact: Contact;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
  onContactUpdate?: (updatedContact: Partial<Contact>) => void;
  // 🎯 NEW: Edit mode props για κουμπιά στην επικεφαλίδα
  isEditing?: boolean;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}

export function ContactDetailsHeader({
  contact,
  onEditContact,
  onDeleteContact,
  onContactUpdate,
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit
}: ContactDetailsHeaderProps) {
  const photoModal = useGlobalPhotoPreview();
  const type = contact.type as ContactType;

  // 🔥 FORCE RE-RENDER: Key-based avatar invalidation
  const [avatarKey, setAvatarKey] = useState(0);

  // Listen για force avatar re-render events
  useEffect(() => {
    const handleForceRerender = (event: CustomEvent) => {
      const { contactId } = event.detail;
      if (contactId === contact.id) {
        console.log('🔄 CONTACT HEADER: Force re-rendering avatar for contact', contactId);
        setAvatarKey(prev => prev + 1); // Force re-render με νέο key
      }
    };

    window.addEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    return () => {
      window.removeEventListener('forceAvatarRerender', handleForceRerender as EventListener);
    };
  }, [contact.id]);
  const { icon: Icon, name: typeName } = getTypeInfo(type);

  // ✅ ENTERPRISE: Direct property access with type safety
  const contactAny = contact as any; // Controlled usage for legacy fields
  const status: ContactStatus | undefined = contactAny.status;

  // Safe property accessors based on contact type
  const photoURL = type === 'individual' ? contactAny.photoURL : undefined;
  const logoURL = (type === 'company' || type === 'service') ? contactAny.logoURL : undefined;
  const multiplePhotoURLs = type === 'individual' ? contactAny.multiplePhotoURLs : undefined;
  const displayName = getContactDisplayName(contact);
  const initials = getContactInitials(contact);

  // 🎯 SMART AVATAR LOGIC: Different URL based on contact type
  const getAvatarImageUrl = () => {
    switch (type) {
      case CONTACT_TYPES.INDIVIDUAL:
        return photoURL;
      case CONTACT_TYPES.COMPANY:
      case CONTACT_TYPES.SERVICE:
        return logoURL;
      default:
        return photoURL;
    }
  };

  const rawAvatarImageUrl = getAvatarImageUrl();

  // 🔥 ULTIMATE FIX: Cache buster για browser image cache ΜΟΝΟ για Individuals
  // ΠΡΟΒΛΗΜΑ: Browser cache κρατάει τις Firebase images για 1 χρόνο (Cache-Control: public, max-age=31536000)
  // ΛΥΣΗ: Προσθήκη timestamp στην URL ώστε ο browser να φορτώσει fresh εικόνα
  // TESTED: 2025-12-04 - Τελική λύση μετά από 12+ ώρες debugging με browser cache
  // ΣΗΜΕΙΩΣΗ: Cache buster μόνο όταν ΠΡΑΓΜΑΤΙΚΑ χρειάζεται
  const needsCacheBuster = type === 'individual' &&
                          Array.isArray(multiplePhotoURLs) &&
                          multiplePhotoURLs?.length === 0;

  const avatarImageUrl = rawAvatarImageUrl
    ? (needsCacheBuster
        ? `${rawAvatarImageUrl}?v=${contact.updatedAt || Date.now()}`
        : rawAvatarImageUrl)
    : undefined;

  // Handler για άνοιγμα photo modal με smart gallery logic για όλους τους τύπους
  const handleAvatarClick = () => {
    if (!avatarImageUrl) return;

    // 🎯 SMART LOGIC: Gallery navigation για Individual με multiplePhotoURLs
    if (type === 'individual' && multiplePhotoURLs?.length > 0) {
      const multiplePhotos = multiplePhotoURLs;
      const currentPhotoIndex = multiplePhotos.findIndex((url: string) => url === avatarImageUrl);
      const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

      // Άνοιγμα με gallery navigation (βελάκια working!)
      openGalleryPhotoModal(photoModal, contact, photoIndex);

    } else if (type === 'company') {
      // 🎯 NEW: Gallery navigation για Company [logoURL, photoURL]
      const companyLogoURL = logoURL;
      const companyPhotoURL = photoURL; // Representative photo
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
      const serviceLogoURL = logoURL;
      const servicePhotoURL = photoURL; // Representative photo
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

  // 🎯 INLINE EDITING: Handle name updates
  const handleNameUpdate = async (newName: string) => {
    if (!newName.trim()) return; // Don't save empty names

    try {
      // Determine which field to update based on contact type
      const updateField = type === CONTACT_TYPES.INDIVIDUAL ? 'firstName' : 'companyName';
      const updates = { [updateField]: newName.trim() };

      await ContactsService.updateContact(contact.id, updates);

      // Optional: notify parent component
      onContactUpdate?.(updates);

      console.log(`✅ ${updateField} updated successfully:`, newName.trim());
    } catch (error) {
      console.error('❌ Failed to update contact name:', error);
      // TODO: Show error toast/notification
    }
  };

  return (
    <>
      {/* 🖥️ DESKTOP: Show full header with actions */}
      <div className="hidden md:block">
        <EntityDetailsHeader
          key={`contact-header-${contact.id}-${avatarKey}`}
          icon={Icon}
          title={displayName}
          avatarImageUrl={avatarImageUrl}
          onAvatarClick={avatarImageUrl ? handleAvatarClick : undefined}
          actions={[
            // 🎯 Edit Mode Actions - Μόνο για Desktop
            ...(!isEditing ? [
              {
                label: 'Επεξεργασία',
                onClick: () => onStartEdit?.(),
                icon: Edit,
                className: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
              }
            ] : [
              {
                label: 'Αποθήκευση',
                onClick: () => onSaveEdit?.(),
                icon: Check,
                className: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
              },
              {
                label: 'Ακύρωση',
                onClick: () => onCancelEdit?.(),
                icon: X,
                className: 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
              }
            ]),
            // Delete Action - Μόνο αν υπάρχει το callback
            ...(onDeleteContact ? [{
              label: 'Διαγραφή Επαφής',
              onClick: () => onDeleteContact?.(),
              icon: Trash2,
              className: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
            }] : [])
          ]}
          variant="detailed"
        >
          {/* Centralized ContactBadge Components */}
          <div className="flex gap-2 mt-2">
            <ContactBadge status={type} variant="outline" size="sm" />
            {status && <ContactBadge status={status} size="sm" />}
          </div>
        </EntityDetailsHeader>
      </div>

      {/* 📱 MOBILE: Show only badges (no header duplication) */}
      <div className="md:hidden p-4">
        <div className="flex gap-2">
          <ContactBadge status={type as any} variant="outline" size="sm" />
          {status && <ContactBadge status={status} size="sm" />}
        </div>
      </div>

      {/* ✅ PhotoPreviewModal τώρα global - δεν χρειάζεται εδώ */}
    </>
  );
}
