// ============================================================================
// RELATIONSHIP PROVIDER CONTEXT
// ============================================================================
//
// 🏢 Shared context για relationship data management
// Prevents duplicate API calls between RelationshipsSummary και ContactRelationshipManager
//
// ============================================================================

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { RequestDeduplicator } from '../hooks/useRelationshipListOptimized';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface RelationshipContextState {
  // Data state
  relationships: ContactRelationship[];
  loading: boolean;
  error: string | null;

  // UI state
  expandedRelationships: Set<string>;

  // Operations
  refreshRelationships: () => Promise<void>;
  deleteRelationship: (relationshipId: string) => Promise<void>;
  toggleExpanded: (relationshipId: string) => void;

  // Contact info
  contactId: string;
  contactType: ContactType;
}

interface RelationshipProviderProps {
  contactId: string;
  contactType: ContactType;
  onRelationshipsChange?: (relationships: ContactRelationship[]) => void;
  children: ReactNode;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const RelationshipContext = createContext<RelationshipContextState | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export const RelationshipProvider: React.FC<RelationshipProviderProps> = ({
  contactId,
  contactType,
  onRelationshipsChange,
  children
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [relationships, setRelationships] = useState<ContactRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRelationships, setExpandedRelationships] = useState<Set<string>>(new Set());

  // ============================================================================
  // API OPERATIONS
  // ============================================================================

  /**
   * 🔄 Load relationships using optimized request deduplicator
   */
  const loadRelationships = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        RequestDeduplicator.invalidate(contactId);
      }

      console.log('📋 PROVIDER: Loading relationships for contact:', contactId);
      const data = await RequestDeduplicator.get(contactId);

      setRelationships(prevRelationships => {
        const hasChanged = JSON.stringify(prevRelationships) !== JSON.stringify(data);
        if (hasChanged) {
          onRelationshipsChange?.(data);
          console.log('✅ PROVIDER: Relationships updated:', data.length);
          return data;
        }
        console.log('ℹ️ PROVIDER: Relationships unchanged, skipping update');
        return prevRelationships;
      });

    } catch (err) {
      const errorMessage = 'Σφάλμα φόρτωσης σχέσεων επαφής';
      setError(errorMessage);
      console.error('❌ PROVIDER: Error loading relationships:', err);
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, onRelationshipsChange]);

  /**
   * 🔄 Refresh relationships (public API)
   */
  const refreshRelationships = useCallback(async () => {
    console.log('🔄 PROVIDER: Force refreshing relationships for', contactId);
    await loadRelationships(true);
  }, [contactId, loadRelationships]);

  /**
   * 🗑️ Delete relationship με cache invalidation
   */
  const deleteRelationship = useCallback(async (relationshipId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🗑️ PROVIDER: Deleting relationship:', relationshipId);

      // Import dynamically to avoid circular dependencies
      const { ContactRelationshipService } = await import('@/services/contact-relationships.service');
      await ContactRelationshipService.deleteRelationship(relationshipId, 'user');

      // Invalidate cache
      RequestDeduplicator.invalidate(contactId);

      // Remove from local state immediately
      setRelationships(prev => {
        const updated = prev.filter(rel => rel.id !== relationshipId);
        onRelationshipsChange?.(updated);
        return updated;
      });

      // Remove from expanded set
      setExpandedRelationships(prev => {
        const newSet = new Set(prev);
        newSet.delete(relationshipId);
        return newSet;
      });

      console.log('✅ PROVIDER: Relationship deleted successfully');
    } catch (err) {
      const errorMessage = 'Σφάλμα διαγραφής σχέσης';
      setError(errorMessage);
      console.error('❌ PROVIDER: Error deleting relationship:', err);

      // Force refresh to ensure consistency
      await loadRelationships(true);
    } finally {
      setLoading(false);
    }
  }, [contactId, loadRelationships, onRelationshipsChange]);

  // ============================================================================
  // UI STATE MANAGEMENT
  // ============================================================================

  const toggleExpanded = useCallback((relationshipId: string) => {
    setExpandedRelationships(prev => {
      const newSet = new Set(prev);
      if (newSet.has(relationshipId)) {
        newSet.delete(relationshipId);
      } else {
        newSet.add(relationshipId);
      }
      return newSet;
    });
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * 🏗️ Load relationships when contactId changes
   */
  useEffect(() => {
    if (contactId && contactId !== 'new-contact' && contactId.trim() !== '') {
      loadRelationships();
    } else {
      // Clear state για new contacts
      setRelationships([]);
      setError(null);
      setExpandedRelationships(new Set());
    }
  }, [contactId, loadRelationships]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue: RelationshipContextState = {
    // Data state
    relationships,
    loading,
    error,

    // UI state
    expandedRelationships,

    // Operations
    refreshRelationships,
    deleteRelationship,
    toggleExpanded,

    // Contact info
    contactId,
    contactType
  };

  return (
    <RelationshipContext.Provider value={contextValue}>
      {children}
    </RelationshipContext.Provider>
  );
};

// ============================================================================
// HOOK FOR CONSUMING CONTEXT
// ============================================================================

/**
 * 🪝 Hook για accessing relationship context
 *
 * Use this instead of useRelationshipList in components that are
 * wrapped with RelationshipProvider
 */
export const useRelationshipContext = (): RelationshipContextState => {
  const context = useContext(RelationshipContext);

  if (!context) {
    throw new Error('useRelationshipContext must be used within a RelationshipProvider');
  }

  return context;
};