
'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactsListHeader } from './ContactsListHeader';
import { ContactsToolbar } from '../toolbar/ContactsToolbar';
import { ContactListItem } from './ContactListItem';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';

interface ContactsListProps {
  contacts: Contact[];
  selectedContact: Contact | null;
  onSelectContact?: (contact: Contact) => void;
  isLoading: boolean;
  onNewContact?: () => void;
  onEditContact?: () => void;
  onDeleteContact?: (ids?: string[]) => void;
}

export function ContactsList({
  contacts,
  selectedContact,
  onSelectContact,
  isLoading,
  onNewContact,
  onEditContact,
  onDeleteContact,
}: ContactsListProps) {
  const [favorites, setFavorites] = useState<string[]>(['1']);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleFavorite = (contactId: string) => {
    setFavorites(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    const aValue = getContactDisplayName(a).toLowerCase();
    const bValue = getContactDisplayName(b).toLowerCase();
    
    return sortOrder === 'asc' 
      ? aValue.localeCompare(bValue) 
      : bValue.localeCompare(aValue);
  });

  return (
    <div className="min-w-[300px] max-w-[420px] w-full bg-card border rounded-lg flex flex-col shrink-0 shadow-sm max-h-full overflow-hidden">
      <ContactsListHeader
        contactCount={contacts.length}
      />
      <ContactsToolbar
        onNewContact={onNewContact}
        onEditContact={onEditContact}
        onDeleteContact={onDeleteContact}
        hasSelectedContact={selectedContact !== null}
      />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 border rounded-lg">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : contacts.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <p>Δεν υπάρχουν επαφές</p>
              <p className="text-sm mt-1">Προσθέστε την πρώτη σας επαφή</p>
            </div>
          ) : (
            sortedContacts.map((contact) => (
              <ContactListItem
                key={contact.id}
                contact={contact}
                isSelected={selectedContact?.id === contact.id}
                isFavorite={favorites.includes(contact.id!)}
                onSelect={() => onSelectContact?.(contact)}
                onToggleFavorite={() => toggleFavorite(contact.id!)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
