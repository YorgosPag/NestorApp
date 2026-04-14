'use client';

/**
 * 🗑️ usePropertiesTrashState
 *
 * Manages the trash view for the properties page.
 * Follows the same pattern as useContactsTrashState (ADR-191).
 *
 * @module hooks/usePropertiesTrashState
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { Property } from '@/types/property-viewer';

const logger = createModuleLogger('usePropertiesTrashState');

interface UsePropertiesTrashStateParams {
  selectedPropertyIds: string[];
  setSelectedProperties: (ids: string[]) => void;
  forceDataRefresh: () => void;
}

interface TrashApiResponse {
  success: boolean;
  properties: Property[];
  count: number;
}

export function usePropertiesTrashState({
  selectedPropertyIds,
  setSelectedProperties,
  forceDataRefresh,
}: UsePropertiesTrashStateParams) {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedProperties, setTrashedProperties] = useState<Property[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);

  const trashCount = trashedProperties.length;

  const fetchTrashedProperties = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const response = await apiClient.get<TrashApiResponse>(API_ROUTES.PROPERTIES.TRASH);
      setTrashedProperties(response.properties ?? []);
    } catch (error) {
      logger.error('Failed to fetch deleted properties', { error });
      setTrashedProperties([]);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  const handleToggleTrash = useCallback(async () => {
    const next = !showTrash;
    setShowTrash(next);
    setSelectedProperties([]);
    if (next) {
      await fetchTrashedProperties();
    }
  }, [showTrash, setSelectedProperties, fetchTrashedProperties]);

  /** Called after restore/permanent-delete to refresh both lists */
  const handleTrashActionComplete = useCallback(() => {
    setSelectedProperties([]);
    forceDataRefresh();
    void fetchTrashedProperties();
  }, [setSelectedProperties, forceDataRefresh, fetchTrashedProperties]);

  const handleRestoreProperties = useCallback((ids?: string[]) => {
    const targets = ids ?? (selectedPropertyIds.length > 0 ? selectedPropertyIds : []);
    if (targets.length > 0) {
      setSelectedProperties(targets);
    }
  }, [selectedPropertyIds, setSelectedProperties]);

  const handlePermanentDeleteProperties = useCallback((ids?: string[]) => {
    const targets = ids ?? (selectedPropertyIds.length > 0 ? selectedPropertyIds : []);
    if (targets.length > 0) {
      setSelectedProperties(targets);
    }
    setShowPermanentDeleteDialog(true);
  }, [selectedPropertyIds, setSelectedProperties]);

  const handlePermanentDeleted = useCallback(() => {
    setShowPermanentDeleteDialog(false);
    setSelectedProperties([]);
    void fetchTrashedProperties();
    forceDataRefresh();
  }, [setSelectedProperties, fetchTrashedProperties, forceDataRefresh]);

  return {
    showTrash,
    trashCount,
    trashedProperties,
    loadingTrash,
    showPermanentDeleteDialog,
    setShowPermanentDeleteDialog,
    handleToggleTrash,
    handleTrashActionComplete,
    handleRestoreProperties,
    handlePermanentDeleteProperties,
    handlePermanentDeleted,
    fetchTrashedProperties,
  } as const;
}
