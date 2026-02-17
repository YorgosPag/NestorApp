'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import type { Contact, IndividualContact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ContactUpdatedPayload } from '@/services/realtime';

// 🏢 ENTERPRISE: Type guard for contacts with photo URLs
const hasMultiplePhotoURLs = (contact: Contact): contact is IndividualContact & { multiplePhotoURLs: string[] } => {
  return 'multiplePhotoURLs' in contact && Array.isArray((contact as IndividualContact).multiplePhotoURLs);
};

// 🏢 ENTERPRISE: Type-safe Firestore timestamp to Date conversion
const toDate = (timestamp: Date | { toDate: () => Date } | undefined | null): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return null;
};
import { ContactsService } from '@/services/contacts.service';
import { CONTACT_TYPES } from '@/constants/contacts';
import { ContactsHeader } from './page/ContactsHeader';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
// ⚡ ENTERPRISE: Only import used icons - removed UserPlus, BrainCircuit, Crown (unused)
import {
  Users,
  Building2,
  Landmark,
  Activity,
  X,
  Filter,
  TrendingUp,
  Calendar,
  Star,
  Briefcase,
  Edit,
  Trash2,
} from 'lucide-react';
import { ContactsList } from './list/ContactsList';
// 🏢 ENTERPRISE: Grid view imports - Using proper GridCard (PR: Enterprise Grid System)
import { ContactGridCard } from '@/domain';
import { ContactDetails } from './details/ContactDetails';
import { MobileDetailsSlideIn } from '@/core/layouts';
// ⚡ ENTERPRISE PERFORMANCE: Dynamic imports for dialogs - loaded on demand
// Pattern: Vercel, Salesforce - dialogs are loaded only when user opens them
import dynamic from 'next/dynamic';
const TabbedAddNewContactDialog = dynamic(
  () => import('./dialogs/TabbedAddNewContactDialog').then(mod => ({ default: mod.TabbedAddNewContactDialog })),
  { ssr: false }
);
const EditContactDialog = dynamic(
  () => import('./dialogs/EditContactDialog').then(mod => ({ default: mod.EditContactDialog })),
  { ssr: false }
);
const DeleteContactDialog = dynamic(
  () => import('./dialogs/DeleteContactDialog').then(mod => ({ default: mod.DeleteContactDialog })),
  { ssr: false }
);
const ArchiveContactDialog = dynamic(
  () => import('./dialogs/ArchiveContactDialog').then(mod => ({ default: mod.ArchiveContactDialog })),
  { ssr: false }
);
import { AdvancedFiltersPanel, type ContactFilterState, contactFiltersConfig } from '@/components/core/AdvancedFilters';
import { ListContainer, PageContainer } from '@/core/containers';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔐 ENTERPRISE: Defense-in-depth auth guard
import { useAuth } from '@/auth/hooks/useAuth';

const logger = createModuleLogger('ContactsPageContent');

