'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { PhotoPreviewModal, usePhotoPreviewModal, openContactAvatarModal } from '@/core/modals';
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

  // Handler για άνοιγμα photo modal
  const handleAvatarClick = () => {
    if (!avatarImageUrl) return;

    // Καθορίζουμε τον τύπο φωτογραφίας
    const photoType = type === 'company' || type === 'service' ? 'logo' : 'avatar';

    openContactAvatarModal(photoModal, contact, photoType);
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
