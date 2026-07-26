import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { RealtimeService, type ContactUpdatedPayload } from '@/services/realtime';
import { ContactsService } from '@/services/contacts.service';
import type { ContactType } from '@/constants/contacts';
import type { ContactFilterState } from '@/components/core/AdvancedFilters';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { buildContactDashboardStats } from './contactDashboardStats';
import { filterContactsForPage } from './contactsPageFilters';
import { useContactsTrashState } from './useContactsTrashState';
import { createStaleCache } from '@/lib/stale-cache';
import { useSelectedEntityUrlState } from '@/hooks/useSelectedEntityUrlState';
import { replaceUrlSearchParams } from '@/lib/url-query-state';
import { useSelectedContactAvatarRefresh } from './useSelectedContactAvatarRefresh';

const logger = createModuleLogger('ContactsPageContent');
// SSoT stale-while-revalidate cache (ADR-300) — single-key (one list per session)
const contactsCache = createStaleCache<Contact[]>('contacts');

/** Το query param που κρατά την ανοιχτή επαφή — η ΜΟΝΗ πηγή αλήθειας (ADR-332 D21). */
const CONTACT_ID_PARAM = 'contactId';

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
  // ── Επιλογή: ΜΙΑ πηγή αλήθειας, το URL (ADR-332 D21) ──────────────────────
  // Το id ζει στο `?contactId=`· η **επαφή** παράγεται από τη λίστα. Κανένα δεύτερο
  // δοχείο, καμία δικλείδα, κανένας συγχρονισμός: το URL επιβιώνει reload/remount/
  // Fast Refresh από μόνο του, και η επιλογή γίνεται μοιράσιμος σύνδεσμος.
  const { selectedId: selectedContactId, setSelectedId } = useSelectedEntityUrlState(CONTACT_ID_PARAM);

  const selectedContact = useMemo<Contact | null>(
    () => (selectedContactId ? contacts.find(c => c.id === selectedContactId) ?? null : null),
    [contacts, selectedContactId],
  );

  /**
   * Ο χρήστης άλλαξε ο ίδιος επιλογή σε αυτό το mount;
   *
   * Ξεχωρίζει το «ήρθα εδώ από σύνδεσμο άλλης ενότητας» από το «διάλεξα κάτι στη
   * λίστα» — μόνο το πρώτο δικαιολογεί το banner επιστροφής. Ref και όχι state:
   * δεν επηρεάζει render, μόνο τη διάγνωση της προέλευσης.
   */
  const userChangedSelectionRef = useRef(false);

  /** Δέχεται `Contact | null` όπως πριν — οι καλούντες δεν ξέρουν ότι από κάτω είναι URL. */
  const setSelectedContact = useCallback((contact: Contact | null) => {
    userChangedSelectionRef.current = true;
    setSelectedId(contact?.id ?? null);
  }, [setSelectedId]);

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
        // Καμία εγγραφή επιλογής εδώ: το id είναι ΗΔΗ στο URL — γι' αυτό ήρθαμε. Αρκεί
        // να μπει η επαφή στη λίστα και η παραγόμενη επιλογή προκύπτει μόνη της.
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

      // Μόνο η λίστα ενημερώνεται — η επιλογή παράγεται από αυτήν.
      setContacts(prev => prev.map(c => (c.id === contactId ? updatedContact : c)));
    } catch (err) {
      logger.error('In-place contact update failed, falling back to full refresh', { contactId, error: err });
      refreshContacts();
    }
  }, [selectedContact?.id, refreshContacts]);
  // ---------------------------------------------------------------------------
  // Effects: URL parameters
  // ---------------------------------------------------------------------------
  /** Ids για τα οποία έγινε ήδη η μία-και-μόνη απευθείας ανάκτηση (ιδεμποτεντικό). */
  const fetchAttemptedIdsRef = useRef<Set<string>>(new Set());

  /**
   * Το URL δείχνει επαφή που **δεν** είναι στη φορτωμένη λίστα ⇒ deep link από άλλη
   * ενότητα. Φέρ' την και βάλ' τη στη λίστα· η επιλογή προκύπτει από εκεί.
   *
   * 🔴 Ο φρουρός `isLoading` είναι το μάθημα του D20.1 μεταφερμένο αυτούσιο: όσο η
   * λίστα δεν έχει καθίσει, το «δεν τη βρίσκω» **δεν** σημαίνει «δεν υπάρχει». Η
   * διαφορά με τη δικλείδα του D20 είναι ότι εδώ η λάθος απόφαση δεν καταστρέφει
   * τίποτα: το id ζει στο URL και κανένα μονοπάτι δεν μπορεί να το σβήσει κατά λάθος.
   */
  useEffect(() => {
    if (authLoading || !user || !selectedContactId) return;
    if (isLoading) return;
    if (contacts.some(c => c.id === selectedContactId)) return;
    if (fetchAttemptedIdsRef.current.has(selectedContactId)) return;

    fetchAttemptedIdsRef.current.add(selectedContactId);
    loadSpecificContact(selectedContactId).then(contact => {
      if (contact) {
        setFilters(prev => ({ ...prev, searchTerm: '' }));
        setActiveCardFilter(null);
        return;
      }
      // Θετική απόδειξη ανυπαρξίας — η λίστα έχει καθίσει ΚΑΙ η απευθείας ανάκτηση
      // γύρισε άδεια. Μόνο τώρα επιτρέπεται να καθαριστεί το param.
      logger.warn('Clearing stale contactId from URL', { contactId: selectedContactId });
      setSelectedId(null);
    });
  }, [authLoading, user, selectedContactId, isLoading, contacts, loadSpecificContact, setSelectedId]);

  useEffect(() => {
    if (authLoading || !user || searchParams.get('create') !== 'true') return;
    setCreationMode('selecting');
    // Το `create` είναι εντολή μιας χρήσης: κατανάλωσέ το και σβήσ' το, χωρίς πλοήγηση.
    // Περνά από τον ίδιο γραφέα URL με την επιλογή — ένα μονοπάτι εγγραφής (D21).
    replaceUrlSearchParams(params => params.delete('create'));
  }, [authLoading, user]); // Intentional: run only on auth change, same pattern as contactId effect

  useEffect(() => {
    const filterParam = searchParams.get('filter');

    // Με ανοιχτή επαφή το φίλτρο κειμένου δεν επιβάλλεται — θα έκρυβε τη λίστα γύρω
    // από αυτό που μόλις άνοιξες.
    if (filterParam && !selectedContactId) {
      logger.info('Applying URL filter', { filterParam });
      setFilters(prev => ({ ...prev, searchTerm: decodeURIComponent(filterParam) }));
      setActiveCardFilter(null);
    }
  }, [searchParams]);

  /**
   * «Πίσω στη λίστα»: σκόπιμη πλοήγηση σε καθαρή σελίδα ⇒ `push`, ώστε το κουμπί
   * «πίσω» του browser να επιστρέφει εκεί από όπου ήρθε ο χρήστης. Καθαρίζει **και**
   * το `contactId` **και** το `filter` — δεν χρειάζεται ξεχωριστός μηδενισμός
   * επιλογής, γιατί η επιλογή **είναι** το URL.
   */
  const handleClearURLFilter = useCallback(() => {
    logger.info('Clearing URL filter and contactId');
    setFilters(prev => ({ ...prev, searchTerm: '' }));
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

      // Μόνο η λίστα — η ανοιχτή επαφή είναι παράγωγό της, οπότε ενημερώνεται μαζί.
      // Πριν το D21 χρειαζόταν δεύτερη, χειροκίνητη εγγραφή εδώ· ήταν ακριβώς το
      // είδος του διπλού συγχρονισμού που το SSoT καταργεί.
      setContacts(prev => prev.map(contact =>
        contact.id === payload.contactId ? applyContactUpdates(contact) : contact,
      ));
    };

    const unsubscribe = RealtimeService.subscribe('CONTACT_UPDATED', handleContactUpdate, {
      checkPendingOnMount: false,
    });

    return unsubscribe;
  }, []);

  useSelectedContactAvatarRefresh(selectedContact);
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

  /**
   * Ποιες επαφές αφορά η μαζική ενέργεια: οι ρητά δοσμένες, αλλιώς η επιλεγμένη,
   * αλλιώς καμία. Ήταν αντιγραμμένη σε διαγραφή και αρχειοθέτηση.
   */
  const resolveBulkTargetIds = useCallback((ids?: string[]): string[] => {
    if (ids && ids.length > 0) return ids;
    return selectedContact?.id ? [selectedContact.id] : [];
  }, [selectedContact?.id]);

  const handleDeleteContacts = useCallback((ids?: string[]) => {
    setSelectedContactIds(resolveBulkTargetIds(ids));
    setShowDeleteContactDialog(true);
  }, [resolveBulkTargetIds]);

  /**
   * Η κοινή ουρά κάθε μαζικής ενέργειας: κλείσε τον διάλογο, ξεκόλλα την επιλογή
   * αν η επιλεγμένη επαφή ήταν μέσα στις επηρεαζόμενες, καθάρισε τα ids, ανανέωσε.
   *
   * Ήταν αντιγραμμένη σε διαγραφή και αρχειοθέτηση· μια διόρθωση στη μία (π.χ. να
   * μη μένει η επιλογή σε αρχειοθετημένη επαφή) δεν έφτανε ποτέ στην άλλη.
   */
  const finishBulkContactAction = useCallback(
    (closeDialog: (open: boolean) => void) => {
      closeDialog(false);
      if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
        setSelectedContact(null);
      }
      setSelectedContactIds([]);
      refreshContacts();
    },
    [selectedContact, selectedContactIds, refreshContacts],
  );

  const handleContactsDeleted = useCallback(async () => {
    finishBulkContactAction(setShowDeleteContactDialog);
  }, [finishBulkContactAction]);

  const handleArchiveContacts = useCallback((ids?: string[]) => {
    setSelectedContactIds(resolveBulkTargetIds(ids));
    setShowArchiveContactDialog(true);
  }, [resolveBulkTargetIds]);

  const handleContactsArchived = useCallback(async () => {
    finishBulkContactAction(setShowArchiveContactDialog);
  }, [finishBulkContactAction]);

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
  const filteredContacts = useMemo(
    () => filterContactsForPage({
      contacts,
      filters,
      activeCardFilter,
      selectedContactId,
      showTrash: trash.showTrash,
      t,
    }),
    // Intentional: only the fields the filter actually reads, not the whole `filters` object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contacts, selectedContactId, activeCardFilter, filters.searchTerm, filters.contactType, filters.isFavorite, trash.showTrash, t],
  );

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
    // Selection — SSoT: το URL (ADR-332 D21)
    selectedContact,
    setSelectedContact,
    /**
     * Ήρθε ο χρήστης εδώ από σύνδεσμο άλλης ενότητας;
     *
     * Μόνο τότε αξίζει το banner «Προβολή επαφής X — Πίσω»: δίνει προσανατολισμό σε
     * κάποιον που δεν πάτησε ο ίδιος τη λίστα. Πριν το D21 το ερώτημα απαντιόταν με
     * «υπάρχει `?contactId=`;» — που πλέον ισχύει σε **κάθε** επιλογή και θα έκανε
     * το banner μόνιμο θόρυβο.
     */
    arrivedViaDeepLink: !!selectedContactId && !userChangedSelectionRef.current,
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
