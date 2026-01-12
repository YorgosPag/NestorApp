// ============================================================================
// 🔍 CONTACT SEARCH MANAGER COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΑΝΑΖΗΤΗΣΗ
// ============================================================================
//
// 🎯 PURPOSE: Reusable contact search and selection component
// 🔗 USED BY: RelationshipForm, ContactModals, EmployeeSelector
// 🏢 STANDARDS: Enterprise search patterns, centralized contact resolution
//
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EnterpriseContactDropdown, type ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { ContactsService } from '@/services/contacts.service';
import { ContactNameResolver } from '@/services/contacts/ContactNameResolver';
import type { ContactType } from '@/types/contacts';
import { designSystem } from '@/lib/design-system';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ContactSearchManagerProps {
  /** Current selected contact ID */
  selectedContactId: string;

  /** Callback when contact is selected */
  onContactSelect: (contact: ContactSummary | null) => void;

  /** Contact IDs to exclude from search results */
  excludeContactIds?: string[];

  /** Allowed contact types for filtering */
  allowedContactTypes?: ContactType[];

  /** Component configuration */
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  readonly?: boolean;
  className?: string;

  /** Search configuration */
  searchConfig?: {
    /** Enable debug logging */
    debug?: boolean;
    /** Maximum results to show */
    maxResults?: number;
    /** Auto-load all contacts on mount */
    autoLoadContacts?: boolean;
  };
}

// ============================================================================
// ENTERPRISE CONTACT SEARCH MANAGER
// ============================================================================

