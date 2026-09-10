import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { useContactUpdatedAdoption } from './useContactUpdatedAdoption';
import { ContactsService } from '@/services/contacts.service';
import type { ContactType } from '@/constants/contacts';
import type { ContactFilterState } from '@/components/core/AdvancedFilters';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { ListGridViewMode } from '@/core/headers';
import { buildContactDashboardStats } from './contactDashboardStats';
import { filterContactsForPage } from './contactsPageFilters';
import { useContactsTrashState } from './useContactsTrashState';
import { useContactBulkActions } from './useContactBulkActions';
import { createStaleCache } from '@/lib/stale-cache';
import { useSelectedEntityUrlState } from '@/hooks/useSelectedEntityUrlState';
import { replaceUrlSearchParams } from '@/lib/url-query-state';
import { useSelectedContactAvatarRefresh } from './useSelectedContactAvatarRefresh';
import { useTabVisibilityRefresh } from '@/hooks/useTabVisibilityRefresh';
import { useAISyncBridge } from '@/hooks/useAISyncBridge';
import { useOwnerPropertyStats } from './useOwnerPropertyStats';

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

  /**
   * Επαφή που ήρθε από deep link και **δεν** χωράει στη λίστα της συνδρομής.
   *
   * ⚠️ Δεν είναι δεύτερη πηγή αλήθειας: το **ποια** επαφή είναι ανοιχτή το λέει
   * αποκλειστικά το URL. Αυτό είναι μόνο η τελευταία γνωστή **μορφή** της, για την
   * περίπτωση που το επόμενο στιγμιότυπο του Firestore αντικαταστήσει τη λίστα και
   * την πετάξει έξω (η συνδρομή είναι `limitCount: 1000`). Χωρίς αυτό, το πάνελ θα
   * άδειαζε μόνο του ενώ το URL θα εξακολουθούσε να δείχνει σωστά.
   */
  const [detachedContact, setDetachedContact] = useState<Contact | null>(null);

  const selectedContact = useMemo<Contact | null>(() => {
    if (!selectedContactId) return null;
    // Η λίστα προηγείται πάντα — είναι τα φρέσκα δεδομένα.
    return (
      contacts.find(c => c.id === selectedContactId)
      ?? (detachedContact?.id === selectedContactId ? detachedContact : null)
    );
  }, [contacts, selectedContactId, detachedContact]);

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

  // Ο τύπος έρχεται από τον SSoT των headers — το inline `'list' | 'grid'` ήταν
  // αντίγραφο του ίδιου union (`core/headers/list-page-header-props.ts` γρ. 12-14).
  const [viewMode, setViewMode] = useState<ListGridViewMode>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [creationMode, setCreationMode] = useState<null | 'selecting' | ContactType>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [_showCompactToolbar, _setShowCompactToolbar] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<ContactFilterState>(INITIAL_FILTERS);
  const [subscriptionRetry, setSubscriptionRetry] = useState(0);

  // Τι κατέχει κάθε επαφή — μία κλήση για όλους (ADR-842 §7.6.13 Δ). Δέχεται την
  // **ίδια** σκανδάλη με τη συνδρομή επαφών, ώστε μία ανανέωση να πιάνει και τα δύο.
  const ownerStats = useOwnerPropertyStats(subscriptionRetry);

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
        // να γίνει διαθέσιμη η μορφή της και η παραγόμενη επιλογή προκύπτει μόνη της.
        setDetachedContact(contact);
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
    if (selectedContact) return;
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
  }, [authLoading, user, selectedContactId, isLoading, selectedContact, loadSpecificContact, setSelectedId]);

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

  // Η λίστα υιοθετεί κάθε απήχηση `CONTACT_UPDATED` — και τις διευθύνσεις που γράφτηκαν
  // (ADR-332 D27 Β-ΙΙ). Εξήχθη σε δικό του hook, με δική του άγκυρα.
  useContactUpdatedAdoption(setContacts);

  useSelectedContactAvatarRefresh(selectedContact);

  // ---------------------------------------------------------------------------
  // 🔴 Ο ΠΟΜΠΟΣ ΕΚΠΕΜΠΕ ΣΕ ΑΔΕΙΑ ΣΥΧΝΟΤΗΤΑ (ADR-842 §7.6.13 Α)
  // ---------------------------------------------------------------------------
  // Ο διακομιστής γράφει `config/ui_sync_signal` σε **έξι** σημεία της ροής AI
  // (`contact-handler` · `contact-field-update-handler` · `esco-write-handler` ·
  // `admin-update-contact-module` · `contact-lookup-crud`). Ο **μόνος** ακροατής
  // ήταν το `useContactsState` — πρόγονος **αυτού** του hook, που έμεινε πίσω στην
  // εξαγωγή του ADR-233 και μετρήθηκε νεκρός με knip.
  //
  // ⚠️ Δηλαδή δεν ήταν «νεκρός κώδικας προς διαγραφή»: ήταν **ζωντανό ελάττωμα**.
  //    Ο Giorgio έστελνε εντολή στο Telegram, ο agent ενημέρωνε την επαφή, και η
  //    οθόνη έμενε στα παλιά — **χωρίς κανένα σύμπτωμα σφάλματος**. Το tab-visibility
  //    refresh, που υπάρχει ακριβώς ως δικλείδα του ίδιου σεναρίου, είχε χαθεί μαζί.
  //
  // 🔑 `refreshContacts` είναι το ίδιο πράγμα με το παλιό `forceDataRefresh`:
  //    ανεβάζει το `subscriptionRetry` ⇒ ξαναστήνεται η συνδρομή Firestore.
  useTabVisibilityRefresh(refreshContacts);
  useAISyncBridge('contacts', refreshContacts);
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


  // ==== ΜΑΖΙΚΕΣ ΕΝΕΡΓΕΙΕΣ: Delegated to useContactBulkActions (ADR-842 §7.6.13 Δ) ====
  const {
    selectedContactIds,
    setSelectedContactIds,
    showDeleteContactDialog,
    setShowDeleteContactDialog,
    showArchiveContactDialog,
    setShowArchiveContactDialog,
    handleDeleteContacts,
    handleContactsDeleted,
    handleArchiveContacts,
    handleContactsArchived,
  } = useContactBulkActions({ selectedContact, setSelectedContact, refreshContacts });

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
      ownerStats,
    }),
    // Intentional: only the fields the filter actually reads, not the whole `filters` object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contacts, selectedContactId, activeCardFilter, filters.searchTerm, filters.contactType, filters.isFavorite, filters.propertiesCount, filters.totalArea, filters.hasProperties, trash.showTrash, t, ownerStats],
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
