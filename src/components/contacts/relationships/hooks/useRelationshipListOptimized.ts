// ============================================================================
// OPTIMIZED RELATIONSHIP LIST HOOK
// ============================================================================
//
// 🚀 Performance-optimized hook for managing relationship list state
// Includes caching, deduplication, and batch operations
//
// ============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import type { UseRelationshipListReturn } from '../types/relationship-manager.types';

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * 💾 Simple in-memory cache για relationships
 * Prevents redundant API calls για the same contact
 */
class RelationshipCache {
  private static cache = new Map<string, {
    data: ContactRelationship[];
    timestamp: number;
    expires: number;
  }>();

  private static readonly CACHE_TTL = 30 * 1000; // 30 seconds (shorter για better real-time updates)

  static get(contactId: string): ContactRelationship[] | null {
    const entry = this.cache.get(contactId);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(contactId);
      return null;
    }

    console.log('🚀 CACHE HIT: Using cached relationships for', contactId);
    return entry.data;
  }

  static set(contactId: string, data: ContactRelationship[]): void {
    this.cache.set(contactId, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + this.CACHE_TTL
    });
    console.log('💾 CACHE SET: Cached relationships for', contactId, 'count:', data.length);
  }

  static invalidate(contactId: string): void {
    this.cache.delete(contactId);
    console.log('🗑️ CACHE INVALIDATED: Cleared cache for', contactId);
  }

  static invalidateAll(): void {
    this.cache.clear();
    console.log('🗑️ CACHE CLEARED: All relationship cache cleared');
  }
}

/**
 * 🔄 Request deduplication
 * Prevents multiple simultaneous requests για the same contact
 */
class RequestDeduplicator {
  private static pendingRequests = new Map<string, Promise<ContactRelationship[]>>();

  static async get(contactId: string): Promise<ContactRelationship[]> {
    // Check if request is already in progress
    const pending = this.pendingRequests.get(contactId);
    if (pending) {
      console.log('🔄 DEDUP: Using existing request for', contactId);
      return pending;
    }

    // Check cache first
    const cached = RelationshipCache.get(contactId);
    if (cached) {
      return cached;
    }

    // Create new request
    console.log('🚀 NEW REQUEST: Loading relationships for', contactId);
    const request = ContactRelationshipService.getContactRelationships(contactId);

    this.pendingRequests.set(contactId, request);

    try {
      const data = await request;
      RelationshipCache.set(contactId, data);
      return data;
    } finally {
      this.pendingRequests.delete(contactId);
    }
  }

  static invalidate(contactId: string): void {
    this.pendingRequests.delete(contactId);
    RelationshipCache.invalidate(contactId);
  }
}

// ============================================================================
// OPTIMIZED HOOK
// ============================================================================

/**
 * 🪝 useRelationshipListOptimized Hook
 *
 * Performance-optimized version με:
 * - In-memory caching (5 min TTL)
 * - Request deduplication
 * - Batch operations
 * - Smart re-rendering prevention
 *
 * @param contactId - The contact ID to load relationships for
 * @param contactType - The type of contact
 * @param onRelationshipsChange - Optional callback when relationships change
 * @returns Hook state and methods
 */