export const ContactSearchManager: React.FC<ContactSearchManagerProps> = ({
  selectedContactId,
  onContactSelect,
  excludeContactIds = [],
  allowedContactTypes = ['individual', 'company', 'service'],
  label = "Επαφή",
  placeholder = "Αναζήτηση επαφής...",
  required = false,
  error,
  disabled = false,
  readonly = false,
  className,
  searchConfig = {}
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [searchResults, setSearchResults] = useState<ContactSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Merge search configuration with defaults
  const finalSearchConfig = {
    debug: false, // Disable debug logs
    maxResults: 50,
    autoLoadContacts: true,
    ...searchConfig
  };

  // ============================================================================
  // CENTRALIZED SEARCH LOGIC
  // ============================================================================

  /**
   * 🔍 Handle Contact Search - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΛΟΓΙΚΗ
   */
  const handleContactSearch = useCallback(async (query: string) => {
    console.log('🔍 STARTING CONTACT SEARCH - Query:', query);
    setIsSearching(true);
    setSearchError(null);

    try {
      let contacts;

      if (!query.trim()) {
        // Load all contacts when no query
        const allContactsResult = await ContactsService.getAllContacts({
          limitCount: 100 // Ensure we get enough contacts for the dropdown
        });
        contacts = allContactsResult.contacts || [];

        if (finalSearchConfig.debug) {
          console.log('🔍 DEBUG: All contacts loaded:', contacts.length);
          console.log('🔍 DEBUG: All contacts data:', contacts.map(c => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
            type: c.type,
            status: c.status
          })));
        }
      } else {
        // Search with query
        const searchResults = await ContactsService.searchContacts({
          searchTerm: query
        });
        contacts = searchResults;

        if (finalSearchConfig.debug) {
          console.log('🔍 DEBUG: Search results for query "' + query + '":', contacts.length);
          console.log('🔍 DEBUG: Search results data:', contacts.map(c => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
            type: c.type,
            status: c.status
          })));
        }
      }

      // 🏢 ENTERPRISE: Use centralized ContactNameResolver για mapping
      console.log('🔧 PROCESSING CONTACTS THROUGH ContactNameResolver...');
      const contactSummaries = ContactNameResolver.mapContactsToSummaries(
        contacts,
        undefined, // Don't exclude based on current contact here
        {
          debug: true, // Force debug to see resolver details
          maxLength: 100
        }
      );

      console.log('📊 AFTER CONTACTNAMERESOLVER MAPPING:', contactSummaries.length);
      console.log('📊 CONTACT SUMMARIES DETAILS:', contactSummaries.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        email: c.email,
        phone: c.phone,
        company: c.company
      })));

      if (finalSearchConfig.debug) {
        console.log('🔍 DEBUG: After ContactNameResolver mapping:', contactSummaries.length);
        console.log('🔍 DEBUG: Contact summaries:', contactSummaries.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        })));
      }

      // Filter based on configuration
      console.log('🔧 APPLYING FILTERS...');
      console.log('📊 FILTER CONFIG - excludeContactIds:', excludeContactIds);
      console.log('📊 FILTER CONFIG - allowedContactTypes:', allowedContactTypes);
      console.log('📊 FILTER CONFIG - maxResults:', finalSearchConfig.maxResults);

      const filteredContacts = contactSummaries
        .filter(contact => {
          // Exclude specified contact IDs
          if (excludeContactIds.includes(contact.id)) {
            console.log('❌ FILTERING OUT BY ID:', contact.id, contact.name);
            if (finalSearchConfig.debug) {
              console.log('🔍 DEBUG: Excluding contact by ID:', contact.id, contact.name);
            }
            return false;
          }

          // Filter by allowed contact types
          if (allowedContactTypes.length > 0 && !allowedContactTypes.includes(contact.type)) {
            console.log('❌ FILTERING OUT BY TYPE:', contact.type, contact.name, 'allowed:', allowedContactTypes);
            if (finalSearchConfig.debug) {
              console.log('🔍 DEBUG: Excluding contact by type:', contact.type, contact.name);
            }
            return false;
          }

          console.log('✅ CONTACT PASSED FILTERS:', contact.id, contact.name, contact.type);
          return true;
        })
        .slice(0, finalSearchConfig.maxResults);

      console.log('📊 AFTER FILTERING:', filteredContacts.length);
      console.log('📊 FINAL FILTERED CONTACTS:', filteredContacts.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      })));

      if (finalSearchConfig.debug) {
        console.log('🔍 DEBUG: Final filtered contacts:', filteredContacts.length);
        console.log('🔍 DEBUG: Sample contacts:', filteredContacts.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        })));
      }

      setSearchResults(filteredContacts);

    } catch (error) {
      console.error('🚨 ContactSearchManager Error:', error);
      setSearchError('Σφάλμα κατά την αναζήτηση επαφών');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [excludeContactIds, allowedContactTypes, finalSearchConfig]);

  /**
   * 👤 Handle Contact Selection - Enhanced με validation
   */
  const handleContactSelect = useCallback((contact: ContactSummary | null) => {
    if (finalSearchConfig.debug) {
      console.log('🔍 DEBUG: Contact selected:', contact ? {
        id: contact.id,
        name: contact.name,
        type: contact.type
      } : null);
    }

    onContactSelect(contact);
    setSearchError(null);
  }, [onContactSelect, finalSearchConfig.debug]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-load contacts on mount - with ref to prevent loops
  const hasAutoLoaded = React.useRef(false);

  useEffect(() => {
    console.log('🔄 AUTO-LOAD EFFECT TRIGGERED:', {
      autoLoadContacts: finalSearchConfig.autoLoadContacts,
      hasAutoLoaded: hasAutoLoaded.current,
      shouldLoad: finalSearchConfig.autoLoadContacts && !hasAutoLoaded.current
    });

    if (finalSearchConfig.autoLoadContacts && !hasAutoLoaded.current) {
      console.log('🚀 TRIGGERING AUTO-LOAD: handleContactSearch(\'\')');
      hasAutoLoaded.current = true;
      handleContactSearch('');
    } else {
      console.log('❌ AUTO-LOAD SKIPPED:', {
        autoLoadContacts: finalSearchConfig.autoLoadContacts,
        hasAutoLoaded: hasAutoLoaded.current
      });
    }
  }, []); // Empty dependency array to run only once on mount

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={designSystem.cn("space-y-2", className)}>
      <EnterpriseContactDropdown
        value={selectedContactId}
        onContactSelect={handleContactSelect}
        searchResults={searchResults}
        onSearch={handleContactSearch}
        isSearching={isSearching}
        label={label}
        placeholder={placeholder}
        allowedContactTypes={allowedContactTypes}
        excludeContactIds={excludeContactIds}
        required={required}
        error={error || searchError || undefined}
        readonly={readonly || disabled}
      />

      {finalSearchConfig.debug && (
        <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded">
          <div>🔍 DEBUG INFO:</div>
          <div>Results: {searchResults.length}</div>
          <div>Excluded IDs: {excludeContactIds.length}</div>
          <div>Allowed Types: {allowedContactTypes.join(', ')}</div>
          {searchError && <div className="text-destructive">Error: {searchError}</div>}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CONVENIENCE HOOKS για Advanced Usage
// ============================================================================

/**
 * 🪝 useContactSearch Hook για advanced usage
 */
export const useContactSearch = (config: {
  excludeContactIds?: string[];
  allowedContactTypes?: ContactType[];
  maxResults?: number;
  debug?: boolean;
}) => {
  const [searchResults, setSearchResults] = useState<ContactSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchContacts = useCallback(async (query: string) => {
    setIsSearching(true);
    setError(null);

    try {
      let contacts;

      if (!query.trim()) {
        const allContactsResult = await ContactsService.getAllContacts();
        contacts = allContactsResult.contacts || [];
      } else {
        contacts = await ContactsService.searchContacts({ searchTerm: query });
      }

      const contactSummaries = ContactNameResolver.mapContactsToSummaries(
        contacts,
        undefined,
        { debug: config.debug }
      );

      const filteredContacts = contactSummaries
        .filter(contact => {
          if (config.excludeContactIds?.includes(contact.id)) return false;
          if (config.allowedContactTypes?.length && !config.allowedContactTypes.includes(contact.type)) return false;
          return true;
        })
        .slice(0, config.maxResults || 50);

      setSearchResults(filteredContacts);
    } catch (err) {
      console.error('Contact search error:', err);
      setError('Σφάλμα κατά την αναζήτηση επαφών');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [config]);

  return {
    searchResults,
    isSearching,
    error,
    searchContacts
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default ContactSearchManager;