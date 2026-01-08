
'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ContactListCard } from '@/domain';
import { CompactToolbar, contactsConfig } from '@/components/core/CompactToolbar';
import type { Contact } from '@/types/contacts';
import { Users } from 'lucide-react';
import { getContactDisplayName } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import toast from 'react-hot-toast';
import { useBorderTokens } from '@/hooks/useBorderTokens';


interface ContactsListProps {
  contacts: Contact[];
  selectedContact: Contact | null;
  onSelectContact?: (contact: Contact) => void;
  isLoading: boolean;
  onNewContact?: () => void;
  onEditContact?: () => void;
  onDeleteContact?: (ids?: string[]) => void;
  onArchiveContact?: (ids?: string[]) => void;
  onContactUpdated?: () => void;
}

export function ContactsList({
  contacts,
  selectedContact,
  onSelectContact,
  isLoading,
  onNewContact,
  onEditContact,
  onDeleteContact,
  onArchiveContact,
  onContactUpdated
}: ContactsListProps) {
  const { quick } = useBorderTokens();
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [togglingFavorites, setTogglingFavorites] = useState<Set<string>>(new Set());

  // CompactToolbar state
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  const toggleFavorite = async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || togglingFavorites.has(contactId)) return;

    try {
      // Add to loading set
      setTogglingFavorites(prev => new Set([...prev, contactId]));

      // Toggle favorite in database
      await ContactsService.toggleFavorite(contactId, contact.isFavorite || false);

      // Show success message
      const message = contact.isFavorite
        ? `Αφαιρέθηκε από τα αγαπημένα: ${getContactDisplayName(contact)}`
        : `Προστέθηκε στα αγαπημένα: ${getContactDisplayName(contact)}`;
      toast.success(message);

      // Refresh contacts list
      onContactUpdated?.();

    } catch (error) {
      // Error logging removed
      toast.error('Αποτυχία ενημέρωσης αγαπημένου');
    } finally {
      // Remove from loading set
      setTogglingFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm) return true;

    const displayName = getContactDisplayName(contact).toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    // Search in name, company name, emails, and phones
    return displayName.includes(searchLower) ||
           (contact.companyName && contact.companyName.toLowerCase().includes(searchLower)) ||
           (contact.serviceName && contact.serviceName.toLowerCase().includes(searchLower)) ||
           (contact.emails && contact.emails.some(email => email.email.toLowerCase().includes(searchLower))) ||
           (contact.phones && contact.phones.some(phone => phone.number.includes(searchTerm)));
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const aValue = (getContactDisplayName(a) || '').toLowerCase();
    const bValue = (getContactDisplayName(b) || '').toLowerCase();

    return sortOrder === 'asc'
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  return (
    <div className={`min-w-[300px] max-w-[420px] w-full bg-card ${quick.card} flex flex-col shrink-0 shadow-sm max-h-full overflow-hidden`}>


      {/* Header with conditional CompactToolbar */}
      <div>
        <GenericListHeader
          icon={Users}
          entityName="Επαφές"
          itemCount={contacts.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Αναζήτηση επαφών..."
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
        />

        {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
        <div className="hidden md:block">
          <CompactToolbar
            config={contactsConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm=""
            onSearchChange={() => {}}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy as any}
            onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          hasSelectedContact={selectedContact !== null}
          onNewItem={onNewContact}
          onEditItem={(id) => selectedContact && onEditContact?.()}
          onDeleteItems={(ids) => selectedContact && onDeleteContact?.([selectedContact.id!])}
          onExport={() => {
            // Debug logging removed
          }}
          onRefresh={() => {
            // Debug logging removed
          }}
          onFavoritesManagement={() => {
            // Debug logging removed
          }}
          onShare={() => {
            // Debug logging removed
          }}
          onSettings={() => {
            // Debug logging removed
          }}
        />
        </div>

        {/* CompactToolbar - Toggleable on Mobile */}
        <div className="md:hidden">
          {showToolbar && (
          <CompactToolbar
            config={contactsConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm=""
            onSearchChange={() => {}}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy as any}
            onSortChange={(newSortBy, newSortOrder) => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
          }}
          hasSelectedContact={selectedContact !== null}
          onNewItem={onNewContact}
          onEditItem={(id) => selectedContact && onEditContact?.()}
          onDeleteItems={(ids) => selectedContact && onDeleteContact?.([selectedContact.id!])}
          onExport={() => {
            // Debug logging removed
          }}
          onRefresh={() => {
            // Debug logging removed
          }}
          onFavoritesManagement={() => {
            // Debug logging removed
          }}
          onShare={() => {
            // Debug logging removed
          }}
          onSettings={() => {
            // Debug logging removed
          }}
        />
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`p-3 ${quick.card}`}>
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
              <ContactListCard
                key={contact.id}
                contact={contact}
                isSelected={selectedContact?.id === contact.id}
                isFavorite={contact.isFavorite || false}
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
