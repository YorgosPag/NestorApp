/**
 * =============================================================================
 * 🏢 ENTERPRISE: useEntityCodeSuggestion Hook (ADR-233)
 * =============================================================================
 *
 * Debounced hook that fetches a suggested entity code from the server
 * whenever the relevant form fields change.
 *
 * @see ADR-233 — Entity Coding System
 * @module hooks/useEntityCodeSuggestion
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { UnitType } from '@/types/unit';
import type { ParkingLocationZone } from '@/types/parking';

// =============================================================================
// TYPES
// =============================================================================

interface UseEntityCodeSuggestionParams {
  entityType: 'unit' | 'parking' | 'storage';
  buildingId: string;
  floorLevel: number | '';
  unitType?: UnitType | '';
  locationZone?: ParkingLocationZone | '';
  /** If true, the hook will not auto-fetch (user has overridden the code) */
  disabled?: boolean;
}

interface SuggestApiResponse {
  suggestedCode: string;
  sequence: number;
  buildingLetter: string;
  typeCode: string;
  floorCode: string;
}

interface UseEntityCodeSuggestionReturn {
  suggestedCode: string | null;
  isLoading: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

const DEBOUNCE_MS = 400;

export function useEntityCodeSuggestion({
  entityType,
  buildingId,
  floorLevel,
  unitType,
  locationZone,
  disabled = false,
}: UseEntityCodeSuggestionParams): UseEntityCodeSuggestionReturn {
  const [suggestedCode, setSuggestedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const fetchSuggestion = useCallback(async () => {
    // Cancel any in-flight request
    if (abortController.current) {
      abortController.current.abort();
    }

    // Must have buildingId at minimum
    if (!buildingId) {
      setSuggestedCode(null);
      return;
    }

    // For units, need unitType; for parking, locationZone is optional
    if (entityType === 'unit' && !unitType) {
      setSuggestedCode(null);
      return;
    }

    const controller = new AbortController();
    abortController.current = controller;

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        entityType,
        buildingId,
        floorLevel: String(floorLevel === '' ? 0 : floorLevel),
      });

      if (unitType) params.set('unitType', unitType);
      if (locationZone) params.set('locationZone', locationZone);

      const result = await apiClient.get<SuggestApiResponse>(
        `/api/entity-code/suggest?${params.toString()}`
      );

      // Only update if this request wasn't aborted
      if (!controller.signal.aborted && result?.suggestedCode) {
        setSuggestedCode(result.suggestedCode);
      }
    } catch {
      // Silently ignore errors (network, abort, etc.)
      if (!controller.signal.aborted) {
        setSuggestedCode(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [entityType, buildingId, floorLevel, unitType, locationZone]);

  // Debounced effect — triggers on dependency changes
  useEffect(() => {
    if (disabled) {
      setSuggestedCode(null);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(fetchSuggestion, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fetchSuggestion, disabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return { suggestedCode, isLoading };
}

export default useEntityCodeSuggestion;
