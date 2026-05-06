import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact, IndividualContact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { RealtimeService, type ContactUpdatedPayload } from '@/services/realtime';
import { normalizeToDate } from '@/lib/date-local';
import { ContactsService } from '@/services/contacts.service';
import { CONTACT_TYPES } from '@/constants/contacts';
import type { ContactType } from '@/constants/contacts';
import type { ContactFilterState } from '@/components/core/AdvancedFilters';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { buildContactDashboardStats } from './contactDashboardStats';
import { useContactsTrashState } from './useContactsTrashState';
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('ContactsPageContent');
// SSoT stale-while-revalidate cache (ADR-300) — single-key (one list per session)
const contactsCache = createStaleCache<Contact[]>('contacts');

// Type guard for contacts with multiple photo URLs
const hasMultiplePhotoURLs = (
  contact: Contact,
): contact is IndividualContact & { multiplePhotoURLs: string[] } => {
  return 'multiplePhotoURLs' in contact && Array.isArray((contact as IndividualContact).multiplePhotoURLs);
};

const INITIAL_FILTERS: ContactFilterState = {
  searchTerm: '',
  company: [],
  status: [],
  contactType: 'all',
  propertiesCount: 'all',
  totalArea: 'all',
  hasProperties: false,
  isFavorite: false,
  showArchived: false,
  tags: [],
  dateRange: { from: undefined, to: undefined },
};

/**
 * All state, effects, and handlers for the Contacts page.
 *
 * Extracted from ContactsPageContent for SRP compliance (ADR-233).
 * The component keeps only JSX rendering.
 */
