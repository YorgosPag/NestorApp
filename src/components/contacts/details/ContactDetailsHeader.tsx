'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EditButton, DeleteButton } from '@/components/ui/form/ActionButtons';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {(contact as any).photoURL ? (
            <Avatar
              className={cn(
                "h-12 w-12 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
              )}
              onClick={() => setIsPhotoModalOpen(true)}
            >
              <AvatarImage
                src={(contact as any).photoURL}
                alt={`${displayName} φωτογραφία`}
                className="object-cover"
              />
              <AvatarFallback className={`${color.replace('bg-', 'bg-')} text-white`}>
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color} shadow-sm`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-foreground line-clamp-1">
              {displayName}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="text-xs bg-white/90 text-gray-700">{typeName}</Badge>
              <Badge variant={status === 'active' ? 'default' : 'outline'}>
                {status === 'active' ? 'Ενεργή' : 'Ανενεργή'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <EditButton onClick={() => onEditContact?.()}>
            Επεξεργασία
          </EditButton>
          <DeleteButton onClick={() => onDeleteContact?.()}>
            Διαγραφή
          </DeleteButton>
        </div>
      </div>

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
    </div>
  );
}
