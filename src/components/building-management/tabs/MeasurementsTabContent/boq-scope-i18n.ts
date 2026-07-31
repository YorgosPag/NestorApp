/**
 * boq-scope-i18n — Αντιστοίχιση εύρους BOQ → τμήμα κλειδιού i18n (SSoT)
 *
 * Οι τιμές του τύπου `BOQScope` είναι snake_case (`common_areas`), ενώ τα
 * κλειδιά στο `building-tabs.json` είναι camelCase (`commonAreas`). Η μετάφραση
 * ανάμεσά τους ζούσε σε **τρία** αντίγραφα: `switch` + inline ternary στο
 * `BOQEditorScopeSection.tsx` και χειρόγραφη λίστα `<SelectItem>` στο
 * `BOQFilterBar.tsx`. Εδώ είναι μία (N.0.2).
 *
 * ⚠️ Ο τύπος `Record<BOQScope, string>` είναι σκόπιμος: νέο εύρος στον τύπο
 * σπάει **εδώ** τη μεταγλώττιση, όπως και στο `BOQ_SCOPE_PRESENCE` του
 * `types/boq/boq.ts`. Καμία λίστα δεν μένει πίσω σιωπηλά.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/boq-scope-i18n
 * @see ADR-329 §3.1 (5 επίπεδα εύρους)
 */

import type { BOQScope } from '@/types/boq';

const SCOPE_KEY_SEGMENT: Readonly<Record<BOQScope, string>> = {
  building: 'building',
  common_areas: 'commonAreas',
  floor: 'floor',
  property: 'property',
  properties: 'properties',
};

/**
 * Τμήμα κλειδιού i18n για ένα εύρος — π.χ. `tabs.measurements.scope.commonAreas`
 * ή `tabs.measurements.scope.tooltips.commonAreas`.
 */
export function boqScopeKeySegment(scope: BOQScope): string {
  return SCOPE_KEY_SEGMENT[scope];
}
