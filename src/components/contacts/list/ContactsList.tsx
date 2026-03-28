
'use client';

import React, { useState, useMemo } from 'react';
import { useSortState } from '@/hooks/useSortState';
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
import { useNotifications } from '@/providers/NotificationProvider';
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
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';


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
  onArchiveContact: _onArchiveContact,
  onContactUpdated
}: ContactsListProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('contacts');
  const colors = useSemanticColors();
  const { success, error } = useNotifications();
  // 🏢 ENTERPRISE: Sort state via centralized hook (ADR-205 Phase 4)
  const { sortBy, sortOrder, onSortChange } = useSortState<'name' | 'date' | 'status' | 'type'>('name');
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
      success(message);

      // Refresh contacts list
      onContactUpdated?.();

    } catch (_err) {
      error(t('list.favorites.error'));
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
      error(t('export.noContactSelected'));
      return;
    }
    try {
      await exportContacts([selectedContact], 'csv');
      success(t('export.success'));
    } catch {
      error('Export failed');
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
        const contactData: Record<string, unknown> & { type: string; status: string } = {
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

        await ContactsService.createContact(contactData as Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>);
        saved++;
      } catch {
        // Continue with next record on error
      }
    }
    if (saved > 0) {
      success(t('import.success', { count: saved }));
      onContactUpdated?.();
    }
  };

  // 🏢 ENTERPRISE: Centralized share handler using ShareModal (SSoT)
  // Builds formatted TEXT content (name, profession, email, phone) instead of URL link
  const handleShareContact = () => {
    if (!selectedContact) {
      error(t('list.share.noContactSelected'));
      return;
    }
    const contactName = getContactDisplayName(selectedContact);

    // Build formatted contact text for sharing
    const lines: string[] = [];
    lines.push(`👤 ${contactName}`);

    if (selectedContact.type === 'company' && selectedContact.companyName) {
      lines.push(`🏢 ${t('list.share.company')}: ${selectedContact.companyName}`);
    }
    if (selectedContact.type === 'service' && selectedContact.serviceName) {
      lines.push(`🔧 ${t('list.share.service')}: ${selectedContact.serviceName}`);
    }
    if ('profession' in selectedContact && selectedContact.profession) {
      lines.push(`💼 ${t('list.share.profession')}: ${selectedContact.profession}`);
    }
    // Primary email
    const primaryEmail = selectedContact.emails?.find(e => e.isPrimary) || selectedContact.emails?.[0];
    if (primaryEmail) {
      lines.push(`📧 Email: ${primaryEmail.email}`);
    }
    // Primary phone
    const primaryPhone = selectedContact.phones?.find(p => p.isPrimary) || selectedContact.phones?.[0];
    if (primaryPhone) {
      lines.push(`📞 ${t('list.share.phone')}: ${primaryPhone.number}`);
    }
    // Primary address
    const primaryAddress = selectedContact.addresses?.find(a => a.isPrimary) || selectedContact.addresses?.[0];
    if (primaryAddress) {
      const addressParts = [primaryAddress.street, primaryAddress.city, primaryAddress.postalCode].filter(Boolean);
      if (addressParts.length > 0) {
        lines.push(`📍 ${t('list.share.address')}: ${addressParts.join(', ')}`);
      }
    }

    const contactText = lines.join('\n');

    setShareData({
      title: t('list.share.modalTitle'),
      text: contactText,
      url: '', // No URL — share pure text content
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
              // Type narrowing: CompactToolbar sends SortField, hook expects narrower type
              if (newSortBy === 'name' || newSortBy === 'date' || newSortBy === 'status' || newSortBy === 'type') {
                onSortChange(newSortBy, newSortOrder);
              }
            }}
          hasSelectedContact={selectedContact !== null}
          onNewItem={onNewContact}
          onEditItem={(_id) => selectedContact && onEditContact?.()}
          onDeleteItems={(_ids) => selectedContact && onDeleteContact?.([selectedContact.id!])}
          onExport={handleExportContact}
          onImport={handleImportContacts}
          onShare={handleShareContact}
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
              // Type narrowing: CompactToolbar sends SortField, hook expects narrower type
              if (newSortBy === 'name' || newSortBy === 'date' || newSortBy === 'status' || newSortBy === 'type') {
                onSortChange(newSortBy, newSortOrder);
              }
            }}
          hasSelectedContact={selectedContact !== null}
          onNewItem={onNewContact}
          onEditItem={(_id) => selectedContact && onEditContact?.()}
          onDeleteItems={(_ids) => selectedContact && onDeleteContact?.([selectedContact.id!])}
          onExport={handleExportContact}
          onImport={handleImportContacts}
          onShare={handleShareContact}
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
            <div className={cn("text-center p-2", colors.text.muted)}>
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
          onCopySuccess={() => success(t('list.share.copied'))}
          onShareSuccess={(platform) => success(t('list.share.success', { platform }))}
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
