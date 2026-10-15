'use client';

/**
 * @fileoverview **«Έργο • Κτίριο • Όροφος»** ενός ακινήτου — η μία γραμμή τοποθεσίας των καρτών.
 * @related ADR-840 §7.6 · ADR-903 (ετικέτα ορόφου)
 * @module hooks/usePropertyLocationLine
 *
 * Ονόματα από τον **ένα** επιλυτή (`useHierarchyNames`, με ταυτότητα), όροφος από το `useFloorLabel`, ένωση από
 * το `joinLocationParts`. Πριν: `{property.project} • {property.building} • …` — πεδία που **δεν υπάρχουν** στο
 * έγγραφο ⇒ «• • 1ος Όροφος» σε κάθε κάρτα.
 */

import { useCallback } from 'react';
import { useHierarchyNames } from '@/components/navigation/core/hooks/useHierarchyNames';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { floorKeyOf, joinLocationParts, type LocatedProperty } from '@/lib/properties/property-location';

export function usePropertyLocationLine(): (property: LocatedProperty) => string {
  const { projectName, buildingName } = useHierarchyNames();
  const floorLabel = useFloorLabel();

  return useCallback(
    (property: LocatedProperty) =>
      joinLocationParts([
        projectName(property.projectId),
        buildingName(property.buildingId),
        floorKeyOf(property) !== null ? floorLabel(property.floor as number) : null,
      ]),
    [projectName, buildingName, floorLabel],
  );
}
