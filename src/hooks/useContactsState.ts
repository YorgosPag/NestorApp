'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Contact } from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';
import { getUnits } from '@/services/units.service';
import type { Property } from '@/types/property-viewer';
import { getContactDisplayName } from '@/types/contacts';
import { normalizeToDate } from '@/lib/date-local';


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

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [{ contacts }, units] = await Promise.all([
          ContactsService.getAllContacts({ limitCount: 1000 }),
          getUnits()
        ]);
        
        setAllContacts(contacts);
        setAllUnits(units);

      } catch (error) {
        console.error("Failed to fetch contacts or units:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [refreshKey]);
  
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
          c.isPrimary === true
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
      active: data.filter((c: any) => c.status === 'active').length,
      newThisMonth: data.filter(c => {
        const d = normalizeToDate((c as any).createdAt);
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
