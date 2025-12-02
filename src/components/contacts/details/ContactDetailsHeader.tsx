'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EntityDetailsHeader } from '@/core/entity-headers';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Users, Building2, Landmark, Edit, Trash2, X, Eye } from 'lucide-react';
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
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
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

  return (
    <>
      <EntityDetailsHeader
        icon={Icon}
        title={displayName}
        avatarImageUrl={avatarImageUrl}
        onAvatarClick={avatarImageUrl ? () => setIsPhotoModalOpen(true) : undefined}
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

    {/* Photo View Modal */}
    <Dialog open={isPhotoModalOpen} onOpenChange={setIsPhotoModalOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 [&>button]:hidden">
        <div className="relative">
          <button
            onClick={() => setIsPhotoModalOpen(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center justify-center bg-black/5 min-h-[400px]">
            <img
              src={avatarImageUrl}
              alt={`${displayName} ${type === 'individual' ? 'φωτογραφία' : 'λογότυπο'}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
          <div className="p-4 bg-white border-t">
            <h3 className="font-semibold text-lg text-gray-900">{displayName}</h3>
            <p className="text-sm text-gray-600">
              {type === 'individual' ? 'Φωτογραφία επαφής' : 'Λογότυπο'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