export function useContactsPageState() {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [contacts, setContacts] = useState<Contact[]>(contactsCache.get() ?? []);
  // Stale-while-revalidate: if we have cached data, start with loading=false.
  const [isLoading, setIsLoading] = useState(!contactsCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [creationMode, setCreationMode] = useState<null | 'selecting' | ContactType>(null);
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false);
  const [showArchiveContactDialog, setShowArchiveContactDialog] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [_showCompactToolbar, _setShowCompactToolbar] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<ContactFilterState>(INITIAL_FILTERS);
  const [subscriptionRetry, setSubscriptionRetry] = useState(0);
  // ---------------------------------------------------------------------------
  // Data: Firestore real-time subscription
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authLoading || !user) return;

    // Only show full-page loading on very first visit — subsequent navigations
    // use stale cache and refresh silently (stale-while-revalidate).
    if (!contactsCache.hasLoaded()) {
      setIsLoading(true);
    }
    setError(null);

    const unsubContacts = ContactsService.subscribeToContacts(
      (freshContacts) => {
        contactsCache.set(freshContacts);
        setContacts(freshContacts);
        setIsLoading(false);
      },
      {
        limitCount: 1000,
        onError: (err) => {
          logger.warn('Subscription error — retrying in 3s', { error: err.message });
          setError(err.message);
          setTimeout(() => setSubscriptionRetry(prev => prev + 1), 3000);
        },
      },
    );

    return () => { unsubContacts(); };
  }, [user, authLoading, subscriptionRetry]);
  // ---------------------------------------------------------------------------
  // Data: Direct contact fetch for URL-based instant loading
  // ---------------------------------------------------------------------------
  const loadSpecificContact = useCallback(async (contactId: string) => {
    try {
      logger.info('Direct fetching specific contact', { contactId });
      const contact = await ContactsService.getContact(contactId);

      if (contact) {
        logger.info('Contact loaded directly', { name: getContactDisplayName(contact) });
        setSelectedContact(contact);
        setContacts(prev => {
          const exists = prev.find(c => c.id === contactId);
          return exists ? prev : [contact, ...prev];
        });
        return contact;
      }

      logger.warn('Contact not found', { contactId });
      return null;
    } catch (err) {
      logger.error('Error loading specific contact', { error: err });
      return null;
    }
  }, []);

  const refreshContacts = useCallback(() => {
    setSubscriptionRetry(prev => prev + 1);
  }, []);

  // In-place single-contact update — prevents full re-fetch & tab reset
  const handleContactUpdatedInPlace = useCallback(async () => {
    const contactId = selectedContact?.id;
    if (!contactId) {
      refreshContacts();
      return;
    }

    try {
      const updatedContact = await ContactsService.getContact(contactId);
      if (!updatedContact) {
        refreshContacts();
        return;
      }

      setContacts(prev => prev.map(c => (c.id === contactId ? updatedContact : c)));
      setSelectedContact(updatedContact);
    } catch (err) {
      logger.error('In-place contact update failed, falling back to full refresh', { contactId, error: err });
      refreshContacts();
    }
  }, [selectedContact?.id, refreshContacts]);
  // ---------------------------------------------------------------------------
  // Effects: URL parameters
  // ---------------------------------------------------------------------------
  const hasLoadedSpecific = useRef(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (hasLoadedSpecific.current) return;

    const contactIdParam = searchParams.get('contactId');
    if (contactIdParam) {
      hasLoadedSpecific.current = true;
      loadSpecificContact(contactIdParam).then(contact => {
        if (contact) {
          setFilters(prev => ({ ...prev, searchTerm: '' }));
          setActiveCardFilter(null);
        }
      });
    }
  }, [authLoading, user]); // Intentional: run only on auth change, not on every searchParams update

  useEffect(() => {
    if (authLoading || !user || searchParams.get('create') !== 'true') return;
    setCreationMode('selecting');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    router.replace(params.size > 0 ? `?${params.toString()}` : window.location.pathname, { scroll: false });
  }, [authLoading, user]); // Intentional: run only on auth change, same pattern as contactId effect

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const contactIdParam = searchParams.get('contactId');

    if (filterParam && !contactIdParam) {
      logger.info('Applying URL filter', { filterParam });
      setFilters(prev => ({ ...prev, searchTerm: decodeURIComponent(filterParam) }));
      setActiveCardFilter(null);
    }
  }, [searchParams]);

  const handleClearURLFilter = useCallback(() => {
    logger.info('Clearing URL filter and contactId');
    setFilters(prev => ({ ...prev, searchTerm: '' }));
    setSelectedContact(null);
    router.push('/contacts');
  }, [router]);
  // ---------------------------------------------------------------------------
  // Effects: Cache invalidation + Real-time service
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleContactsUpdate = (event: CustomEvent) => {
      logger.info('Received cache invalidation event', { detail: event.detail });
      refreshContacts();
    };

    window.addEventListener('contactsUpdated', handleContactsUpdate as EventListener);
    return () => {
      window.removeEventListener('contactsUpdated', handleContactsUpdate as EventListener);
    };
  }, [refreshContacts]);

  useEffect(() => {
    const handleContactUpdate = (payload: ContactUpdatedPayload) => {
      logger.info('Applying real-time update for contact', { contactId: payload.contactId });

      const applyContactUpdates = <T extends Contact>(contact: T): T => {
        const updates: Partial<T> = {} as Partial<T>;
        if (payload.updates.firstName !== undefined) (updates as Record<string, unknown>).firstName = payload.updates.firstName;
        if (payload.updates.lastName !== undefined) (updates as Record<string, unknown>).lastName = payload.updates.lastName;
        if (payload.updates.companyName !== undefined) (updates as Record<string, unknown>).companyName = payload.updates.companyName;
        if (payload.updates.serviceName !== undefined) (updates as Record<string, unknown>).serviceName = payload.updates.serviceName;
        if (payload.updates.isFavorite !== undefined) (updates as Record<string, unknown>).isFavorite = payload.updates.isFavorite;
        if (payload.updates.status !== undefined) {
          (updates as Record<string, unknown>).status = payload.updates.status;
        }
        return { ...contact, ...updates };
      };

      setContacts(prev => prev.map(contact =>
        contact.id === payload.contactId ? applyContactUpdates(contact) : contact,
      ));

      if (selectedContact?.id === payload.contactId) {
        setSelectedContact(prev => (prev ? applyContactUpdates(prev) : prev));
      }
    };

    const unsubscribe = RealtimeService.subscribe('CONTACT_UPDATED', handleContactUpdate, {
      checkPendingOnMount: false,
    });

    return unsubscribe;
  }, [selectedContact?.id]);

  // Sync selectedContact when contacts list refreshes
  useEffect(() => {
    if (!selectedContact?.id) return;

    const updatedContact = contacts.find(c => c.id === selectedContact.id);
    if (updatedContact && JSON.stringify(updatedContact) !== JSON.stringify(selectedContact)) {
      const oldPhotoCount = hasMultiplePhotoURLs(selectedContact) ? selectedContact.multiplePhotoURLs.length : 0;
      const newPhotoCount = hasMultiplePhotoURLs(updatedContact) ? updatedContact.multiplePhotoURLs.length : 0;
      logger.info('Updating selectedContact with fresh data', {
        contactId: selectedContact.id,
        oldPhotos: oldPhotoCount,
        newPhotos: newPhotoCount,
      });
      setSelectedContact(updatedContact);

      window.dispatchEvent(new CustomEvent('forceAvatarRerender', {
        detail: { contactId: selectedContact.id, photoCount: newPhotoCount, timestamp: Date.now() },
      }));
      logger.info('Dispatched force avatar re-render event');
    }
  }, [contacts, selectedContact?.id]); // Intentional: avoid triggering on selectedContact object identity changes
  // ---------------------------------------------------------------------------
  // Handlers: Creation / Deletion / Archive
  // ---------------------------------------------------------------------------
  const handleNewContact = useCallback(() => {
    setCreationMode('selecting');
    setSelectedContact(null);
  }, []);

  const handleContactAdded = useCallback(async () => {
    setCreationMode(null);
    // No refreshContacts() needed — the active Firestore real-time subscription
    // already delivers the new contact without tearing down the UI.
  }, []);

  const handleCancelCreation = useCallback(() => setCreationMode(null), []);
  const handleSelectContactType = useCallback((type: ContactType) => setCreationMode(type), []);
  const handleBackToTypeSelection = useCallback(() => setCreationMode('selecting'), []);

  const handleDeleteContacts = useCallback((ids?: string[]) => {
    if (ids && ids.length > 0) {
      setSelectedContactIds(ids);
    } else if (selectedContact?.id) {
      setSelectedContactIds([selectedContact.id]);
    } else {
      setSelectedContactIds([]);
    }
    setShowDeleteContactDialog(true);
  }, [selectedContact?.id]);

  const handleContactsDeleted = useCallback(async () => {
    setShowDeleteContactDialog(false);
    if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
      setSelectedContact(null);
    }
    setSelectedContactIds([]);
    refreshContacts();
  }, [selectedContact, selectedContactIds, refreshContacts]);

  const handleArchiveContacts = useCallback((ids?: string[]) => {
    if (ids && ids.length > 0) {
      setSelectedContactIds(ids);
    } else if (selectedContact?.id) {
      setSelectedContactIds([selectedContact.id]);
    } else {
      setSelectedContactIds([]);
    }
    setShowArchiveContactDialog(true);
  }, [selectedContact?.id]);

  const handleContactsArchived = useCallback(async () => {
    setShowArchiveContactDialog(false);
    if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
      setSelectedContact(null);
    }
    setSelectedContactIds([]);
    refreshContacts();
  }, [selectedContact, selectedContactIds, refreshContacts]);

  // ==== TRASH: Delegated to useContactsTrashState ====
  const trash = useContactsTrashState({
    contacts,
    selectedContact,
    setSelectedContact,
    setSelectedContactIds,
    selectedContactIds,
    refreshContacts,
    setActiveCardFilter,
  });

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filteredContacts = useMemo(() => {
    const contactIdParam = searchParams.get('contactId');

    // 🗑️ Trash mode: show ONLY deleted contacts
    if (trash.showTrash) {
      return contacts.filter(c => c.status === 'deleted');
    }

    return contacts.filter(contact => {
      // Exclude soft-deleted contacts from normal view
      if (contact.status === 'deleted') return false;

      if (contactIdParam) return true;

      // Dashboard card filter
      if (activeCardFilter) {
        const totalContactsTitle = t('page.dashboard.totalContacts');
        const totalPersonnelTitle = t('page.dashboard.totalPersonnel');
        const legalEntitiesTitle = t('page.dashboard.legalEntities');
        const activeContactsTitle = t('page.dashboard.activeContacts');
        const servicesTitle = t('page.dashboard.services');
        const recentAdditionsTitle = t('page.dashboard.recentAdditions');
        const favoritesTitle = t('page.dashboard.favorites');
        const contactsWithRelationsTitle = t('page.dashboard.contactsWithRelations');

        switch (activeCardFilter) {
          case totalContactsTitle:
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
          case recentAdditionsTitle: {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const createdDate = normalizeToDate(contact.createdAt);
            if (!createdDate || createdDate <= oneMonthAgo) return false;
            break;
          }
          case favoritesTitle:
            if (!contact.isFavorite) return false;
            break;
          case contactsWithRelationsTitle:
            if (contact.type === CONTACT_TYPES.SERVICE) return false;
            break;
        }
      }

      // Text search
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const displayName = getContactDisplayName(contact).toLowerCase();
        if (!displayName.includes(searchLower)) return false;
      }

      // Contact type (unless overridden by card filter)
      if (!activeCardFilter && filters.contactType !== 'all' && contact.type !== filters.contactType) {
        return false;
      }

      if (filters.isFavorite && !contact.isFavorite) return false;

      return true;
    });
  }, [contacts, searchParams, activeCardFilter, filters.searchTerm, filters.contactType, filters.isFavorite, trash.showTrash, t]);

  // Dashboard stats (extracted to contactDashboardStats.ts — SRP)
  const dashboardStats = useMemo(
    () => buildContactDashboardStats(contacts, t),
    [contacts, t],
  );

  // Card click handler
  const handleCardClick = useCallback((stat: DashboardStat, _index: number) => {
    const cardTitle = stat.title;

    if (activeCardFilter === cardTitle) {
      setActiveCardFilter(null);
      logger.info('Removing card filter');
    } else {
      setActiveCardFilter(cardTitle);
      logger.info('Applying card filter', { cardTitle });
      setSelectedContact(null);
    }
  }, [activeCardFilter]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    // Auth
    authLoading,
    // Data
    contacts,
    filteredContacts,
    isLoading,
    error,
    // Selection
    selectedContact,
    setSelectedContact,
    // UI toggles
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,
    // Creation
    creationMode,
    handleNewContact,
    handleContactAdded,
    handleCancelCreation,
    handleSelectContactType,
    handleBackToTypeSelection,
    // Delete / Archive
    showDeleteContactDialog,
    setShowDeleteContactDialog,
    showArchiveContactDialog,
    setShowArchiveContactDialog,
    showPermanentDeleteDialog: trash.showPermanentDeleteDialog,
    setShowPermanentDeleteDialog: trash.setShowPermanentDeleteDialog,
    selectedContactIds,
    handleDeleteContacts,
    handleContactsDeleted,
    handleArchiveContacts,
    handleContactsArchived,
    // Trash
    showTrash: trash.showTrash,
    trashCount: trash.trashCount,
    handleToggleTrash: trash.handleToggleTrash,
    handleRestoreContacts: trash.handleRestoreContacts,
    handlePermanentDeleteContacts: trash.handlePermanentDeleteContacts,
    handleContactsPermanentDeleted: trash.handleContactsPermanentDeleted,
    handleTrashActionComplete: trash.handleTrashActionComplete,
    // Filters
    filters,
    setFilters,
    searchParams,
    handleClearURLFilter,
    // Dashboard
    dashboardStats,
    handleCardClick,
    // Data operations
    refreshContacts,
    handleContactUpdatedInPlace,
    // i18n
    t,
  } as const;
}
