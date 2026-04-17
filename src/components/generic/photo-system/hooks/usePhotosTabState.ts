'use client';

// ============================================================================
// USE PHOTOS TAB STATE - STATE MANAGEMENT HOOK
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Centralized state management for PhotosTabBase
//
// Supports two modes:
// 1. Internal state (uncontrolled) - manages own photos array
// 2. External state (controlled) - uses parent's state via props
//
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import type {
  Photo,
  PhotosTabEntityType,
  UsePhotosTabStateReturn,
} from '../config/photos-tab-types';

// 🏢 ADR-293 Phase 5 Batch 29: optional Firestore-fetched photos override
// the uncontrolled internal array — gives every mount an authoritative view
// of persisted photos instead of an empty-on-remount local state.

// =============================================================================
// HOOK PROPS
// =============================================================================

export interface UsePhotosTabStateProps {
  /** External photos array (for controlled mode) */
  externalPhotos?: Photo[];
  /** External setter (for controlled mode) */
  externalOnPhotosChange?: (photos: Photo[]) => void;
  /** Entity type for storage key */
  entityType: PhotosTabEntityType;
  /** Entity ID for storage key */
  entityId: string;
  /** Initial photos (for uncontrolled mode) */
  initialPhotos?: Photo[];
  /**
   * ADR-293 Phase 5 Batch 29 — Firestore-fetched photos. When provided in
   * uncontrolled mode, these win over the internal state array so refreshes
   * and remounts display the authoritative persisted list.
   */
  fetchedPhotos?: Photo[];
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * State management hook for PhotosTabBase
 *
 * Handles both controlled (form-integrated) and uncontrolled modes.
 *
 * @example
 * // Uncontrolled mode (internal state)
 * const state = usePhotosTabState({
 *   entityType: 'project',
 *   entityId: 'proj-123',
 * });
 *
 * @example
 * // Controlled mode (form integration)
 * const state = usePhotosTabState({
 *   entityType: 'contact',
 *   entityId: contact.id,
 *   externalPhotos: formData.photos,
 *   externalOnPhotosChange: (photos) => setFormData({ ...formData, photos }),
 * });
 */
export function usePhotosTabState({
  externalPhotos,
  externalOnPhotosChange,
  entityType,
  entityId,
  initialPhotos = [],
  fetchedPhotos,
}: UsePhotosTabStateProps): UsePhotosTabStateReturn {
  // ---------------------------------------------------------------------------
  // Determine if controlled or uncontrolled
  // ---------------------------------------------------------------------------
  const isControlled = externalPhotos !== undefined && externalOnPhotosChange !== undefined;

  // ---------------------------------------------------------------------------
  // Internal state (used when uncontrolled)
  // ---------------------------------------------------------------------------
  const [internalPhotos, setInternalPhotos] = useState<Photo[]>(initialPhotos);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  // ---------------------------------------------------------------------------
  // Unified photos getter
  // ADR-293 Phase 5 Batch 29: fetchedPhotos (Firestore subscription) takes
  // precedence in uncontrolled mode over the internal array so photos
  // survive remounts / refreshes without a manual refetch.
  // ---------------------------------------------------------------------------
  const photos = useMemo(() => {
    if (isControlled) return externalPhotos ?? [];
    if (fetchedPhotos !== undefined) return fetchedPhotos;
    return internalPhotos;
  }, [isControlled, externalPhotos, fetchedPhotos, internalPhotos]);

  // ---------------------------------------------------------------------------
  // Unified photos setter
  // ---------------------------------------------------------------------------
  const setPhotos = useCallback(
    (photosOrUpdater: Photo[] | ((prev: Photo[]) => Photo[])) => {
      if (isControlled && externalOnPhotosChange) {
        // Controlled mode: call external setter
        if (typeof photosOrUpdater === 'function') {
          const newPhotos = photosOrUpdater(externalPhotos ?? []);
          externalOnPhotosChange(newPhotos);
        } else {
          externalOnPhotosChange(photosOrUpdater);
        }
      } else {
        // Uncontrolled mode: update internal state
        setInternalPhotos(photosOrUpdater);
      }
    },
    [isControlled, externalOnPhotosChange, externalPhotos]
  );

  // ---------------------------------------------------------------------------
  // Add photo helper
  // ---------------------------------------------------------------------------
  const addPhoto = useCallback(
    (photo: Photo) => {
      setPhotos((prev) => [...prev, photo]);
    },
    [setPhotos]
  );

  // ---------------------------------------------------------------------------
  // Remove photo helper
  // ---------------------------------------------------------------------------
  const removePhoto = useCallback(
    (photoId: string) => {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    },
    [setPhotos]
  );

  // ---------------------------------------------------------------------------
  // Return unified API
  // ---------------------------------------------------------------------------
  return {
    photos,
    setPhotos,
    addPhoto,
    removePhoto,
    currentFile,
    setCurrentFile,
    isControlled,
  };
}

export default usePhotosTabState;