export const useRelationshipListOptimized = (
  contactId: string,
  contactType: ContactType,
  onRelationshipsChange?: (relationships: ContactRelationship[]) => void
): UseRelationshipListReturn => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [relationships, setRelationships] = useState<ContactRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRelationships, setExpandedRelationships] = useState<Set<string>>(new Set());

  // Refs για preventing unnecessary re-renders
  const lastContactId = useRef<string>('');
  const lastUpdateTimestamp = useRef<number>(0);
  const callbackRef = useRef(onRelationshipsChange);
  callbackRef.current = onRelationshipsChange;

  // ============================================================================
  // OPTIMIZED LOADING
  // ============================================================================

  /**
   * 🔄 Load relationships με caching και deduplication
   */
  const loadRelationships = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        RequestDeduplicator.invalidate(contactId);
      }

      console.log('📋 Loading relationships for contact:', contactId);
      const data = await RequestDeduplicator.get(contactId);

      // Only update state if data actually changed (compare by IDs only)
      setRelationships(prevRelationships => {
        // Compare by IDs only (timestamps may differ due to serverTimestamp)
        const prevIds = new Set(prevRelationships.map(rel => rel.id));
        const newIds = new Set(data.map(rel => rel.id));

        const hasChanged = prevRelationships.length !== data.length ||
                          !Array.from(newIds).every(id => prevIds.has(id)) ||
                          forceRefresh;

        if (hasChanged) {
          lastUpdateTimestamp.current = Date.now();
          callbackRef.current?.(data);
          console.log('✅ OPTIMIZED: Relationships updated:', data.length);
          return data;
        }
        console.log('ℹ️ OPTIMIZED: Relationships unchanged, skipping update');
        return prevRelationships;
      });

    } catch (err) {
      const errorMessage = 'Σφάλμα φόρτωσης σχέσεων επαφής';
      setError(errorMessage);
      console.error('❌ Error loading relationships:', err);
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  // ============================================================================
  // OPTIMIZED OPERATIONS
  // ============================================================================

  /**
   * 🗑️ Delete relationship με cache invalidation
   */
  const deleteRelationship = useCallback(async (relationshipId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🗑️ Deleting relationship:', relationshipId);
      await ContactRelationshipService.deleteRelationship(relationshipId, 'user');

      // Invalidate cache για this contact
      RequestDeduplicator.invalidate(contactId);

      // Remove from local state immediately για better UX
      setRelationships(prev => {
        const updated = prev.filter(rel => rel.id !== relationshipId);
        callbackRef.current?.(updated);
        return updated;
      });

      // Remove from expanded set
      setExpandedRelationships(prev => {
        const newSet = new Set(prev);
        newSet.delete(relationshipId);
        return newSet;
      });

      console.log('✅ Relationship deleted successfully');
    } catch (err) {
      const errorMessage = 'Σφάλμα διαγραφής σχέσης';
      setError(errorMessage);
      console.error('❌ Error deleting relationship:', err);

      // Force refresh to ensure consistency
      await loadRelationships(true);
    } finally {
      setLoading(false);
    }
  }, [contactId, loadRelationships]);

  /**
   * 🔄 Refresh relationships (force reload)
   */
  const refreshRelationships = useCallback(async () => {
    console.log('🔄 OPTIMIZED: Force refreshing relationships for', contactId);
    await loadRelationships(true);
  }, [contactId, loadRelationships]);

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
  // SMART EFFECTS
  // ============================================================================

  /**
   * 🏗️ Load relationships only when contactId actually changes
   */
  useEffect(() => {
    // Only load if we have a valid contact ID και it's different from last time
    if (contactId &&
        contactId !== 'new-contact' &&
        contactId.trim() !== '' &&
        contactId !== lastContactId.current) {

      lastContactId.current = contactId;
      loadRelationships();
    } else if (!contactId || contactId === 'new-contact') {
      // Clear state για new contacts
      setRelationships([]);
      setError(null);
      setExpandedRelationships(new Set());
      lastContactId.current = '';
    }
  }, [contactId, loadRelationships]);

  // ============================================================================
  // MEMOIZED RETURN VALUE
  // ============================================================================

  return useMemo(() => ({
    // Data state
    relationships,
    loading,
    error,
    expandedRelationships,

    // Operations
    refreshRelationships,
    handleDelete: deleteRelationship,
    handleToggleExpanded: toggleExpanded
  }), [relationships, loading, error, expandedRelationships, refreshRelationships, deleteRelationship, toggleExpanded]);
};

// ============================================================================
// EXPORT CACHE UTILITIES για external use
// ============================================================================

export { RelationshipCache, RequestDeduplicator };