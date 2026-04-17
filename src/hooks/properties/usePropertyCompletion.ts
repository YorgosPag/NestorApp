/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Completion Hook (Composition Layer)
 * =============================================================================
 *
 * Συνθέτει την pure assessment function (`assessPropertyCompleteness`) με το
 * real-time media count hook (`usePropertyMediaCounts`) + dismissal state
 * persisted σε localStorage (per-user, per-device — αρκετό για V1).
 *
 * **Dismissal storage**: localStorage key
 *   `property-completion-meter:dismissed:v1:${userId}`
 * Lightweight — avoid Firestore round-trips για απλό UI toggle. Upgrade path
 * σε `EnterpriseUserPreferencesService.customSettings` αν ζητηθεί cross-device
 * sync σε μελλοντικό batch.
 *
 * **SSR safety**: όλα τα `localStorage` reads/writes guarded από `typeof
 * window !== 'undefined'`.
 *
 * @module hooks/properties/usePropertyCompletion
 * @enterprise ADR-287 Batch 28 — Completion Meter
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  assessPropertyCompleteness,
  type CompletionAssessment,
  type CompletionFormSlice,
} from '@/constants/property-completion';
import { usePropertyMediaCounts } from './usePropertyMediaCounts';

// =============================================================================
// CONSTANTS
// =============================================================================

const DISMISSAL_STORAGE_PREFIX = 'property-completion-meter:dismissed:v1';

// =============================================================================
// TYPES
// =============================================================================

export interface UsePropertyCompletionParams {
  /** Property ID (or `null` for inline-creation mode). */
  readonly propertyId: string | null | undefined;
  /** Current form-data slice (unsaved edits preferred over server state). */
  readonly formData: CompletionFormSlice;
  /** Level count for multi-level units (ADR-236). Defaults to 1. */
  readonly levelCount?: number;
}

export interface UsePropertyCompletionReturn {
  /** Full assessment output. */
  readonly assessment: CompletionAssessment;
  /** Loading state from media count subscriptions. */
  readonly isLoading: boolean;
  /** Error message from media subscriptions (null otherwise). */
  readonly error: string | null;
  /** `true` αν ο user έχει dismiss-άρει τον meter από localStorage. */
  readonly isDismissed: boolean;
  /** Toggle dismissal state + persist σε localStorage. */
  readonly setDismissed: (value: boolean) => void;
}

// =============================================================================
// LOCALSTORAGE HELPERS (SSR-safe)
// =============================================================================

function readDismissedFromStorage(userId: string | null): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    const raw = window.localStorage.getItem(`${DISMISSAL_STORAGE_PREFIX}:${userId}`);
    return raw === '1';
  } catch {
    return false;
  }
}

function writeDismissedToStorage(userId: string | null, value: boolean): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const key = `${DISMISSAL_STORAGE_PREFIX}:${userId}`;
    if (value) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable — silently skip (private browsing, quota)
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function usePropertyCompletion(
  params: UsePropertyCompletionParams,
): UsePropertyCompletionReturn {
  const { propertyId, formData, levelCount = 1 } = params;
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const { photos, floorplan, isLoading, error } = usePropertyMediaCounts({ propertyId });

  // Dismissal state synced with localStorage on mount + userId change
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  useEffect(() => {
    setIsDismissed(readDismissedFromStorage(userId));
  }, [userId]);

  const setDismissed = useCallback(
    (value: boolean) => {
      setIsDismissed(value);
      writeDismissedToStorage(userId, value);
    },
    [userId],
  );

  const assessment = useMemo(
    () =>
      assessPropertyCompleteness({
        formData,
        mediaCounts: { photos, floorplan },
        levelCount,
      }),
    [formData, photos, floorplan, levelCount],
  );

  return {
    assessment,
    isLoading,
    error,
    isDismissed,
    setDismissed,
  };
}
