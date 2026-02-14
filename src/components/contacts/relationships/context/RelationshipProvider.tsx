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
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('RelationshipProvider');

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

      const data = await RequestDeduplicator.get(contactId);

      setRelationships(prevRelationships => {
        const prevIds = new Set(prevRelationships.map(rel => rel.id));
        const newIds = new Set(data.map(rel => rel.id));

        const hasChanged = prevRelationships.length !== data.length ||
                          !Array.from(newIds).every(id => prevIds.has(id));

        if (hasChanged || forceRefresh) {
          onRelationshipsChange?.(data);
          return data;
        }
        return prevRelationships;
      });

    } catch (err) {
      logger.error('loadRelationships failed:', { error: err });
      setError('relationships.manager.errors.listError');
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, onRelationshipsChange]);

  /**
   * 🔄 Refresh relationships (public API)
   */
  const refreshRelationships = useCallback(async () => {
    logger.info('PROVIDER: Force refreshing relationships for', { data: contactId });

    // 🔧 FIX: Ensure cache is fully invalidated before reload
    RequestDeduplicator.invalidate(contactId);

    // Small delay για Firestore eventual consistency
    await new Promise(resolve => setTimeout(resolve, 200));

    logger.info('PROVIDER: Cache invalidated, now reloading...');
    await loadRelationships(true);
    logger.info('PROVIDER: Refresh completed');
  }, [contactId, loadRelationships]);

  /**
   * 🗑️ Delete relationship με cache invalidation
   */
  const deleteRelationship = useCallback(async (relationshipId: string) => {
    try {
      setLoading(true);
      setError(null);

      logger.info('PROVIDER: Deleting relationship:', { data: relationshipId });

      // Import dynamically to avoid circular dependencies
      const { ContactRelationshipService } = await import('@/services/contact-relationships/ContactRelationshipService');
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

      logger.info('PROVIDER: Relationship deleted successfully');
    } catch (err) {
      const errorMessage = 'relationships.errors.saveFailed';
      setError(errorMessage);
      logger.error('PROVIDER: Error deleting relationship:', { error: err });

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