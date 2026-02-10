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

import React, { useState, useEffect, useCallback } from 'react';
import { EnterpriseContactDropdown, type ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { ContactsService } from '@/services/contacts.service';
import { ContactNameResolver } from '@/services/contacts/ContactNameResolver';
import type { ContactType } from '@/types/contacts';
import { designSystem } from '@/lib/design-system';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔐 ENTERPRISE: Defense-in-depth auth guard
import { useAuth } from '@/auth/hooks/useAuth';

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
  label,
  placeholder,
  required = false,
  error,
  disabled = false,
  readonly = false,
  className,
  searchConfig = {}
}) => {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');
  // 🔐 ENTERPRISE: Defense-in-depth — gate data fetching on auth state
  const { user, loading: authLoading } = useAuth();

  // Use translated defaults
  const displayLabel = label ?? t('relationships.form.labels.contact');
  const displayPlaceholder = placeholder ?? t('relationships.form.placeholders.searchContact');
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
    const DEBUG = finalSearchConfig.debug;
    if (DEBUG) console.log('🔍 STARTING CONTACT SEARCH - Query:', query);
    setIsSearching(true);
    setSearchError(null);

    try {
      let contacts;

      if (!query.trim()) {
        // Load all contacts when no query
        const allContactsResult = await ContactsService.getAllContacts({
          limitCount: 100
        });
        contacts = allContactsResult.contacts || [];

        if (DEBUG) {
          console.log('🔍 DEBUG: All contacts loaded:', contacts.length);
        }
      } else {
        // Search with query
        const searchResults = await ContactsService.searchContacts({
          searchTerm: query
        });
        contacts = searchResults;

        if (DEBUG) {
          console.log('🔍 DEBUG: Search results for query "' + query + '":', contacts.length);
        }
      }

      // 🏢 ENTERPRISE: Use centralized ContactNameResolver για mapping
      const contactSummaries = ContactNameResolver.mapContactsToSummaries(
        contacts,
        undefined,
        {
          debug: DEBUG,
          maxLength: 100
        }
      );

      if (DEBUG) console.log('📊 AFTER CONTACTNAMERESOLVER MAPPING:', contactSummaries.length);

      // Filter based on configuration
      const filteredContacts = contactSummaries
        .filter(contact => {
          // Exclude specified contact IDs
          if (excludeContactIds.includes(contact.id)) {
            if (DEBUG) console.log('🔍 DEBUG: Excluding contact by ID:', contact.id, contact.name);
            return false;
          }

          // Filter by allowed contact types
          if (allowedContactTypes.length > 0 && !allowedContactTypes.includes(contact.type)) {
            if (DEBUG) console.log('🔍 DEBUG: Excluding contact by type:', contact.type, contact.name);
            return false;
          }

          return true;
        })
        .slice(0, finalSearchConfig.maxResults);

      if (DEBUG) console.log('📊 FINAL FILTERED CONTACTS:', filteredContacts.length);

      setSearchResults(filteredContacts);

    } catch (error) {
      console.error('🚨 ContactSearchManager Error:', error);
      setSearchError(t('relationships.manager.errors.searchError', 'Search error'));
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
    // 🔐 ENTERPRISE: Gate on authentication (Defense-in-Depth, NavigationContext pattern)
    if (authLoading) return;
    if (!user) return;

    if (finalSearchConfig.autoLoadContacts && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      handleContactSearch('');
    }
  }, [authLoading, user]); // Re-run when auth state resolves

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
        label={displayLabel}
        placeholder={displayPlaceholder}
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
      setError('Search error'); // Note: Hardcoded fallback since hooks cannot use i18n
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