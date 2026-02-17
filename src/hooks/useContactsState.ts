'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Contact } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { getUnits } from '@/services/units.service';
import type { Property } from '@/types/property-viewer';
import { getContactDisplayName } from '@/types/contacts';
import { normalizeToDate } from '@/lib/date-local';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ContactUpdatedPayload, type ContactCreatedPayload, type ContactDeletedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
// 🔐 ENTERPRISE: Defense-in-depth — auth guard (same pattern as useRealtimeBuildings)
import { useAuth } from '@/hooks/useAuth';

const logger = createModuleLogger('useContactsState');


export type ViewMode = 'list' | 'grid';
export type ContactTypeFilter = 'all' | 'individual' | 'company' | 'service';
export type UnitsCountFilter = 'all' | '1-2' | '3-5' | '6+';
export type AreaFilter = 'all' | '0-100' | '101-300' | '301+';

interface ContactStats {
    unitsCount: number;
    totalArea: number;
}

export function useContactsState() {
  const searchParams = useSearchParams();
  const contactIdFromUrl = searchParams.get('contactId');
  const { user, loading: authLoading } = useAuth();

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [allUnits, setAllUnits] = useState<Property[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ContactTypeFilter>('all');
  const [showOnlyOwners, setShowOnlyOwners] = useState(false);
  const [unitsCountFilter, setUnitsCountFilter] = useState<UnitsCountFilter>('all');
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  
  const ownerContactIds = useMemo(() => {
    return Array.from(
      new Set(
        allUnits
          .map(u => u.soldTo)
          .filter((v): v is string => Boolean(v))
      )
    );
  }, [allUnits]);

  // Function to force data refresh
  const forceDataRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // 🏢 ENTERPRISE: Real-time contacts subscription via Firestore onSnapshot
  // 🔐 Defense-in-depth: Gate on authentication (same pattern as useRealtimeBuildings)
  useEffect(() => {
    // Wait for auth state to resolve before subscribing
    if (authLoading) return;
    if (!user) {
      setAllContacts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubContacts: (() => void) | null = null;

    const setup = async () => {
      try {
        // Units: one-time fetch (no real-time needed)
        const units = await getUnits();
        setAllUnits(units);

        // Contacts: real-time subscription via onSnapshot
        unsubContacts = await ContactsService.subscribeToContacts(
          (contacts) => {
            setAllContacts(contacts);
            setIsLoading(false);
          },
          { limitCount: 1000 }
        );
      } catch (error) {
        logger.error('Failed to setup contacts subscription', { error });
        setIsLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubContacts) unsubContacts();
    };
  }, [user, authLoading, refreshKey]);

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Subscribe to contact updates for cross-page sync
  useEffect(() => {
    const handleContactUpdate = (payload: ContactUpdatedPayload) => {
      logger.info('Applying update for contact', { contactId: payload.contactId });

      // 🏢 ENTERPRISE: Type-safe partial update helper
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

      setAllContacts(prev => prev.map(contact =>
        contact.id === payload.contactId
          ? applyContactUpdates(contact)
          : contact
      ));

      // Also update selectedContact if it's the one being updated
      setSelectedContact(prev =>
        prev?.id === payload.contactId
          ? applyContactUpdates(prev)
          : prev
      );
    };

    // Subscribe to contact updates (same-page + cross-page)
    const unsubscribe = RealtimeService.subscribe('CONTACT_UPDATED', handleContactUpdate, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, []);

  // 🏢 ENTERPRISE: Subscribe to contact CREATED events for cross-page sync
  useEffect(() => {
    const handleContactCreated = (payload: ContactCreatedPayload) => {
      logger.info('New contact created', { contactId: payload.contactId });
      // Force refresh to fetch the new contact with all its data
      forceDataRefresh();
    };

    const unsubscribe = RealtimeService.subscribe('CONTACT_CREATED', handleContactCreated, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, [forceDataRefresh]);

  // 🏢 ENTERPRISE: Subscribe to contact DELETED events for cross-page sync
  useEffect(() => {
    const handleContactDeleted = (payload: ContactDeletedPayload) => {
      logger.info('Contact deleted', { contactId: payload.contactId });

      // Remove the deleted contact from the list
      setAllContacts(prev => prev.filter(contact => contact.id !== payload.contactId));

      // If the deleted contact was selected, clear selection
      setSelectedContact(prev =>
        prev?.id === payload.contactId ? null : prev
      );
    };

    const unsubscribe = RealtimeService.subscribe('CONTACT_DELETED', handleContactDeleted, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, []);

  // Effect to handle initial contact selection from URL or default
  useEffect(() => {
    if (!allContacts.length) return;
    if (contactIdFromUrl) {
      const found = allContacts.find(c => c.id === contactIdFromUrl);
      if (found) setSelectedContact(found);
      return;
    }
    if (!selectedContact) {
      // 🏢 ENTERPRISE: Find primary company from database, not hardcoded ID
      const primaryCompany = allContacts.find(c =>
        c.type === 'company' && (
          c.companyName?.toLowerCase().includes('παγωνη') ||
          c.displayName?.toLowerCase().includes('παγωνη') ||
          c.isFavorite === true
        )
      );
      setSelectedContact(primaryCompany || allContacts[0]);
    }
  }, [allContacts, contactIdFromUrl]);

  // Create a map of contact stats
  const contactStatsMap = useMemo(() => {
    const stats = new Map<string, ContactStats>();
    allUnits.forEach(unit => {
      if (unit.soldTo) {
        const currentStats = stats.get(unit.soldTo) || { unitsCount: 0, totalArea: 0 };
        currentStats.unitsCount += 1;
        currentStats.totalArea += unit.area || 0;
        stats.set(unit.soldTo, currentStats);
      }
    });
    return stats;
  }, [allUnits]);


  // Filtered contacts logic
  const filteredContacts = useMemo(() => {
    return allContacts.filter(contact => {
        const contactStats = contact.id ? contactStatsMap.get(contact.id) : undefined;
        const unitsCount = contactStats?.unitsCount || 0;
        const totalArea = contactStats?.totalArea || 0;

        const matchesType = filterType === 'all' || contact.type === filterType;
        const matchesSearch = searchTerm === '' || getContactDisplayName(contact).toLowerCase().includes(searchTerm.toLowerCase());
        const matchesOwnership = !showOnlyOwners || (contact.id && ownerContactIds.includes(contact.id));
        
        const matchesUnitsCount = unitsCountFilter === 'all' ||
            (unitsCountFilter === '1-2' && unitsCount >= 1 && unitsCount <= 2) ||
            (unitsCountFilter === '3-5' && unitsCount >= 3 && unitsCount <= 5) ||
            (unitsCountFilter === '6+' && unitsCount >= 6);

        const matchesArea = areaFilter === 'all' ||
            (areaFilter === '0-100' && totalArea > 0 && totalArea <= 100) ||
            (areaFilter === '101-300' && totalArea >= 101 && totalArea <= 300) ||
            (areaFilter === '301+' && totalArea > 300);

        return matchesType && matchesSearch && matchesOwnership && matchesUnitsCount && matchesArea;
    });
  }, [allContacts, filterType, searchTerm, showOnlyOwners, ownerContactIds, unitsCountFilter, areaFilter, contactStatsMap]);

  // Stats calculation for dashboard
  const oneMonthAgo = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  }, []);

  const stats = useMemo(() => {
    const data = filteredContacts;
    return {
      totalContacts: data.length,
      individuals: data.filter(c => c.type === 'individual').length,
      companies: data.filter(c => c.type === 'company').length,
      services: data.filter(c => c.type === 'service').length,
      active: data.filter(c => (c as Contact & { status?: string }).status === 'active').length,
      newThisMonth: data.filter(c => {
        const contactWithCreatedAt = c as Contact & { createdAt?: unknown };
        const d = normalizeToDate(contactWithCreatedAt.createdAt);
        return d ? d > oneMonthAgo : false;
      }).length,
    };
  }, [filteredContacts, oneMonthAgo]);
  
  return {
    allContacts,
    filteredContacts,
    stats,
    selectedContact,
    setSelectedContact,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    isLoading,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    showOnlyOwners,
    setShowOnlyOwners,
    unitsCountFilter,
    setUnitsCountFilter,
    areaFilter,
    setAreaFilter,
    forceDataRefresh,
  };
}

