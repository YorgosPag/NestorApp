/**
 * =============================================================================
 * usePropertyFormSync — ADR-287 Batch 23
 * =============================================================================
 *
 * React hook that keeps `PropertyFieldsFormData` in sync with the server
 * `Property` WITHOUT clobbering local unsaved edits. On every `property`
 * change:
 *
 *  1. If the document `id` changed → card switch → full reset to server state
 *  2. Otherwise → diff current server snapshot against last server snapshot
 *     and only patch fields that the server actually changed. Fields the
 *     user edited locally stay intact because they are not in the patch.
 *
 * Replaces the naive `useEffect(() => setFormData({...property}), [property])`
 * which was overwriting 20+ unsaved user edits on every auto-save round-trip.
 *
 * @module hooks/properties/usePropertyFormSync
 * @since ADR-287 Batch 23
 */

'use client';

import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Property } from '@/types/property-viewer';
import type { PropertyFieldsFormData } from '@/features/property-details/components/property-fields-form-types';
import {
  buildFormDataFromProperty,
  diffServerSnapshot,
  type PropertyServerSnapshot,
} from '@/services/property/property-form-sync';

export function usePropertyFormSync(
  property: Property,
  setFormData: Dispatch<SetStateAction<PropertyFieldsFormData>>,
): void {
  const prevPropertyIdRef = useRef<string>(property.id);
  const prevServerSnapshotRef = useRef<PropertyServerSnapshot>(
    buildFormDataFromProperty(property),
  );

  useEffect(() => {
    if (property.id !== prevPropertyIdRef.current) {
      const snapshot = buildFormDataFromProperty(property);
      prevPropertyIdRef.current = property.id;
      prevServerSnapshotRef.current = snapshot;
      setFormData(snapshot);
      return;
    }

    const nextSnapshot = buildFormDataFromProperty(property);
    const patch = diffServerSnapshot(prevServerSnapshotRef.current, nextSnapshot);
    prevServerSnapshotRef.current = nextSnapshot;

    if (Object.keys(patch).length > 0) {
      setFormData(prev => ({ ...prev, ...patch }));
    }
  }, [property, setFormData]);
}