export function ContactsPageContent() {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('contacts');
  // 🔐 ENTERPRISE: Defense-in-depth — gate data fetching on auth state
  const { user, loading: authLoading } = useAuth();
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

      logger.info('Loaded fresh contacts from database', {
        count: contactsResult.contacts.length,
        contactsWithPhotos: contactsResult.contacts.filter(c => hasMultiplePhotoURLs(c) && c.multiplePhotoURLs.length > 0).length
      });
      setContacts(contactsResult.contacts);

      // 🚫 SEED DATA ΠΛΗΡΩΣ ΑΦΑΙΡΕΜΕΝΑ - Καθαρή έναρξη χωρίς sample data
      // Η βάση δεδομένων θα παραμείνει άδεια μέχρι να προσθέσει ο χρήστης επαφές
    } catch (err) {
      // Error logging removed
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`${t('page.error.title')} ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [filters.showArchived]);

  // 🚀 ENTERPRISE PERFORMANCE: Direct contact fetch για instant loading
  const loadSpecificContact = useCallback(async (contactId: string) => {
    try {
      logger.info('Direct fetching specific contact', { contactId });

      const contact = await ContactsService.getContact(contactId);

      if (contact) {
        logger.info('Contact loaded directly', { name: getContactDisplayName(contact) });

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
        logger.warn('Contact not found', { contactId });
        return null;
      }
    } catch (err) {
      logger.error('Error loading specific contact', { error: err });
      return null;
    }
  }, []);

  // 🚫 SEED LOGIC ΑΦΑΙΡΕΘΗΚΕ - Δεν υπάρχει πλέον seeding functionality

  const refreshContacts = async () => {
    await loadContacts();
  };

  // 🚀 ENTERPRISE LOADING STRATEGY: Smart loading based on URL parameters
  // 🔐 Gated on auth state — prevents Firestore reads before authentication resolves
  const hasLoadedContacts = React.useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (hasLoadedContacts.current) return;
    hasLoadedContacts.current = true;

    const contactIdParam = searchParams.get('contactId');

    if (contactIdParam) {
      // 🚀 INSTANT STRATEGY: Direct contact fetch για immediate display
      loadSpecificContact(contactIdParam).then(contact => {
        if (contact) {
          setFilters(prev => ({ ...prev, searchTerm: '' }));
          setActiveCardFilter(null);
        }
      });

      // Second: Load full contacts list in BACKGROUND (for navigation)
      setTimeout(() => {
        loadContacts();
      }, 100);
    } else {
      // Normal strategy: Load all contacts
      loadContacts();
    }
  }, [authLoading, user]); // Re-run when auth state resolves

  // 🎯 URL FILTERING: Handle filter parameter (not contactId)
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const contactIdParam = searchParams.get('contactId');

    // Only handle filter param if no contactId (contactId has priority)
    if (filterParam && !contactIdParam) {
      logger.info('Applying URL filter', { filterParam });
      setFilters(prev => ({ ...prev, searchTerm: decodeURIComponent(filterParam) }));
      setActiveCardFilter(null);
    }
  }, [searchParams, setFilters]);

  // 🧹 CLEAR FILTER: Function για καθάρισμα του URL filter και contactId
  const handleClearURLFilter = () => {
    logger.info('Clearing URL filter and contactId');
    setFilters(prev => ({ ...prev, searchTerm: '' }));
    setSelectedContact(null);
    // Navigate back to contacts without any parameters
    router.push('/contacts');
  };

  // 🔥 ENTERPRISE CACHE INVALIDATION: Global event listener
  useEffect(() => {
    const handleContactsUpdate = (event: CustomEvent) => {
      logger.info('Received cache invalidation event', { detail: event.detail });
      // Force immediate refresh of all contact data
      refreshContacts();

      // 🔥 CRITICAL: Update selectedContact if it was the one modified
      const { contactId } = event.detail;
      if (selectedContact?.id === contactId) {
        logger.info('Selected contact was modified, will update after refresh');
        // The selectedContact will be updated by the useEffect below after contacts reload
      }
    };

    // Listen για global cache invalidation events
    window.addEventListener('contactsUpdated', handleContactsUpdate as EventListener);

    return () => {
      window.removeEventListener('contactsUpdated', handleContactsUpdate as EventListener);
    };
  }, [selectedContact]);

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Subscribe to contact updates for cross-page sync (optimized - no full refresh)
  useEffect(() => {
    const handleContactUpdate = (payload: ContactUpdatedPayload) => {
      logger.info('Applying real-time update for contact', { contactId: payload.contactId });

      // 🏢 ENTERPRISE: Type-safe partial update helper
      const applyContactUpdates = <T extends Contact>(contact: T): T => {
        const updates: Partial<T> = {} as Partial<T>;
        if (payload.updates.firstName !== undefined) (updates as Record<string, unknown>).firstName = payload.updates.firstName;
        if (payload.updates.lastName !== undefined) (updates as Record<string, unknown>).lastName = payload.updates.lastName;
        if (payload.updates.companyName !== undefined) (updates as Record<string, unknown>).companyName = payload.updates.companyName;
        if (payload.updates.serviceName !== undefined) (updates as Record<string, unknown>).serviceName = payload.updates.serviceName;
        if (payload.updates.isFavorite !== undefined) (updates as Record<string, unknown>).isFavorite = payload.updates.isFavorite;
        // Status requires type assertion due to union type
        if (payload.updates.status !== undefined) {
          (updates as Record<string, unknown>).status = payload.updates.status;
        }
        return { ...contact, ...updates };
      };

      // Update in contacts list (optimized - no full refresh)
      setContacts(prev => prev.map(contact =>
        contact.id === payload.contactId
          ? applyContactUpdates(contact)
          : contact
      ));

      // Also update selectedContact if it's the one being updated
      if (selectedContact?.id === payload.contactId) {
        setSelectedContact(prev =>
          prev ? applyContactUpdates(prev) : prev
        );
      }
    };

    // Subscribe to contact updates (same-page + cross-page)
    const unsubscribe = RealtimeService.subscribe('CONTACT_UPDATED', handleContactUpdate, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, [selectedContact?.id]);

  // Update selected contact when contacts list changes
  useEffect(() => {
    if (selectedContact?.id) {
      const updatedContact = contacts.find(c => c.id === selectedContact.id);
      if (updatedContact && JSON.stringify(updatedContact) !== JSON.stringify(selectedContact)) {
        const oldPhotoCount = hasMultiplePhotoURLs(selectedContact) ? selectedContact.multiplePhotoURLs.length : 0;
        const newPhotoCount = hasMultiplePhotoURLs(updatedContact) ? updatedContact.multiplePhotoURLs.length : 0;
        logger.info('Updating selectedContact with fresh data', {
          contactId: selectedContact.id,
          oldPhotos: oldPhotoCount,
          newPhotos: newPhotoCount
        });
        setSelectedContact(updatedContact);

        // 🔥 FORCE RE-RENDER: Avatar components need key-based invalidation
        const photoCount = newPhotoCount;
        window.dispatchEvent(new CustomEvent('forceAvatarRerender', {
          detail: {
            contactId: selectedContact.id,
            photoCount,
            timestamp: Date.now()
          }
        }));
        logger.info('Dispatched force avatar re-render event');
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
    // 🏢 ENTERPRISE: Use translated strings for card filter comparison
    const totalContactsTitle = t('page.dashboard.totalContacts');
    const totalPersonnelTitle = t('page.dashboard.totalPersonnel');
    const legalEntitiesTitle = t('page.dashboard.legalEntities');
    const activeContactsTitle = t('page.dashboard.activeContacts');
    const servicesTitle = t('page.dashboard.services');
    const recentAdditionsTitle = t('page.dashboard.recentAdditions');
    const favoritesTitle = t('page.dashboard.favorites');
    const contactsWithRelationsTitle = t('page.dashboard.contactsWithRelations');

    if (activeCardFilter) {
      switch (activeCardFilter) {
        case totalContactsTitle:
          // Show all contacts - no additional filtering needed
          break;
        case totalPersonnelTitle:
          if (contact.type !== 'individual') return false;
          break;
        case legalEntitiesTitle:
          if (contact.type !== 'company') return false;
          break;
        case activeContactsTitle:
          if ((contact as Contact & { status?: string }).status === 'inactive') return false;
          break;
        case servicesTitle:
          if (contact.type !== 'service') return false;
          break;
        case recentAdditionsTitle:
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          const createdDate = toDate(contact.createdAt);
          if (!createdDate || createdDate <= oneMonthAgo) return false;
          break;
        case favoritesTitle:
          if (!contact.isFavorite) return false;
          break;
        case contactsWithRelationsTitle:
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
      title: t('page.dashboard.totalContacts'),
      value: contacts.length,
      icon: Users,
      color: "blue"
    },
    {
      title: t('page.dashboard.totalPersonnel'),
      value: contacts.filter((c: Contact) =>
        // Count all relationships where someone is an employee
        // This is a placeholder - will be enhanced with relationship data
        c.type === 'individual'
      ).length,
      icon: Briefcase,
      color: "green"
    },
    {
      title: t('page.dashboard.legalEntities'),
      value: contacts.filter(c => c.type === 'company').length,
      icon: Building2,
      color: "purple"
    },
    {
      title: t('page.dashboard.activeContacts'),
      value: contacts.filter((c: Contact & { status?: string }) => c.status === 'active' || !c.status).length,
      icon: Activity,
      color: "cyan"
    },

    // 🔽 Κάτω σειρά (4 κάρτες) - Λεπτομέρειες
    {
      title: t('page.dashboard.services'),
      value: contacts.filter(c => c.type === 'service').length,
      icon: Landmark,
      color: "orange"
    },
    {
      title: t('page.dashboard.recentAdditions'),
      value: contacts.filter(c => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const createdDate = toDate(c.createdAt);
        return createdDate && createdDate > oneMonthAgo;
      }).length,
      icon: Calendar,
      color: "pink"
    },
    {
      title: t('page.dashboard.favorites'),
      value: contacts.filter(c => c.isFavorite).length,
      icon: Star,
      color: "yellow"
    },
    {
      title: t('page.dashboard.contactsWithRelations'),
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
      logger.info('Removing card filter');
    } else {
      setActiveCardFilter(cardTitle);
      logger.info('Applying card filter', { cardTitle });

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
                {t('page.filterIndicator.viewingCustomer')} <strong>{contactName}</strong>
              </span>
              <span className={`text-xs ${colors.text.success} ${colors.bg.successSubtle} px-2 py-1 rounded`}>
                {t('page.filterIndicator.selectedContact')}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClearURLFilter}
                  className={`flex items-center space-x-1 px-2 py-1 text-sm ${colors.text.success} rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST}`}
                >
                  <X className={iconSizes.sm} />
                  <span>{t('page.filterIndicator.back')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('page.filterIndicator.backToList')}</TooltipContent>
            </Tooltip>
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
                {t('page.filterIndicator.filteringFor')} <strong>"{filterValue}"</strong>
              </span>
              <span className={`text-xs ${colors.text.info} ${colors.bg.infoSubtle} px-2 py-1 rounded`}>
                {filteredContacts.length === 1
                  ? t('page.filterIndicator.contactsCount', { count: filteredContacts.length })
                  : t('page.filterIndicator.contactsCountPlural', { count: filteredContacts.length })}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClearURLFilter}
                  className={`flex items-center space-x-1 px-2 py-1 text-sm ${colors.text.info} rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_GHOST}`}
                >
                  <X className={iconSizes.sm} />
                  <span>{t('page.filterIndicator.clear')}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('page.filterIndicator.showAll')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
      <PageContainer ariaLabel={t('page.pageLabel')}>
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
          <section className="w-full overflow-hidden" role="region" aria-label={t('page.dashboard.label')}>
            <UnifiedDashboard
              stats={dashboardStats}
              columns={4}
              onCardClick={handleCardClick}
              className="px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden"
            />
          </section>
        )}

        {/* Advanced Filters Panel */}
        <aside className="hidden md:block" role="complementary" aria-label={t('page.filters.desktop')}>
          {/* Desktop: Always visible */}
          <AdvancedFiltersPanel
            config={contactFiltersConfig}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </aside>

        {/* Mobile: Show only when showFilters is true */}
        {showFilters && (
          <aside className="md:hidden" role="complementary" aria-label={t('page.filters.mobile')}>
            <AdvancedFiltersPanel
              config={contactFiltersConfig}
              filters={filters}
              onFiltersChange={setFilters}
              defaultOpen
            />
          </aside>
        )}

        <ListContainer>
          {error ? (
            <section className={`w-full text-center p-8 bg-card rounded-lg ${getStatusBorder('error')}`} role="alert" aria-label={t('page.error.ariaLabel')}>
              <p className="text-destructive font-medium">⚠️ {error}</p>
              <button
                onClick={refreshContacts}
                className={`mt-2 px-4 py-2 bg-primary text-primary-foreground rounded ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY}`}
              >
                {t('page.error.retry')}
              </button>
            </section>
          ) : viewMode === 'list' ? (
            <>
              {/* 🖥️ DESKTOP: Standard split layout - Same as Units/Projects/Buildings */}
              <section className="hidden md:flex flex-1 gap-2 min-h-0" role="region" aria-label={t('page.views.desktopView')}>
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
              <section className={`md:hidden w-full ${selectedContact ? 'hidden' : 'block'}`} role="region" aria-label={t('page.views.mobileList')}>
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
                title={selectedContact ? getContactDisplayName(selectedContact) : t('page.details.title')}
                actionButtons={
                  <>
                    <button
                      onClick={() => handleEditContact()}
                      className={`p-2 rounded-md border ${colors.bg.primary} border-border ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      aria-label={t('page.details.editContact')}
                    >
                      <Edit className={iconSizes.sm} />
                    </button>
                    <button
                      onClick={() => handleDeleteContacts()}
                      className={`p-2 rounded-md border ${colors.bg.primary} border-border text-destructive ${INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_GHOST} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      aria-label={t('page.details.deleteContact')}
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
            /* 🏢 ENTERPRISE: Grid View with ContactListCard (PR: Contacts Grid View) */
            <>
              <section
                className="w-full p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 overflow-y-auto"
                role="region"
                aria-label={t('page.views.gridView')}
              >
                {filteredContacts.map((contact: Contact) => (
                  <ContactGridCard
                    key={contact.id}
                    contact={contact}
                    isSelected={selectedContact?.id === contact.id}
                    isFavorite={contact.isFavorite}
                    onSelect={() => setSelectedContact(contact)}
                    onToggleFavorite={async () => {
                      // 🏢 ENTERPRISE: Toggle favorite via service
                      await ContactsService.updateContact(contact.id!, { isFavorite: !contact.isFavorite });
                      await refreshContacts();
                    }}
                  />
                ))}
              </section>

              {/* 📱 MOBILE: Slide-in ContactDetails when contact is selected in grid mode */}
              <MobileDetailsSlideIn
                isOpen={!!selectedContact}
                onClose={() => setSelectedContact(null)}
                title={selectedContact ? getContactDisplayName(selectedContact) : t('page.details.title')}
                actionButtons={
                  <>
                    <button
                      onClick={() => handleEditContact()}
                      className={`p-2 rounded-md border ${colors.bg.primary} border-border ${INTERACTIVE_PATTERNS.BUTTON_SUBTLE} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      aria-label={t('page.details.editContact')}
                    >
                      <Edit className={iconSizes.sm} />
                    </button>
                    <button
                      onClick={() => handleDeleteContacts()}
                      className={`p-2 rounded-md border ${colors.bg.primary} border-border text-destructive ${INTERACTIVE_PATTERNS.BUTTON_DESTRUCTIVE_GHOST} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                      aria-label={t('page.details.deleteContact')}
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
  );
}

// Default export για compatibility
export default ContactsPageContent;
