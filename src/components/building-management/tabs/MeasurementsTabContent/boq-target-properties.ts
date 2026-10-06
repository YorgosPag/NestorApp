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
import { liveProperties } from '@/components/properties/shared/linked-retired-properties';

/**
 * @param allProperties **όλα** τα ακίνητα του κτιρίου, μαζί με τα αποσυρμένα (κάδος · αρχείο).
 *
 * 🔑 Δύο κανόνες, ανάλογα με το **πώς** φτάνει ένα ακίνητο στο εύρος (ADR-329 §3.9):
 *   - εύρος **συνόλου** (`building` · `common_areas` · `floor`): μόνο τα ζωντανά — ένα
 *     αποσυρμένο ακίνητο δεν παίρνει μερίδιο από κόστος που δεν το ονόμασε κανείς·
 *   - εύρος **ρητής αναφοράς** (`property` · `properties`): ό,τι ονομάστηκε **μένει**, ακόμη
 *     κι αν αρχειοθετήθηκε — αλλιώς το μερίδιό του θα μοιραζόταν σιωπηλά στα υπόλοιπα.
 */
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
      return liveProperties(allProperties);
    case 'floor':
      return linkedFloorId ? propertiesOnFloor(linkedFloorId, liveProperties(allProperties)) : [];
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
