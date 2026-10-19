/**
 * @fileoverview Οι επιλογές φίλτρων της οθόνης «Κτίρια» — **από τα ίδια τα κτίρια** (ADR-840 §7.6).
 * @module components/core/AdvancedFilters/hooks/building-filter-options
 *
 * Μέχρι 2026-10-19 ο πίνακας κτιρίων είχε ψεύτικα δείγματα (`project1/2/3`, «Αθήνα/Πάτρα…»,
 * «Εταιρεία Α/Β/Γ») και ο κριτής σύγκρινε πεδία που **δεν υπάρχουν** στο έγγραφο (`project`,
 * `location`, `company`) ⇒ κάθε επιλογή άδειαζε τη λίστα. Τώρα: έργο = `projectId`, τοποθεσία = `city`.
 * Το φίλτρο «Εταιρεία» αφαιρέθηκε: όλα τα κτίρια ενός χώρου ανήκουν στην ίδια εταιρεία και το
 * `linkedCompanyId` δεν γράφεται — μία επιλογή δεν είναι φίλτρο.
 */

import type { FilterOption } from '../types';
import { COMMON_FILTER_LABELS } from '../configs/shared';
import { namedOptions, verbatimOptions, withAllOption } from './filter-option-injection';

/** Ό,τι χρειάζονται οι επιλογές και ο κριτής από ένα κτίριο. */
export interface BuildingFilterSource {
  readonly projectId?: string | null;
  readonly city?: string | null;
}

const UNKNOWN_PROJECT_LABEL = 'filters.unknownProject';

/** Η πόλη του κτιρίου όπως τη συγκρίνει ο κριτής — κοινή για επιλογές και φιλτράρισμα. */
export function buildingCityOf(building: BuildingFilterSource): string | null {
  return building.city?.trim() || null;
}

/** Ταιριάζει το κτίριο στην επιλογή έργου/τοποθεσίας; (`'all'` ή κενό = χωρίς φίλτρο). */
export function matchesBuildingLocation(
  building: BuildingFilterSource,
  selection: { readonly project?: string | null; readonly location?: string | null },
): boolean {
  const { project, location } = selection;
  if (project && project !== 'all' && building.projectId !== project) return false;
  if (location && location !== 'all' && buildingCityOf(building) !== location) return false;
  return true;
}

/** Επιλογές «Έργο» + «Τοποθεσία», κλειδωμένες στο όνομα πεδίου του πίνακα. */
export function buildBuildingFilterOptions(
  buildings: readonly BuildingFilterSource[],
  projectName: (projectId: string) => string | null,
): Map<string, FilterOption[]> {
  const projectIds = Array.from(new Set(
    buildings.map(b => b.projectId).filter((id): id is string => typeof id === 'string' && id !== ''),
  ));
  return new Map<string, FilterOption[]>([
    ['project', withAllOption(COMMON_FILTER_LABELS.ALL_PROJECTS, namedOptions(projectIds, projectName, UNKNOWN_PROJECT_LABEL))],
    ['location', withAllOption(COMMON_FILTER_LABELS.ALL_LOCATIONS, verbatimOptions(buildings.map(buildingCityOf)))],
  ]);
}
