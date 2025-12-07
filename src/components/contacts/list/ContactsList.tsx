
'use client';

import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactsListHeader } from './ContactsListHeader';
import { ContactListItem } from './ContactListItem';
import { CompactToolbar, contactsConfig } from '@/components/core/CompactToolbar';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import toast from 'react-hot-toast';
import { Users, Search, Plus, Edit, Trash2, Star, Archive, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MobileCompactHeaderProps {
  contactCount: number;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedItems: number[];
  onSelectionChange: (items: number[]) => void;
  onNewContact?: () => void;
  onEditContact?: () => void;
  onDeleteContact?: (ids?: string[]) => void;
  onArchiveContact?: (ids?: string[]) => void;
}

const MobileCompactHeader: React.FC<MobileCompactHeaderProps> = ({
  contactCount,
  searchTerm,
  onSearchChange,
  selectedItems,
  onSelectionChange,
  onNewContact,
  onEditContact,
  onDeleteContact,
  onArchiveContact
}) => {
  const [showToolbar, setShowToolbar] = useState(false);

  return (
    <div className="border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
      {/* Main Row: Title + Search + Filter */}
      <div className="p-3 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-sm whitespace-nowrap">
            Επαφές ({contactCount})
          </span>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση επαφών..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>

        <Button
          onClick={() => setShowToolbar(!showToolbar)}
          size="sm"
          variant={showToolbar ? "default" : "outline"}
          className="h-8 px-2 flex-shrink-0"
        >
          <Filter className="h-3 w-3" />
        </Button>
      </div>

      {/* Collapsible Toolbar */}
      {showToolbar && (
        <div className="px-3 pb-3 flex items-center justify-between border-t border-border/50">
          <div className="flex gap-1">
            <Button
              onClick={onNewContact}
              size="sm"
              variant="outline"
              className="h-7 px-2"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              onClick={onEditContact}
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={selectedItems.length === 0}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              onClick={() => onDeleteContact?.()}
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={selectedItems.length === 0}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              onClick={() => onArchiveContact?.()}
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={selectedItems.length === 0}
            >
              <Archive className="h-3 w-3" />
            </Button>
          </div>
          <Button
            onClick={onNewContact}
            size="sm"
            className="h-7 px-3"
          >
            <Plus className="h-3 w-3 mr-1" />
            Νέα
          </Button>
        </div>
      )}
    </div>
  );
};

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
    <div className="min-w-[300px] max-w-[420px] w-full bg-card border rounded-lg flex flex-col shrink-0 shadow-sm max-h-full overflow-hidden">

      {/* Mobile: Compact Combined Header */}
      <div className="md:hidden">
        <MobileCompactHeader
          contactCount={contacts.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          onNewContact={onNewContact}
          onEditContact={onEditContact}
          onDeleteContact={onDeleteContact}
          onArchiveContact={onArchiveContact}
        />
      </div>

      {/* Desktop: Separate Headers */}
      <div className="hidden md:block">
        <ContactsListHeader
          contactCount={contacts.length}
        />

        <CompactToolbar
          config={contactsConfig}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
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
                isFavorite={contact.isFavorite || false}
                onSelect={() => onSelectContact?.(contact)}
                onToggleFavorite={() => toggleFavorite(contact.id!)}
                isTogglingFavorite={togglingFavorites.has(contact.id!)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
