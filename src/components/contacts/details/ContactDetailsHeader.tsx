'use client';

import React, { useState, useEffect } from 'react';
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { Button } from '@/components/ui/button';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { EditableText } from '@/components/ui/EditableText';
import { openContactAvatarModal, openGalleryPhotoModal } from '@/core/modals';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { Users, Building2, Landmark, Edit, Trash2, Check, X } from 'lucide-react';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  Contact,
  ContactType,
  IndividualContact,
  CompanyContact,
  ServiceContact
} from '@/types/contacts';
import type { ContactStatus } from '@/core/types/BadgeTypes';
import { getContactDisplayName, getContactInitials, isIndividualContact, isCompanyContact, isServiceContact } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { cn } from '@/lib/utils';
import { CONTACT_TYPES, getContactIcon, getContactLabel } from '@/constants/contacts';

// 🎯 CENTRALIZED: Use centralized contact constants instead of hardcoded values
const getTypeInfo = (type: ContactType) => ({
  icon: getContactIcon(type),
  name: getContactLabel(type, 'singular')
});

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
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('contacts');
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

  // ✅ ENTERPRISE: Type-safe property access using type guards
  const status: ContactStatus | undefined = contact.status;

  // 🏢 ENTERPRISE: Safe property accessors based on contact type using type guards
  const photoURL = isIndividualContact(contact) ? contact.photoURL : undefined;
  const logoURL = (isCompanyContact(contact) || isServiceContact(contact)) ? contact.logoURL : undefined;
  const multiplePhotoURLs = isIndividualContact(contact) ? contact.multiplePhotoURLs : undefined;
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
    if (type === 'individual' && multiplePhotoURLs && multiplePhotoURLs.length > 0) {
      const validPhotos = multiplePhotoURLs.filter((url): url is string => typeof url === 'string' && url.length > 0);
      const currentPhotoIndex = validPhotos.findIndex((url) => url === avatarImageUrl);
      const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

      // Άνοιγμα με gallery navigation (βελάκια working!)
      openGalleryPhotoModal(photoModal, contact, photoIndex);

    } else if (type === 'company') {
      // 🎯 NEW: Gallery navigation για Company [logoURL, photoURL]
      const companyLogoURL = logoURL;
      const companyPhotoURL = photoURL; // Representative photo
      const galleryPhotos = [logoURL, photoURL].filter(Boolean); // Remove null/undefined

      // 🏢 ENTERPRISE: Type-safe photo filtering
      const validPhotos = galleryPhotos.filter((url): url is string => typeof url === 'string' && url.length > 0);
      if (validPhotos.length > 1) {
        // Multiple photos available - use gallery navigation
        const currentPhotoIndex = validPhotos.findIndex((url) => url === avatarImageUrl);
        const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

        // Create temporary contact with multiplePhotoURLs for gallery
        const galleryContact = { ...contact, multiplePhotoURLs: validPhotos } as Contact;
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

      // 🏢 ENTERPRISE: Type-safe photo filtering
      const validPhotos = galleryPhotos.filter((url): url is string => typeof url === 'string' && url.length > 0);
      if (validPhotos.length > 1) {
        // Multiple photos available - use gallery navigation
        const currentPhotoIndex = validPhotos.findIndex((url) => url === avatarImageUrl);
        const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

        // Create temporary contact with multiplePhotoURLs for gallery
        const galleryContact = { ...contact, multiplePhotoURLs: validPhotos } as Contact;
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
    if (!newName.trim() || !contact.id) return; // Don't save empty names or without ID

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
                label: t('header.actions.edit'),
                onClick: () => onStartEdit?.(),
                icon: Edit,
                className: GRADIENT_HOVER_EFFECTS.BLUE
              }
            ] : [
              {
                label: t('header.actions.save'),
                onClick: () => onSaveEdit?.(),
                icon: Check,
                className: GRADIENT_HOVER_EFFECTS.GREEN
              },
              {
                label: t('header.actions.cancel'),
                onClick: () => onCancelEdit?.(),
                icon: X,
                className: GRADIENT_HOVER_EFFECTS.GRAY
              }
            ]),
            // Delete Action - Μόνο αν υπάρχει το callback
            ...(onDeleteContact ? [{
              label: t('header.actions.delete'),
              onClick: () => onDeleteContact?.(),
              icon: Trash2,
              className: GRADIENT_HOVER_EFFECTS.RED
            }] : [])
          ]}
          variant="detailed"
        />
      </div>

      {/* 📱 MOBILE: Hidden (no header duplication) */}

      {/* ✅ PhotoPreviewModal τώρα global - δεν χρειάζεται εδώ */}
    </>
  );
}
