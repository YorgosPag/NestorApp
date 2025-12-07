// ============================================================================
// USE RELATIONSHIP LIST HOOK
// ============================================================================
//
// 🪝 Custom hook for managing relationship list state and operations
// Extracted from ContactRelationshipManager for better separation of concerns
//
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import type { UseRelationshipListReturn } from '../types/relationship-manager.types';

/**
 * 🪝 useRelationshipList Hook
 *
 * Manages the state and operations for relationship list display
 *
 * @param contactId - The contact ID to load relationships for
 * @param contactType - The type of contact
 * @param onRelationshipsChange - Optional callback when relationships change
 * @returns Hook state and methods
 */
export const useRelationshipList = (
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

  // ============================================================================
  // API OPERATIONS
  // ============================================================================

  /**
   * 🔄 Load relationships for the contact
   */
  const loadRelationships = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📋 Loading relationships for contact:', contactId);
      const data = await ContactRelationshipService.getContactRelationships(contactId);

      setRelationships(data);
      onRelationshipsChange?.(data);

      console.log('✅ Loaded relationships:', data.length);
    } catch (err) {
      const errorMessage = 'Σφάλμα φόρτωσης σχέσεων επαφής';
      setError(errorMessage);
      console.error('❌ Error loading relationships:', err);
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  }, [contactId, onRelationshipsChange]);

  /**
   * 🗑️ Delete a relationship
   */
  const deleteRelationship = useCallback(async (relationshipId: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🗑️ Deleting relationship:', relationshipId);
      await ContactRelationshipService.deleteRelationship(relationshipId, 'user');

      // Remove from local state immediately for better UX
      setRelationships(prev => {
        const updated = prev.filter(rel => rel.id !== relationshipId);
        onRelationshipsChange?.(updated);
        return updated;
      });

      // Remove from expanded set if it was expanded
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

      // Refresh list to ensure consistency
      await loadRelationships();
    } finally {
      setLoading(false);
    }
  }, [loadRelationships, onRelationshipsChange]);

  /**
   * 🔄 Refresh relationships (public API)
   */
  const refreshRelationships = useCallback(async () => {
    console.log('🔄 RELATIONSHIP LIST: refreshRelationships called - reloading relationships...');
    await loadRelationships();
    console.log('✅ RELATIONSHIP LIST: refreshRelationships completed - relationships should be updated');
  }, [loadRelationships]);

  // ============================================================================
  // UI STATE MANAGEMENT
  // ============================================================================

  /**
   * 📖 Toggle expanded state for a relationship card
   */
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
   * 🏗️ Load relationships when component mounts or contactId changes
   */
  useEffect(() => {
    // Only load relationships if we have a real contact ID
    if (contactId && contactId !== 'new-contact' && contactId.trim() !== '') {
      loadRelationships();
    } else {
      // For new contacts or no ID, show empty state
      setRelationships([]);
      setError(null);
      setExpandedRelationships(new Set());
    }
  }, [contactId, loadRelationships]);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Data state
    relationships,
    loading,
    error,
    expandedRelationships,

    // Operations
    refreshRelationships,
    handleDelete: deleteRelationship,
    handleToggleExpanded: toggleExpanded
  };
};