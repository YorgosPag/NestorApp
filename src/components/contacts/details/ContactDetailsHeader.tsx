'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Landmark, Edit, Trash2 } from 'lucide-react';
import type { Contact, ContactType, ContactStatus } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';

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
  const type = contact.type as ContactType;
  const { icon: Icon, color, name: typeName } = TYPE_INFO[type] ?? TYPE_FALLBACK;
  const status = (contact as any).status as ContactStatus | undefined;

  return (
    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color} shadow-sm`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground line-clamp-1">
              {getContactDisplayName(contact)}
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
          <Button onClick={() => onEditContact?.()}>
              <Edit className="w-4 h-4 mr-2"/>
              Επεξεργασία
          </Button>
          <Button
            variant="destructive"
            onClick={() => onDeleteContact?.()}
          >
              <Trash2 className="w-4 h-4 mr-2"/>
              Διαγραφή
          </Button>
        </div>
      </div>
    </div>
  );
}
