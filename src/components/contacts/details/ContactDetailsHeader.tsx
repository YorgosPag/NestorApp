'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EditButton, DeleteButton } from '@/components/ui/form/ActionButtons';
import { ContactBadge, CommonBadge } from '@/core/badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EntityDetailsHeader } from '@/core/entity-headers';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Users, Building2, Landmark, Edit, Trash2, X } from 'lucide-react';
import type { Contact, ContactType, ContactStatus } from '@/types/contacts';
import { getContactDisplayName, getContactInitials } from '@/types/contacts';
import { cn } from '@/lib/utils';

const TYPE_INFO: Record<ContactType, { icon: React.ElementType; color: string; name: string }> = {
    individual: { icon: Users, color: 'bg-blue-500', name: 'Φυσικό Πρόσωπο' },
    company: { icon: Building2, color: 'bg-purple-500', name: 'Νομικό Πρόσωπο' },
    service: { icon: Landmark, color: 'bg-green-500', name: 'Δημόσια Υπηρεσία' }
};

const TYPE_FALLBACK = { icon: Users, color: 'bg-gray-500', name: 'Άγνωστος Τύπος' };

interface ContactDetailsHeaderProps {
  contact: Contact;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
}

export function ContactDetailsHeader({ contact, onEditContact, onDeleteContact }: ContactDetailsHeaderProps) {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const type = contact.type as ContactType;
  const { icon: Icon, color, name: typeName } = TYPE_INFO[type] ?? TYPE_FALLBACK;
  const status = (contact as any).status as ContactStatus | undefined;
  const displayName = getContactDisplayName(contact);
  const initials = getContactInitials(contact);

  return (
    <>
      <EntityDetailsHeader
        icon={Icon}
        title={displayName}
        badges={[
          {
            type: 'category',
            value: typeName,
            variant: 'outline',
            size: 'sm'
          },
          {
            type: 'status',
            value: status || 'unknown',
            size: 'sm'
          }
        ]}
        actions={[
          {
            label: 'Επεξεργασία',
            onClick: () => onEditContact?.(),
            variant: 'outline'
          },
          {
            label: 'Διαγραφή',
            onClick: () => onDeleteContact?.(),
            variant: 'outline',
            className: 'text-destructive hover:text-destructive'
          }
        ]}
        avatarImageUrl={(contact as any).photoURL}
        onAvatarClick={(contact as any).photoURL ? () => setIsPhotoModalOpen(true) : undefined}
        variant="detailed"
      />

    {/* Photo View Modal */}
    <Dialog open={isPhotoModalOpen} onOpenChange={setIsPhotoModalOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <div className="relative">
          <button
            onClick={() => setIsPhotoModalOpen(false)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center justify-center bg-black/5 min-h-[400px]">
            <img
              src={(contact as any).photoURL}
              alt={`${displayName} φωτογραφία`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
          <div className="p-4 bg-white border-t">
            <h3 className="font-semibold text-lg text-gray-900">{displayName}</h3>
            <p className="text-sm text-gray-600">Φωτογραφία επαφής</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
