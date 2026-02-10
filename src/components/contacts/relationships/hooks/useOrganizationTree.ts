// ============================================================================
// USE ORGANIZATION TREE HOOK
// ============================================================================
//
// 🪝 Custom hook for managing organization tree state and operations
// Extracted from ContactRelationshipManager for better separation of concerns
//
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { ContactType } from '@/types/contacts';

const logger = createModuleLogger('useOrganizationTree');
import type { OrganizationTree } from '@/types/contacts/relationships';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import type { UseOrganizationTreeReturn } from '../types/relationship-manager.types';

/**
 * 🪝 useOrganizationTree Hook
 *
 * Manages the organization hierarchy tree for companies and services
 *
 * @param contactId - The organization contact ID
 * @param contactType - The type of contact
 * @returns Hook state and methods
 */
export const useOrganizationTree = (
  contactId: string,
  contactType: ContactType
): UseOrganizationTreeReturn => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [organizationTree, setOrganizationTree] = useState<OrganizationTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // API OPERATIONS
  // ============================================================================

  /**
   * 🌳 Load organization hierarchy tree
   */
  const loadOrganizationTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Loading organization tree', { contactId });
      const tree = await ContactRelationshipService.buildOrganizationHierarchy(contactId);

      setOrganizationTree(tree);
      logger.info('Organization tree loaded successfully');

    } catch (err) {
      const errorMessage = 'Σφάλμα φόρτωσης οργανωτικού διαγράμματος';
      setError(errorMessage);
      logger.error('Error loading organization tree', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        contactId
      });
      setOrganizationTree(null);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  /**
   * 🔄 Refresh organization tree (public API)
   */
  const refreshTree = useCallback(async () => {
    await loadOrganizationTree();
  }, [loadOrganizationTree]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * 🏗️ Load organization tree when component mounts or dependencies change
   */
  useEffect(() => {
    // Only load tree for companies and services with valid IDs
    if (
      (contactType === 'company' || contactType === 'service') &&
      contactId &&
      contactId !== 'new-contact' &&
      contactId.trim() !== ''
    ) {
      loadOrganizationTree();
    } else {
      // Clear tree for individual contacts or invalid IDs
      setOrganizationTree(null);
      setError(null);
    }
  }, [contactId, contactType, loadOrganizationTree]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * 📊 Check if organization tree should be displayed
   * Show for companies/services even if tree is empty to provide feedback
   */
  const shouldShowTree = !!(
    (contactType === 'company' || contactType === 'service') &&
    contactId &&
    contactId !== 'new-contact' &&
    contactId.trim() !== ''
  );

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    // Data state
    organizationTree,
    loading,
    error,

    // Operations
    refreshTree,

    // Computed values
    shouldShowTree
  };
};