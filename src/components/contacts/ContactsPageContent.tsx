'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { ContactsHeader } from './page/ContactsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/core/dashboards/UnifiedDashboard';
import {
  Users,
  Building2,
  Landmark,
  Activity,
  UserPlus,
} from 'lucide-react';
import { ContactsList } from './list/ContactsList';
import { ContactDetails } from './details/ContactDetails';
import { TabbedAddNewContactDialog } from './dialogs/TabbedAddNewContactDialog';
import { EditContactDialog } from './dialogs/EditContactDialog';
import { DeleteContactDialog } from './dialogs/DeleteContactDialog';
import { ArchiveContactDialog } from './dialogs/ArchiveContactDialog';
import { AdvancedFiltersPanel, type ContactFilterState, contactFiltersConfig } from '@/components/core/AdvancedFilters';

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

  // Search state (simplified - only for header search)
  const [searchTerm, setSearchTerm] = useState('');

  // 🔥 NEW: Dashboard card filtering state
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);

  // 🔥 NEW: Live preview state for real-time editing
  const [livePreviewContact, setLivePreviewContact] = useState<Contact | null>(null);

  // Advanced Filters state (unified - contains all filters)
  const [filters, setFilters] = useState<ContactFilterState>({
    searchTerm: '',
    company: [],
    status: [],
    contactType: 'all',
    unitsCount: 'all',
    totalArea: 'all',
    hasProperties: false,
    isFavorite: false,
    showArchived: false,
    tags: [],
    dateRange: {
      from: undefined,
      to: undefined
    }
  });

  // Database operations
  const loadContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Debug logging removed

      const contactsResult = await ContactsService.getAllContacts({
        limitCount: 50,
        orderByField: 'updatedAt',
        orderDirection: 'desc',
        includeArchived: filters.showArchived
      });

      // 🔄 CACHE INVALIDATION: Log fresh contact data
      console.log('🔄 CONTACTS PAGE: Loaded fresh contacts from database', {
        count: contactsResult.contacts.length,
        contactsWithPhotos: contactsResult.contacts.filter(c => (c as any).multiplePhotoURLs?.length > 0).length
      });
      setContacts(contactsResult.contacts);

      // Αν είναι άδεια η βάση, προσθέτουμε seed data
      if (contactsResult.contacts.length === 0) {
        // Debug logging removed
        await seedDatabase();
      }
    } catch (err) {
      // Error logging removed
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Αποτυχία φόρτωσης επαφών: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [filters.showArchived]);

  const seedDatabase = async () => {
    try {
      // Debug logging removed
      const promises = SEED_CONTACTS.map(contactData =>
        ContactsService.createContact(contactData)
      );
      await Promise.all(promises);
      // Debug logging removed
      // Reload contacts after seeding
      await refreshContacts();
    } catch (err) {
      // Error logging removed
    }
  };

  const refreshContacts = async () => {
    await loadContacts();
  };

  // Load contacts on component mount and when archived filter changes
  useEffect(() => {
    loadContacts();
  }, []); // 🔧 FIX: Removed loadContacts to prevent infinite loop - load once on mount

  // 🔥 ENTERPRISE CACHE INVALIDATION: Global event listener
  useEffect(() => {
    const handleContactsUpdate = (event: CustomEvent) => {
      console.log('🔄 CONTACTS PAGE: Received cache invalidation event', event.detail);
      // Force immediate refresh of all contact data
      refreshContacts();

      // 🔥 CRITICAL: Update selectedContact if it was the one modified
      const { contactId } = event.detail;
      if (selectedContact?.id === contactId) {
        console.log('🔄 CONTACTS PAGE: Selected contact was modified, will update after refresh');
        // The selectedContact will be updated by the useEffect below after contacts reload
      }
    };

    // Listen για global cache invalidation events
    window.addEventListener('contactsUpdated', handleContactsUpdate as EventListener);

    return () => {
      window.removeEventListener('contactsUpdated', handleContactsUpdate as EventListener);
    };
  }, [selectedContact]);

  // Update selected contact when contacts list changes
  useEffect(() => {
    if (selectedContact?.id) {
      const updatedContact = contacts.find(c => c.id === selectedContact.id);
      if (updatedContact && JSON.stringify(updatedContact) !== JSON.stringify(selectedContact)) {
        console.log('🔄 CONTACTS PAGE: Updating selectedContact with fresh data', {
          contactId: selectedContact.id,
          oldPhotos: (selectedContact as any).multiplePhotoURLs?.length || 0,
          newPhotos: (updatedContact as any).multiplePhotoURLs?.length || 0
        });
        setSelectedContact(updatedContact);

        // 🔥 FORCE RE-RENDER: Avatar components need key-based invalidation
        const photoCount = (updatedContact as any).multiplePhotoURLs?.length || 0;
        window.dispatchEvent(new CustomEvent('forceAvatarRerender', {
          detail: {
            contactId: selectedContact.id,
            photoCount,
            timestamp: Date.now()
          }
        }));
        console.log('🔄 CONTACTS PAGE: Dispatched force avatar re-render event');
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
      // 🔥 Initialize live preview with current contact data
      setLivePreviewContact(selectedContact);
    }
  };

  // 🔥 NEW: Handle live changes from edit form (memoized to prevent infinite loops)
  const handleLiveChange = useCallback((updatedContact: Contact) => {
    setLivePreviewContact(updatedContact);
  }, []);

  // 🔥 NEW: Reset live preview when edit dialog closes
  const handleEditDialogClose = (open: boolean) => {
    setShowEditContactDialog(open);
    if (!open) {
      setLivePreviewContact(null);
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
      if (selectedContact?.id) {
        setSelectedContactIds([selectedContact.id]);
      } else {
        setSelectedContactIds([]);
      }
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
      if (selectedContact?.id) {
        setSelectedContactIds([selectedContact.id]);
      } else {
        setSelectedContactIds([]);
      }
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


  // Filter contacts based on unified filters
  const filteredContacts = contacts.filter(contact => {
    // 🔥 NEW: Dashboard card filtering (highest priority)
    if (activeCardFilter) {
      switch (activeCardFilter) {
        case 'Σύνολο':
          // Show all contacts - no additional filtering needed
          break;
        case 'Φυσικά Πρόσωπα':
          if (contact.type !== 'individual') return false;
          break;
        case 'Νομικά Πρόσωπα':
          if (contact.type !== 'company') return false;
          break;
        case 'Υπηρεσίες':
          if (contact.type !== 'service') return false;
          break;
        case 'Ενεργές':
          if ((contact as any).status !== 'active') return false;
          break;
        case 'Νέες (Μήνας)':
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          if (!contact.createdAt || new Date(contact.createdAt) <= oneMonthAgo) return false;
          break;
      }
    }

    // Header search filter (separate from advanced filters search)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const displayName = getContactDisplayName(contact).toLowerCase();
      if (!displayName.includes(searchLower)) {
        return false;
      }
    }

    // Advanced filters search (from filters.searchTerm)
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const displayName = getContactDisplayName(contact).toLowerCase();
      if (!displayName.includes(searchLower)) {
        return false;
      }
    }

    // Contact type filter (unless overridden by card filter)
    if (!activeCardFilter && filters.contactType !== 'all' && contact.type !== filters.contactType) {
      return false;
    }

    // Favorites filter
    if (filters.isFavorite && !contact.isFavorite) {
      return false;
    }

    // Property ownership filter
    if (filters.hasProperties) {
      // TODO: Implement property ownership check when contact-property relationship is available
      // For now, skip this filter
    }

    // Units count and area filters would require contact-property relationship data
    // TODO: Implement when contact property data is available

    return true;
  });

  // Transform stats to UnifiedDashboard format
  const dashboardStats: DashboardStat[] = [
    {
      title: "Σύνολο",
      value: contacts.length,
      icon: Users,
      color: "blue"
    },
    {
      title: "Φυσικά Πρόσωπα",
      value: contacts.filter(c => c.type === 'individual').length,
      icon: Users,
      color: "green"
    },
    {
      title: "Νομικά Πρόσωπα",
      value: contacts.filter(c => c.type === 'company').length,
      icon: Building2,
      color: "purple"
    },
    {
      title: "Υπηρεσίες",
      value: contacts.filter(c => c.type === 'service').length,
      icon: Landmark,
      color: "orange"
    },
    {
      title: "Ενεργές",
      value: contacts.filter((c: any) => c.status === 'active').length,
      icon: Activity,
      color: "cyan"
    },
    {
      title: "Νέες (Μήνας)",
      value: contacts.filter(c => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return c.createdAt && new Date(c.createdAt) > oneMonthAgo;
      }).length,
      icon: UserPlus,
      color: "pink"
    }
  ];

  // 🔥 NEW: Handle dashboard card clicks για filtering
  const handleCardClick = (stat: DashboardStat, index: number) => {
    const cardTitle = stat.title;

    // Toggle filter: αν κλικάρουμε την ίδια κάρτα, αφαιρούμε το φίλτρο
    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      console.log('🔄 FILTER: Removing card filter');
    } else {
      setActiveCardFilter(cardTitle);
      console.log('🔽 FILTER: Applying card filter:', cardTitle);

      // Clear selected contact when filtering changes
      setSelectedContact(null);
    }
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
          onNewContact={handleNewContact}
        />

        {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={6} onCardClick={handleCardClick} />}

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
              />
              <ContactDetails
                contact={livePreviewContact || selectedContact}
                onEditContact={handleEditContact}
                onDeleteContact={() => handleDeleteContacts()}
              />
            </>
          ) : (
            <div className="w-full text-center p-8 bg-card rounded-lg border">
                Προβολή πλέγματος (Grid View) θα υλοποιηθεί σύντομα.
            </div>
          )}
        </div>

        {/* Dialog για νέα επαφή */}
        <TabbedAddNewContactDialog
          open={showNewContactDialog}
          onOpenChange={setShowNewContactDialog}
          onContactAdded={handleContactAdded}
        />

        {/* Dialog για επεξεργασία επαφής */}
        <EditContactDialog
          open={showEditContactDialog}
          onOpenChange={handleEditDialogClose}
          contact={selectedContact}
          onContactUpdated={handleContactUpdated}
          onLiveChange={handleLiveChange}
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
