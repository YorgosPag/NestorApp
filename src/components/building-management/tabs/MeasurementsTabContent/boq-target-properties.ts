/**
 * Target-properties resolver for BOQ scope (ADR-329)
 *
 * Returns the ordered list of properties affected by a given BOQ scope —
 * used by Cost Allocation panel and validation.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/boq-target-properties
 * @see ADR-329 §3.1.1, §3.7.1
 */

import type { Property } from '@/types/property';
import type { BOQScope } from '@/types/boq';
import { propertiesOnFloor } from '@/lib/properties/floor-helpers';

export function resolveTargetProperties(
  scope: BOQScope,
  linkedFloorId: string,
  linkedUnitId: string,
  linkedUnitIds: string[],
  allProperties: Property[],
): Property[] {
  switch (scope) {
    case 'building':
    case 'common_areas':
      return allProperties;
    case 'floor':
      return linkedFloorId ? propertiesOnFloor(linkedFloorId, allProperties) : [];
    case 'property': {
      const found = allProperties.find((p) => p.id === linkedUnitId);
      return found ? [found] : [];
    }
    case 'properties': {
      const set = new Set(linkedUnitIds);
      return allProperties.filter((p) => set.has(p.id));
    }
  }
}
