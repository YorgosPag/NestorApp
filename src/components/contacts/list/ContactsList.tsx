
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
// 🏢 ENTERPRISE: Centralized sharing system (SSoT)
import { ShareModal } from '@/components/ui/ShareModal';
import type { ShareData } from '@/components/ui/email-sharing/EmailShareForm';
// 🏢 ENTERPRISE: Centralized data exchange (SSoT - DataExportService/DataImportService)
import { exportContacts } from '@/utils/contacts/contact-data-exchange';
import { ImportContactsDialog } from '@/components/contacts/dialogs/ImportContactsDialog';
import type { ContactImportRecord } from '@/utils/contacts/contact-data-exchange';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';


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
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('contacts');
  // 🏢 ENTERPRISE: Using SortField type for toolbar compatibility
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [togglingFavorites, setTogglingFavorites] = useState<Set<string>>(new Set());

  // 🏢 ENTERPRISE: CompactToolbar state - using string[] for contact IDs
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // 🏢 ENTERPRISE: Quick filter state for contact types
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  // 🏢 ENTERPRISE: Centralized share modal state (SSoT - ShareModal)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  // 🏢 ENTERPRISE: Import dialog state (SSoT - DataImportService)
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const toggleFavorite = async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || togglingFavorites.has(contactId)) return;

    try {
      // Add to loading set
      setTogglingFavorites(prev => new Set([...prev, contactId]));

      // Toggle favorite in database
      await ContactsService.toggleFavorite(contactId, contact.isFavorite || false);

      // Show success message
      const contactName = getContactDisplayName(contact);
      const message = contact.isFavorite
        ? t('list.favorites.removed', { name: contactName })
        : t('list.favorites.added', { name: contactName });
      toast.success(message);

      // Refresh contacts list
      onContactUpdated?.();

    } catch (error) {
      // Error logging removed
      toast.error(t('list.favorites.error'));
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

  // 🏢 ENTERPRISE: Export handler using centralized DataExportService (SSoT)
  const handleExportContact = async () => {
    if (!selectedContact) {
      toast.error(t('export.noContactSelected'));
      return;
    }
    try {
      await exportContacts([selectedContact], 'csv');
      toast.success(t('export.success'));
    } catch {
      toast.error('Export failed');
    }
  };

  // 🏢 ENTERPRISE: Import handler — opens ImportContactsDialog
  const handleImportContacts = () => {
    setImportDialogOpen(true);
  };

  // 🏢 ENTERPRISE: Import complete — save contacts to Firestore
  const handleImportComplete = async (records: ContactImportRecord[]) => {
    let saved = 0;
    for (const record of records) {
      try {
        const contactData: Record<string, unknown> = {
          type: record.type || 'individual',
          status: record.status || 'active',
          isFavorite: false,
          notes: record.notes || '',
          tags: record.tags ? record.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        };

        // Type-specific fields
        if (record.type === 'individual') {
          contactData.firstName = record.firstName || record.displayName || '';
          contactData.lastName = record.lastName || '';
          contactData.profession = record.profession || '';
        } else if (record.type === 'company') {
          contactData.companyName = record.companyName || record.displayName || '';
          contactData.vatNumber = record.vatNumber || '';
        } else if (record.type === 'service') {
          contactData.serviceName = record.serviceName || record.displayName || '';
          contactData.serviceType = 'other';
        }

        // Communication arrays
        if (record.primaryEmail) {
          contactData.emails = [{ email: record.primaryEmail, type: 'work', isPrimary: true }];
        }
        if (record.primaryPhone) {
          contactData.phones = [{ number: record.primaryPhone, type: 'mobile', isPrimary: true }];
        }

        // Address
        if (record.street || record.city) {
          contactData.addresses = [{
            street: record.street || '',
            city: record.city || '',
            postalCode: record.postalCode || '',
            region: record.region || '',
            municipality: record.municipality || '',
            country: 'GR',
            type: 'work',
            isPrimary: true,
          }];
        }

        await ContactsService.createContact(contactData);
        saved++;
      } catch {
        // Continue with next record on error
      }
    }
    if (saved > 0) {
      toast.success(t('import.success', { count: saved }));
      onContactUpdated?.();
    }
  };

  // 🏢 ENTERPRISE: Centralized share handler using ShareModal (SSoT)
  const handleShareContact = () => {
    if (!selectedContact) {
      toast.error(t('list.share.noContactSelected'));
      return;
    }
    const contactName = getContactDisplayName(selectedContact);
    const contactUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/contacts?id=${selectedContact.id}`;
    setShareData({
      title: contactName,
      text: contactName,
      url: contactUrl,
    });
    setShareModalOpen(true);
  };

  return (
    <EntityListColumn hasBorder aria-label={t('list.ariaLabel')}>


      {/* Header with conditional CompactToolbar */}
      <div>
        <GenericListHeader
          icon={Users}
          entityName={t('list.entityName')}
          itemCount={filteredContacts.length}  // 🏢 ENTERPRISE: Δυναμικό count με filtered results
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t('list.searchPlaceholder')}
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
          hideSearch  // 🏢 ENTERPRISE: Κρύβουμε το search - χρησιμοποιούμε το CompactToolbar search
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
            // 🏢 ENTERPRISE: Type narrowing - filter to supported contact sort fields
            if (newSortBy === 'name' || newSortBy === 'date' || newSortBy === 'status' || newSortBy === 'type') {
              setSortBy(newSortBy);
            }
            setSortOrder(newSortOrder);
          }}
          hasSelectedContact={selectedContact !== null}
          onNewItem={onNewContact}
          onEditItem={(id) => selectedContact && onEditContact?.()}
          onDeleteItems={(ids) => selectedContact && onDeleteContact?.([selectedContact.id!])}
          onExport={handleExportContact}
          onImport={handleImportContacts}
          onRefresh={() => {
            // Debug logging removed
          }}
          onFavoritesManagement={() => {
            // Debug logging removed
          }}
          onShare={handleShareContact}
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
            // 🏢 ENTERPRISE: Type narrowing - filter to supported contact sort fields
            if (newSortBy === 'name' || newSortBy === 'date' || newSortBy === 'status' || newSortBy === 'type') {
              setSortBy(newSortBy);
            }
            setSortOrder(newSortOrder);
          }}
          hasSelectedContact={selectedContact !== null}
          onNewItem={onNewContact}
          onEditItem={(id) => selectedContact && onEditContact?.()}
          onDeleteItems={(ids) => selectedContact && onDeleteContact?.([selectedContact.id!])}
          onExport={handleExportContact}
          onImport={handleImportContacts}
          onRefresh={() => {
            // Debug logging removed
          }}
          onFavoritesManagement={() => {
            // Debug logging removed
          }}
          onShare={handleShareContact}
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
        compact
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
              <p>{t('list.empty.title')}</p>
              <p className="text-sm mt-1">{t('list.empty.subtitle')}</p>
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

      {/* 🏢 ENTERPRISE: Centralized ShareModal (SSoT - share-utils + ShareModal) */}
      {shareData && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          shareData={shareData}
          modalTitle={t('list.share.modalTitle')}
          onCopySuccess={() => toast.success(t('list.share.copied'))}
          onShareSuccess={(platform) => toast.success(t('list.share.success', { platform }))}
        />
      )}

      {/* 🏢 ENTERPRISE: Import Dialog (SSoT - DataImportService) */}
      <ImportContactsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </EntityListColumn>
  );
}
