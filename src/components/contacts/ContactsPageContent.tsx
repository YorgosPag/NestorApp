'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { CONTACT_TYPES } from '@/constants/contacts';
import { ContactsHeader } from './page/ContactsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import {
  Users,
  Building2,
  Landmark,
  Activity,
  UserPlus,
  X,
  Filter,
  BrainCircuit,
  TrendingUp,
  Crown,
  Calendar,
  Star,
  Briefcase,
  Edit,
  Trash2,
} from 'lucide-react';
import { ContactsList } from './list/ContactsList';
import { ContactDetails } from './details/ContactDetails';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { TabbedAddNewContactDialog } from './dialogs/TabbedAddNewContactDialog';
import { EditContactDialog } from './dialogs/EditContactDialog';
import { DeleteContactDialog } from './dialogs/DeleteContactDialog';
import { ArchiveContactDialog } from './dialogs/ArchiveContactDialog';
import { AdvancedFiltersPanel, type ContactFilterState, contactFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { MobileCompactHeader } from '@/core/headers';
import { CompactToolbar, contactsConfig } from '@/components/core/CompactToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🚫 MOCK DATA ΕΝΤΕΛΩΣ ΑΦΑΙΡΕΜΕΝΑ - Καθαρή εφαρμογή χωρίς seed functionality

export function ContactsPageContent() {
  // 🏢 ENTERPRISE: Centralized icon sizes
  const iconSizes = useIconSizes();
  const { getDirectionalBorder, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // URL parameters
  const searchParams = useSearchParams();
  const router = useRouter();

  // Database state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false);
  const [showArchiveContactDialog, setShowArchiveContactDialog] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Mobile-only filter toggle state
  const [showFilters, setShowFilters] = useState(false);

  // Mobile-only compact toolbar toggle state
  const [showCompactToolbar, setShowCompactToolbar] = useState(false);

  // 🏢 ENTERPRISE: Search term now unified in filters.searchTerm (AdvancedFiltersPanel)

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

      // 🚫 SEED DATA ΠΛΗΡΩΣ ΑΦΑΙΡΕΜΕΝΑ - Καθαρή έναρξη χωρίς sample data
      // Η βάση δεδομένων θα παραμείνει άδεια μέχρι να προσθέσει ο χρήστης επαφές
    } catch (err) {
      // Error logging removed
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Αποτυχία φόρτωσης επαφών: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [filters.showArchived]);

  // 🚀 ENTERPRISE PERFORMANCE: Direct contact fetch για instant loading
  const loadSpecificContact = useCallback(async (contactId: string) => {
    try {
      console.log('🚀 PERFORMANCE: Direct fetching specific contact:', contactId);

      const contact = await ContactsService.getContact(contactId);

      if (contact) {
        console.log('⚡ INSTANT: Contact loaded directly:', getContactDisplayName(contact));

        // Set the specific contact immediately
        setSelectedContact(contact);

        // Add to contacts list if not already there
        setContacts(prev => {
          const exists = prev.find(c => c.id === contactId);
          if (exists) return prev;
          return [contact, ...prev];
        });

        return contact;
      } else {
        console.warn('⚠️ CONTACT NOT FOUND:', contactId);
        return null;
      }
    } catch (err) {
      console.error('❌ Error loading specific contact:', err);
      return null;
    }
  }, []);

  // 🚫 SEED LOGIC ΑΦΑΙΡΕΘΗΚΕ - Δεν υπάρχει πλέον seeding functionality

  const refreshContacts = async () => {
    await loadContacts();
  };

  // 🚀 ENTERPRISE LOADING STRATEGY: Smart loading based on URL parameters
  useEffect(() => {
    const contactIdParam = searchParams.get('contactId');

    if (contactIdParam) {
      // 🚀 INSTANT STRATEGY: Direct contact fetch για immediate display
      console.log('🚀 ENTERPRISE: Using direct contact fetch strategy for:', contactIdParam);

      // First: Load specific contact INSTANTLY
      loadSpecificContact(contactIdParam).then(contact => {
        if (contact) {
          // Clear search terms to focus on this contact
          setFilters(prev => ({ ...prev, searchTerm: '' }));
          setActiveCardFilter(null);
        }
      });

      // Second: Load full contacts list in BACKGROUND (for navigation)
      setTimeout(() => {
        console.log('📋 BACKGROUND: Loading full contacts list...');
        loadContacts();
      }, 100); // Small delay to prioritize specific contact
    } else {
      // Normal strategy: Load all contacts
      loadContacts();
    }
  }, []); // Load once on mount

  // 🎯 URL FILTERING: Handle filter parameter (not contactId)
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const contactIdParam = searchParams.get('contactId');

    // Only handle filter param if no contactId (contactId has priority)
    if (filterParam && !contactIdParam) {
      console.log('🔍 FILTERING: Applying URL filter:', filterParam);
      setFilters(prev => ({ ...prev, searchTerm: decodeURIComponent(filterParam) }));
      setActiveCardFilter(null);
    }
  }, [searchParams, setFilters]);

  // 🧹 CLEAR FILTER: Function για καθάρισμα του URL filter και contactId
  const handleClearURLFilter = () => {
    console.log('🧹 FILTERING: Clearing URL filter and contactId');
    setFilters(prev => ({ ...prev, searchTerm: '' }));
    setSelectedContact(null);
    // Navigate back to contacts without any parameters
    router.push('/contacts');
  };

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
    // 🎯 PRIORITY: If contactId is provided, don't filter - show all contacts
    const contactIdParam = searchParams.get('contactId');
    if (contactIdParam) {
      return true; // Show all contacts when viewing specific contact
    }

    // 🔥 NEW: Dashboard card filtering (highest priority)
    if (activeCardFilter) {
      switch (activeCardFilter) {
        case 'Σύνολο Επαφών':
          // Show all contacts - no additional filtering needed
          break;
        case 'Σύνολο Προσωπικού':
          if (contact.type !== 'individual') return false;
          break;
        case 'Νομικά Πρόσωπα':
          if (contact.type !== 'company') return false;
          break;
        case 'Ενεργές Επαφές':
          if ((contact as any).status === 'inactive') return false;
          break;
        case 'Υπηρεσίες':
          if (contact.type !== 'service') return false;
          break;
        case 'Πρόσφατες Προσθήκες':
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          if (!contact.createdAt || new Date(contact.createdAt) <= oneMonthAgo) return false;
          break;
        case 'Αγαπημένες':
          if (!contact.isFavorite) return false;
          break;
        case 'Επαφές με Σχέσεις':
          if (contact.type === CONTACT_TYPES.SERVICE) return false;
          break;
      }
    }

    // 🏢 ENTERPRISE: Unified search filter (from filters.searchTerm in AdvancedFiltersPanel)
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

  // 📊 Enhanced Dashboard Stats (8 κάρτες σε 4+4 layout)
  const dashboardStats: DashboardStat[] = [
    // 🔝 Πάνω σειρά (4 κάρτες) - Βασικά Στοιχεία
    {
      title: "Σύνολο Επαφών",
      value: contacts.length,
      icon: Users,
      color: "blue"
    },
    {
      title: "Σύνολο Προσωπικού",
      value: contacts.filter((c: any) =>
        // Count all relationships where someone is an employee
        // This is a placeholder - will be enhanced with relationship data
        c.type === 'individual'
      ).length,
      icon: Briefcase,
      color: "green"
    },
    {
      title: "Νομικά Πρόσωπα",
      value: contacts.filter(c => c.type === 'company').length,
      icon: Building2,
      color: "purple"
    },
    {
      title: "Ενεργές Επαφές",
      value: contacts.filter((c: any) => c.status === 'active' || !c.status).length,
      icon: Activity,
      color: "cyan"
    },

    // 🔽 Κάτω σειρά (4 κάρτες) - Λεπτομέρειες
    {
      title: "Υπηρεσίες",
      value: contacts.filter(c => c.type === 'service').length,
      icon: Landmark,
      color: "orange"
    },
    {
      title: "Πρόσφατες Προσθήκες",
      value: contacts.filter(c => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return c.createdAt && new Date(c.createdAt) > oneMonthAgo;
      }).length,
      icon: Calendar,
      color: "pink"
    },
    {
      title: "Αγαπημένες",
      value: contacts.filter(c => c.isFavorite).length,
      icon: Star,
      color: "yellow"
    },
    {
      title: "Επαφές με Σχέσεις",
      value: contacts.filter(c => {
        // This is a placeholder - will be enhanced with relationship data
        // For now, count non-service contacts (individuals + companies that might have relationships)
        return c.type === 'individual' || c.type === 'company';
      }).length,
      icon: TrendingUp,
      color: "indigo"
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

  // 🏷️ RENDER: Filter indicator component
  const renderFilterIndicator = () => {
    const filterParam = searchParams.get('filter');
    const contactIdParam = searchParams.get('contactId');

    // Show indicator if we have either filter or contactId
    if (!filterParam && !contactIdParam) return null;

    // Priority: If we have contactId and selected contact, show contact name
    if (contactIdParam && selectedContact) {
      const contactName = getContactDisplayName(selectedContact);
      return (
        <div className={`px-4 py-2 ${colors.bg.success} ${getDirectionalBorder('success', 'bottom')}`}>
          <div className="flex items-center justify-between max-w-full">
            <div className="flex items-center space-x-2">
              <Filter className={`${iconSizes.sm} ${colors.text.success}`} />
              <span className={`text-sm ${colors.text.success}`}>
                Προβολή πελάτη: <strong>{contactName}</strong>
              </span>
              <span className={`text-xs ${colors.text.success} ${colors.bg.successSubtle} px-2 py-1 rounded`}>
                Επιλεγμένη επαφή
              </span>
            </div>
            <button
              onClick={handleClearURLFilter}
              className={`flex items-center space-x-1 px-2 py-1 text-sm ${colors.text.success} rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST}`}
              title="Επιστροφή στη λίστα επαφών"
            >
              <X className={iconSizes.sm} />
              <span>Επιστροφή</span>
            </button>
          </div>
        </div>
      );
    }

    // Fallback: Show general filter if no contactId
    if (filterParam) {
      const filterValue = decodeURIComponent(filterParam);
      return (
        <div className={`px-4 py-2 ${colors.bg.info} ${getDirectionalBorder('info', 'bottom')}`}>
          <div className="flex items-center justify-between max-w-full">
            <div className="flex items-center space-x-2">
              <Filter className={`${iconSizes.sm} ${colors.text.info}`} />
              <span className={`text-sm ${colors.text.info}`}>
                Φιλτράρισμα για: <strong>"{filterValue}"</strong>
              </span>
              <span className={`text-xs ${colors.text.info} ${colors.bg.infoSubtle} px-2 py-1 rounded`}>
                {filteredContacts.length} επαφή{filteredContacts.length !== 1 ? 'ς' : ''}
              </span>
            </div>
            <button
              onClick={handleClearURLFilter}
              className={`flex items-center space-x-1 px-2 py-1 text-sm ${colors.text.info} rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST}`}
              title="Εμφάνιση όλων των επαφών"
            >
              <X className={iconSizes.sm} />
              <span>Καθάρισμα</span>
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <TooltipProvider>
      <PageContainer ariaLabel="Διαχείριση Επαφών">
        {/* Main Header - Works for both desktop and mobile */}
        {/* 🏢 ENTERPRISE: Search removed from header - using unified search in AdvancedFiltersPanel */}
        <ContactsHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
          onNewContact={handleNewContact}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          contactCount={contacts.length}
        />


        {/* 🏷️ Filter Indicator - εμφανίζεται όταν υπάρχει URL filter */}
        {renderFilterIndicator()}

        {showDashboard && (
          <section className="w-full overflow-hidden" role="region" aria-label="Στατιστικά Επαφών">
            <UnifiedDashboard
              stats={dashboardStats}
              columns={4}
              onCardClick={handleCardClick}
              className={`px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden`}
            />
          </section>
        )}

        {/* Advanced Filters Panel */}
        <aside className="hidden md:block" role="complementary" aria-label="Φίλτρα Αναζήτησης">
          {/* Desktop: Always visible */}
          <AdvancedFiltersPanel
            config={contactFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Mobile: Show only when showFilters is true */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label="Φίλτρα Αναζήτησης Mobile">
            <AdvancedFiltersPanel
              config={contactFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen={true}
            />
          </aside>
        )}

        <ListContainer>
          {error ? (
            <section className={`w-full text-center p-8 bg-card rounded-lg ${getStatusBorder('error')}`} role="alert" aria-label="Σφάλμα Φόρτωσης">
              <p className="text-destructive font-medium">⚠️ {error}</p>
              <button
                onClick={refreshContacts}
                className={`mt-2 px-4 py-2 bg-primary text-primary-foreground rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY}`}
              >
                Επανάληψη
              </button>
            </section>
          ) : viewMode === 'list' ? (
            <>
              {/* 🖥️ DESKTOP: Standard split layout - Same as Units/Projects/Buildings */}
              <section className="hidden md:flex flex-1 gap-4 min-h-0" role="region" aria-label="Λίστα και Λεπτομέρειες Desktop">
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
                  onContactUpdated={refreshContacts}
                />
              </section>

              {/* 📱 MOBILE: Show only ContactsList when no contact is selected */}
              <section className={`md:hidden w-full ${selectedContact ? 'hidden' : 'block'}`} role="region" aria-label="Λίστα Επαφών Mobile">
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
              </section>

              {/* 📱 MOBILE: Slide-in ContactDetails when contact is selected */}
              <MobileDetailsSlideIn
                isOpen={!!selectedContact}
                onClose={() => setSelectedContact(null)}
                title={selectedContact ? getContactDisplayName(selectedContact) : 'Λεπτομέρειες'}
                actionButtons={
                  <>
                    <button
                      onClick={() => handleEditContact()}
                      className={`p-2 rounded-md border ${colors.bg.primary} border-border ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      aria-label="Επεξεργασία Επαφής"
                    >
                      <Edit className={iconSizes.sm} />
                    </button>
                    <button
                      onClick={() => handleDeleteContacts()}
                      className={`p-2 rounded-md border ${colors.bg.primary} border-border text-destructive ${INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_GHOST} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      aria-label="Διαγραφή Επαφής"
                    >
                      <Trash2 className={iconSizes.sm} />
                    </button>
                  </>
                }
              >
                {selectedContact && (
                  <ContactDetails
                    contact={livePreviewContact || selectedContact}
                    onEditContact={handleEditContact}
                    onDeleteContact={() => handleDeleteContacts()}
                    onContactUpdated={refreshContacts}
                  />
                )}
              </MobileDetailsSlideIn>
            </>
          ) : (
            <section className="w-full text-center p-8 bg-card rounded-lg border" role="region" aria-label="Προβολή Πλέγματος">
                Προβολή πλέγματος (Grid View) θα υλοποιηθεί σύντομα.
            </section>
          )}
        </ListContainer>

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
      </PageContainer>
    </TooltipProvider>
  );
}

// Default export για compatibility
export default ContactsPageContent;
