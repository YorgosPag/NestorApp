'use client';

import React, { useState, useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { ContactsHeader } from './page/ContactsHeader';
import { ContactsDashboard } from './page/ContactsDashboard';
import { ContactsList } from './list/ContactsList';
import { ContactDetails } from './details/ContactDetails';
import { AddNewContactDialog } from './dialogs/AddNewContactDialog';
import { EditContactDialog } from './dialogs/EditContactDialog';
import { DeleteContactDialog } from './dialogs/DeleteContactDialog';
import { ArchiveContactDialog } from './dialogs/ArchiveContactDialog';
import { AdvancedFiltersPanel, contactFiltersConfig, type ContactFilterState } from '@/components/core/AdvancedFilters';

// Initial seed data for database (μόνο για πρώτη φόρτωση)
const SEED_CONTACTS = [
  {
    type: 'individual' as const,
    firstName: 'Γιώργος',
    lastName: 'Παπαδόπουλος',
    emails: [{ email: 'g.papadopoulos@example.com', type: 'work' as const, isPrimary: true }],
    phones: [{ number: '6971234567', type: 'mobile' as const, isPrimary: true }],
    isFavorite: true,
    status: 'active' as const,
  },
  {
    type: 'company' as const,
    companyName: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
    emails: [{ email: 'info@pagonis.gr', type: 'work' as const, isPrimary: true }],
    phones: [{ number: '2109876543', type: 'work' as const, isPrimary: true }],
    isFavorite: false,
    status: 'active' as const,
    vatNumber: '987654321'
  },
  {
    type: 'company' as const,
    companyName: 'TechCorp Α.Ε.',
    emails: [{ email: 'info@techcorp.gr', type: 'work' as const, isPrimary: true }],
    phones: [{ number: '2101234567', type: 'work' as const, isPrimary: true }],
    isFavorite: false,
    status: 'active' as const,
    vatNumber: '123456789'
  },
  {
    type: 'service' as const,
    serviceName: "ΔΟΥ Α' Θεσσαλονίκης",
    emails: [{ email: 'doy.a.thess@aade.gr', type: 'work' as const, isPrimary: true }],
    phones: [{ number: '2310555111', type: 'work' as const, isPrimary: true }],
    isFavorite: false,
    status: 'active' as const,
    serviceType: 'tax_office' as const
  },
  {
    type: 'individual' as const,
    firstName: 'Μαρία',
    lastName: 'Ιωάννου',
    emails: [{ email: 'm.ioannou@example.com', type: 'personal' as const, isPrimary: true }],
    phones: [{ number: '6987654321', type: 'mobile' as const, isPrimary: true }],
    isFavorite: false,
    status: 'inactive' as const,
  },
];

export function ContactsPageContent() {
  // Database state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(true);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false);
  const [showArchiveContactDialog, setShowArchiveContactDialog] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Add missing search/filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'company' | 'service'>('all');
  const [showOnlyOwners, setShowOnlyOwners] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showArchivedContacts, setShowArchivedContacts] = useState(false);
  const [unitsCountFilter, setUnitsCountFilter] = useState<'all' | '1-2' | '3-5' | '6+'>('all');
  const [areaFilter, setAreaFilter] = useState<'all' | '0-100' | '101-300' | '301+'>('all');

  // Advanced Filters state
  const [filters, setFilters] = useState<ContactFilterState>({
    searchTerm: '',
    company: [],
    status: [],
    tags: [],
    dateRange: {
      from: undefined,
      to: undefined
    }
  });

  // Database operations
  const loadContacts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Starting to load contacts...');

      const contactsResult = await ContactsService.getAllContacts({
        limitCount: 50,
        orderByField: 'updatedAt',
        orderDirection: 'desc',
        includeArchived: showArchivedContacts
      });

      console.log('📋 Contacts loaded:', contactsResult);
      setContacts(contactsResult.contacts);

      // Αν είναι άδεια η βάση, προσθέτουμε seed data
      if (contactsResult.contacts.length === 0) {
        console.log('Empty database, seeding with initial data...');
        await seedDatabase();
      }
    } catch (err) {
      console.error('❌ Error loading contacts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Αποτυχία φόρτωσης επαφών: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const seedDatabase = async () => {
    try {
      console.log('Seeding database with initial contacts...');
      const promises = SEED_CONTACTS.map(contactData =>
        ContactsService.createContact(contactData)
      );
      await Promise.all(promises);
      console.log('Database seeded successfully');
      // Reload contacts after seeding
      await refreshContacts();
    } catch (err) {
      console.error('Error seeding database:', err);
    }
  };

  const refreshContacts = async () => {
    await loadContacts();
  };

  // Load contacts on component mount and when archived filter changes
  useEffect(() => {
    loadContacts();
  }, [showArchivedContacts]);

  // Update selected contact when contacts list changes
  useEffect(() => {
    if (selectedContact?.id) {
      const updatedContact = contacts.find(c => c.id === selectedContact.id);
      if (updatedContact && JSON.stringify(updatedContact) !== JSON.stringify(selectedContact)) {
        setSelectedContact(updatedContact);
      }
    }
  }, [contacts, selectedContact?.id]);

  const handleNewContact = () => {
    setShowNewContactDialog(true);
  };

  const handleContactAdded = async () => {
    setShowNewContactDialog(false);
    await refreshContacts();
  };

  const handleEditContact = () => {
    if (selectedContact) {
      setShowEditContactDialog(true);
    }
  };

  const handleContactUpdated = async () => {
    setShowEditContactDialog(false);
    await refreshContacts();
  };

  const handleDeleteContacts = (ids?: string[]) => {
    if (ids && ids.length > 0) {
      setSelectedContactIds(ids);
    } else {
      // Χρησιμοποίησε την τρέχουσα επιλεγμένη επαφή
      setSelectedContactIds([]);
    }
    setShowDeleteContactDialog(true);
  };

  const handleContactsDeleted = async () => {
    setShowDeleteContactDialog(false);

    // Αν διαγράφηκε η τρέχουσα επιλεγμένη επαφή, καθάρισε την επιλογή
    if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
      setSelectedContact(null);
    }

    setSelectedContactIds([]);
    await refreshContacts();
  };

  const handleArchiveContacts = (ids?: string[]) => {
    if (ids && ids.length > 0) {
      setSelectedContactIds(ids);
    } else {
      // Χρησιμοποίησε την τρέχουσα επιλεγμένη επαφή
      setSelectedContactIds([]);
    }
    setShowArchiveContactDialog(true);
  };

  const handleContactsArchived = async () => {
    setShowArchiveContactDialog(false);

    // Αν αρχειοθετήθηκε η τρέχουσα επιλεγμένη επαφή, καθάρισε την επιλογή
    if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
      setSelectedContact(null);
    }

    setSelectedContactIds([]);
    await refreshContacts();
  };

  const handleToggleFavoritesFilter = () => {
    setShowOnlyFavorites(prev => !prev);
  };

  const handleToggleArchivedFilter = () => {
    setShowArchivedContacts(prev => !prev);
  };

  // Filter contacts based on current filters
  const filteredContacts = contacts.filter(contact => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const displayName = getContactDisplayName(contact).toLowerCase();
      if (!displayName.includes(searchLower)) {
        return false;
      }
    }

    // Type filter
    if (filterType !== 'all' && contact.type !== filterType) {
      return false;
    }

    // Favorites filter
    if (showOnlyFavorites && !contact.isFavorite) {
      return false;
    }

    return true;
  });

  const stats = {
    totalContacts: contacts.length,
    individuals: contacts.filter(c => c.type === 'individual').length,
    companies: contacts.filter(c => c.type === 'company').length,
    services: contacts.filter(c => c.type === 'service').length,
    active: contacts.filter((c: any) => c.status === 'active').length,
    newThisMonth: contacts.filter(c => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return c.createdAt && new Date(c.createdAt) > oneMonthAgo;
    }).length,
  };
  
  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background">
        <ContactsHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          showOnlyOwners={showOnlyOwners}
          onShowOnlyOwnersChange={setShowOnlyOwners}
          showOnlyFavorites={showOnlyFavorites}
          onShowOnlyFavoritesChange={setShowOnlyFavorites}
          showArchivedContacts={showArchivedContacts}
          onShowArchivedContactsChange={setShowArchivedContacts}
          unitsCountFilter={unitsCountFilter}
          setUnitsCountFilter={setUnitsCountFilter}
          areaFilter={areaFilter}
          setAreaFilter={setAreaFilter}
          onNewContact={handleNewContact}
        />

        {showDashboard && <ContactsDashboard stats={stats} />}

        {/* Advanced Filters Panel */}
        <AdvancedFiltersPanel
          config={contactFiltersConfig}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          {error ? (
            <div className="w-full text-center p-8 bg-card rounded-lg border border-destructive/20">
              <p className="text-destructive font-medium">⚠️ {error}</p>
              <button
                onClick={refreshContacts}
                className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Επανάληψη
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <>
              <ContactsList
                contacts={filteredContacts}
                selectedContact={selectedContact}
                onSelectContact={setSelectedContact}
                isLoading={isLoading}
                onNewContact={handleNewContact}
                onEditContact={handleEditContact}
                onDeleteContact={handleDeleteContacts}
                onArchiveContact={handleArchiveContacts}
                onContactUpdated={refreshContacts}
                showOnlyFavorites={showOnlyFavorites}
                onToggleFavoritesFilter={handleToggleFavoritesFilter}
                showArchivedContacts={showArchivedContacts}
                onToggleArchivedFilter={handleToggleArchivedFilter}
              />
              <ContactDetails contact={selectedContact} onEditContact={handleEditContact} onDeleteContact={() => handleDeleteContacts()} />
            </>
          ) : (
            <div className="w-full text-center p-8 bg-card rounded-lg border">
                Προβολή πλέγματος (Grid View) θα υλοποιηθεί σύντομα.
            </div>
          )}
        </div>

        {/* Dialog για νέα επαφή */}
        <AddNewContactDialog
          open={showNewContactDialog}
          onOpenChange={setShowNewContactDialog}
          onContactAdded={handleContactAdded}
        />

        {/* Dialog για επεξεργασία επαφής */}
        <EditContactDialog
          open={showEditContactDialog}
          onOpenChange={setShowEditContactDialog}
          contact={selectedContact}
          onContactUpdated={handleContactUpdated}
        />

        {/* Dialog για διαγραφή επαφής */}
        <DeleteContactDialog
          open={showDeleteContactDialog}
          onOpenChange={setShowDeleteContactDialog}
          contact={selectedContact}
          selectedContactIds={selectedContactIds}
          onContactsDeleted={handleContactsDeleted}
        />

        {/* Dialog για αρχειοθέτηση επαφής */}
        <ArchiveContactDialog
          open={showArchiveContactDialog}
          onOpenChange={setShowArchiveContactDialog}
          contact={selectedContact}
          selectedContactIds={selectedContactIds}
          onContactsArchived={handleContactsArchived}
        />
      </div>
    </TooltipProvider>
  );
}
