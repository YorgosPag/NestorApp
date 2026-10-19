'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ ΕΓΧΥΤΗΣ ΔΥΝΑΜΙΚΩΝ ΕΠΙΛΟΓΩΝ** των φίλτρων ακινήτου.
 * @related ADR-840 §5 (Α3) · ADR-840 §7.6 · ADR-051 (κεντρικό σύστημα φίλτρων)
 * @module components/core/AdvancedFilters/hooks/usePropertyFiltersConfig
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ (ADR-840 Σ1)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο hook ήταν **καρφωμένος** σε δύο σημεία: στο `propertyListFiltersConfig` ως μοναδική
 * είσοδο, και στη σειρά `'secondary-filters'` ως μοναδικό σημείο εγγραφής. Άρα ό,τι
 * άλλο ζητούσε δυναμικές επιλογές **δεν μπορούσε να τον ζητήσει** (ADR-840 §4.1).
 *
 * 🔑 **Δεν γεννήθηκε δεύτερος εγχύτης — έγινε παραμετρικός ο υπάρχων.** Δύο αντίγραφα
 * αυτής της λογικής θα σήμαιναν δύο απαντήσεις στο *«ποια έργα υπάρχουν;»*.
 *
 * ⚠️ **Το πεδίο βρίσκεται με το ΟΝΟΜΑ του, σε ΟΠΟΙΑ σειρά κι αν ζει.**
 *
 * ⚠️ **`type` ΚΑΙ `propertyType` δέχονται την ίδια έγχυση, επίτηδες** (ADR-840 §4, §8 #2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΡΓΟ / ΚΤΙΡΙΟ / ΟΡΟΦΟΣ — ΤΑΥΤΟΤΗΤΑ + ΟΝΟΜΑ + ΚΑΤΑΡΡΑΚΤΗΣ (ADR-840 §7.6, 2026-10-15)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι επιλογές χτίζονταν από `p.project` / `p.building` — πεδία που **δεν υπάρχουν** στο έγγραφο
 * Firestore (μόνο `projectId` / `buildingId`) ⇒ τα dropdown έδειχναν ΜΟΝΟ «Όλα». Τώρα:
 * - `value` = **ταυτότητα** (τη συγκρίνει ο ένας κριτής `matchesPropertyLocation`)·
 * - `label` = **όνομα** από τον ένα επιλυτή `useHierarchyNames`, αυτούσιο (`verbatim`)·
 * - **καταρράκτης** (`locationChoices`): κτίρια μόνο του επιλεγμένου έργου, όροφοι μόνο του
 *   επιλεγμένου έργου+κτιρίου — γι' αυτό ο hook δέχεται και την τρέχουσα επιλογή.
 */

import { useMemo } from 'react';
import { propertyListFiltersConfig } from '../configs/propertyFiltersConfig';
import type { FilterOption, FilterPanelConfig } from '../types';
import { injectFilterOptions, namedOptions, withAllOption } from './filter-option-injection';
import { useHierarchyNames, type HierarchyNames } from '@/components/navigation/core/hooks/useHierarchyNames';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { locationChoices, type LocatedProperty, type LocationSelection } from '@/lib/properties/property-location';

/**
 * Ό,τι χρειάζεται ο εγχυτής από ένα ακίνητο — **ταυτότητες** θέσης + είδος. Δομικός τύπος, ώστε να τον
 * ταΐζει κάθε οθόνη (ακίνητα · πωλήσεις) με το δικό της μοντέλο, χωρίς cast (ADR-840 §7.9).
 */
export type FilterOptionSource = LocatedProperty & { readonly type?: string | null };

/** Τα ονόματα πεδίων που δέχονται έγχυση, ανά ερώτημα που απαντούν. */
const PROJECT_FIELD = 'project';
const BUILDING_FIELD = 'building';
const FLOOR_FIELD = 'floor';
/** Το ίδιο ερώτημα, δύο ονόματα — δες την επικεφαλίδα του αρχείου. */
const TYPE_FIELDS = ['type', 'propertyType'] as const;

/** Κλειδιά για ταυτότητα χωρίς (ακόμη) γνωστό όνομα — ποτέ η ωμή ταυτότητα στον άνθρωπο. */
const UNKNOWN_PROJECT_LABEL = 'filters.unknownProject';
const UNKNOWN_BUILDING_LABEL = 'filters.unknownBuilding';

const NO_SELECTION: LocationSelection = {};

/** Μη κενά αλφαριθμητικά, μοναδικά, ταξινομημένα — για το είδος (κλειδί λεξιλογίου). */
function distinctNames(values: readonly (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => v !== undefined && v !== null && v !== ''))).sort();
}

/** Οι επιλογές που προκύπτουν **από τα ίδια τα ακίνητα**, κλειδωμένες στο όνομα πεδίου. */
function buildOptionsByField(
  properties: readonly FilterOptionSource[],
  selection: LocationSelection,
  names: HierarchyNames,
  floorLabel: (floor: number) => string,
): Map<string, FilterOption[]> {
  const choices = locationChoices(properties, selection);
  const types = distinctNames(properties.map(p => p.type));

  const byField = new Map<string, FilterOption[]>([
    [PROJECT_FIELD, withAllOption('filters.allProjects', namedOptions(choices.projectIds, names.projectName, UNKNOWN_PROJECT_LABEL))],
    [BUILDING_FIELD, withAllOption('filters.allBuildings', namedOptions(choices.buildingIds, names.buildingName, UNKNOWN_BUILDING_LABEL))],
    // ⚠️ Το ισόγειο (0) επιβιώνει: ο `locationChoices` δεν κάνει ποτέ `filter(Boolean)`.
    [FLOOR_FIELD, withAllOption('filters.allFloors', choices.floors.map(f => ({ value: String(f), label: floorLabel(f), verbatim: true })))],
  ]);

  const typeOptions = withAllOption(
    'filters.allTypes',
    types.map(t => ({ value: t, label: `properties.types.${t}` }))
  );
  for (const field of TYPE_FIELDS) byField.set(field, typeOptions);

  return byField;
}

/**
 * @param properties Τα ακίνητα από τα οποία **προκύπτουν** οι επιλογές.
 * @param baseConfig Ποιον πίνακα διακοσμούμε. Προεπιλογή: το `propertyListFiltersConfig`.
 * @param selection Η τρέχουσα επιλογή έργου/κτιρίου — για τον καταρράκτη. Χωρίς αυτήν, όλα ανοιχτά.
 */
export function usePropertyFiltersConfig(
  properties: readonly FilterOptionSource[],
  baseConfig: FilterPanelConfig = propertyListFiltersConfig,
  selection: LocationSelection = NO_SELECTION,
): FilterPanelConfig {
  const names = useHierarchyNames();
  const floorLabel = useFloorLabel();
  const { project, building } = selection;

  return useMemo(() => {
    const optionsByField = buildOptionsByField(properties, { project, building }, names, floorLabel);

    return injectFilterOptions(baseConfig, optionsByField);
  }, [properties, baseConfig, project, building, names, floorLabel]);
}
