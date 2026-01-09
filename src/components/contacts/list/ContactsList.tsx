
'use client';

import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ContactListCard } from '@/domain';
import { CompactToolbar, contactsConfig } from '@/components/core/CompactToolbar';
// 🏢 ENTERPRISE: Using centralized ContactTypeQuickFilters
import { ContactTypeQuickFilters } from '@/components/shared/TypeQuickFilters';
import type { Contact } from '@/types/contacts';
import { Users } from 'lucide-react';
import { getContactDisplayName } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import toast from 'react-hot-toast';
import { EntityListColumn } from '@/core/containers';
import { matchesSearchTerm } from '@/lib/search/search';


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
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [togglingFavorites, setTogglingFavorites] = useState<Set<string>>(new Set());

  // CompactToolbar state
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // 🏢 ENTERPRISE: Quick filter state for contact types
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

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

  // 🏢 ENTERPRISE: Filter contacts using centralized search
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Type filter (quick filters)
      if (selectedTypes.length > 0) {
        const contactType = contact.type || 'individual';
        if (!selectedTypes.includes(contactType)) {
          return false;
        }
      }

      // Search filter using enterprise search
      return matchesSearchTerm(
        [
          getContactDisplayName(contact),
          contact.companyName,
          contact.serviceName,
          // Flatten emails and phones
          ...(contact.emails?.map(e => e.email) || []),
          ...(contact.phones?.map(p => p.number) || [])
        ],
        searchTerm
      );
    });
  }, [contacts, selectedTypes, searchTerm]);

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const aValue = (getContactDisplayName(a) || '').toLowerCase();
    const bValue = (getContactDisplayName(b) || '').toLowerCase();

    return sortOrder === 'asc'
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  return (
    <EntityListColumn hasBorder aria-label="Λίστα Επαφών">


      {/* Header with conditional CompactToolbar */}
      <div>
        <GenericListHeader
          icon={Users}
          entityName="Επαφές"
          itemCount={filteredContacts.length}  // 🏢 ENTERPRISE: Δυναμικό count με filtered results
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Αναζήτηση επαφών..."
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
          hideSearch={true}  // 🏢 ENTERPRISE: Κρύβουμε το search - χρησιμοποιούμε το CompactToolbar search
        />

        {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
        <div className="hidden md:block">
          <CompactToolbar
            config={contactsConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
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
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
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

      {/* 🏢 ENTERPRISE: Quick Filters για τύπους επαφών */}
      <ContactTypeQuickFilters
        selectedTypes={selectedTypes}
        onTypeChange={setSelectedTypes}
        compact={true}
      />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-card">
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
    </EntityListColumn>
  );
}
