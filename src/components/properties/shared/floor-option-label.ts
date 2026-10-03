/**
 * @fileoverview Η ετικέτα ενός ορόφου **σε επιλογέα** (ADR-903 §6) — μία, για τους τρεις επιλογείς
 * (`FloorSelectField` · `FloorMultiSelectField` · `FloorSelectByBuilding`).
 *
 * Revit: η λίστα Levels δείχνει το **όνομα** του Level. Εδώ: το όνομα που έδωσε ο άνθρωπος, αλλιώς
 * η canonical ετικέτα από αριθμό + είδος (`useFloorLabel`) — ποτέ ωμό `{αριθμός} — {όνομα}` με κενό όνομα.
 * @module components/properties/shared/floor-option-label
 */

import type { FloorLabelInput } from '@/hooks/useFloorLabel';
import type { FloorOption } from './useFloorsByBuilding';

export function floorOptionLabel(
  floor: Pick<FloorOption, 'number' | 'name' | 'kind'>,
  floorLabel: (value: FloorLabelInput) => string,
): string {
  return floor.name.trim() || floorLabel({ number: floor.number, kind: floor.kind ?? null });
}
