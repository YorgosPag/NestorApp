'use client';

/**
 * @fileoverview **Οι κατόψεις ενός ακινήτου με τα σημεία λήψης** — για το πάνελ «πού τραβήχτηκε» του lightbox της
 * κεφαλίδας (ADR-897 · ADR-899 §4).
 * @module features/property-grid/hooks/usePropertyFloorplanSpots
 * @related lib/properties/property-floorplan-spots (ο καθαρός προσαρμογέας) · usePropertyFileRecords (η ανάγνωση)
 *
 * 🔑 **Ανάγνωση μόνο όταν χρειάζεται**: ο καλών περνά `enabled` = «άνοιξε το lightbox **και** κάποια φωτογραφία έχει
 *   σημείο». Η κεφαλίδα που απλώς φαίνεται δεν πληρώνει ερώτημα κατόψεων.
 * ⚠️ Αποτυχία ανάγνωσης ⇒ κανένα πάνελ (το lightbox μένει πλήρως λειτουργικό) + log από τον αναγνώστη — όχι σιωπή.
 */

import { useMemo } from 'react';

import { FILE_CATEGORIES } from '@/config/domain-constants';
import type { FloorplanSpotsEntry } from '@/lib/media/photo-floorplan-spots';
import {
  propertyFloorplanSpotsOf,
  type PropertyFloorplanDeclarationSource,
} from '@/lib/properties/property-floorplan-spots';
import type { PropertyPhoto } from '@/lib/properties/property-photos';

import { usePropertyFileRecords } from './usePropertyFileRecords';

export interface PropertyFloorplanSpotsSubject extends PropertyFloorplanDeclarationSource {
  readonly id: string;
}

const NO_ENTRIES: readonly FloorplanSpotsEntry[] = [];

export function usePropertyFloorplanSpots(
  property: PropertyFloorplanSpotsSubject,
  photos: readonly PropertyPhoto[],
  enabled: boolean,
): readonly FloorplanSpotsEntry[] {
  const files = usePropertyFileRecords({ propertyId: property.id, category: FILE_CATEGORIES.FLOORPLANS, enabled });
  const { publishedFloorplans, publishedPhotoCaptureSpots, publishedFloorplanNorth } = property;

  return useMemo(
    () => (files.data === null
      ? NO_ENTRIES
      : propertyFloorplanSpotsOf(photos, files.data, { publishedFloorplans, publishedPhotoCaptureSpots, publishedFloorplanNorth })),
    [files.data, photos, publishedFloorplans, publishedPhotoCaptureSpots, publishedFloorplanNorth],
  );
}
