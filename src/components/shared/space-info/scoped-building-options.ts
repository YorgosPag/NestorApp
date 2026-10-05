/**
 * @fileoverview **Οι επιλογές κτιρίου ενός στοιχείου που ζει μέσα σε έργο** (θέση · αποθήκη · μονάδα) — ADR-898 §21.6 Ε6.
 * @module components/shared/space-info/scoped-building-options
 *
 * Η ΜΙΑ ανάγνωση πίσω από κάθε επιλογέα κτιρίου: φέρνει τα κτίρια, και τα περνά από τον κανόνα του τομέα
 * (`lib/spaces/space-building-scope`) — τον ΙΔΙΟ που επιβάλλουν οι φρουροί του server:
 * - στοιχείο **με** έργο ⇒ μόνο τα κτίρια του έργου του·
 * - στοιχείο **χωρίς** έργο ⇒ όλα, ομαδοποιημένα ανά έργο.
 *
 * 🔴 Η αποτυχία **πετά** (οι δύο αναγνώσεις δεν καταπίνουν πια σφάλματα): ο `useEntityLink` τη δείχνει ως σφάλμα με
 *   επανάληψη, ποτέ ως άδεια λίστα.
 * ⚠️ Εξήχθη από το `useSpaceBuildingLink` όταν ο επιλογέας της **μονάδας** χρειάστηκε τον ίδιο κανόνα (Ε6-α): δεύτερο
 *   αντίγραφο θα φιλτράριζε κάποτε με άλλο κριτήριο από τον φρουρό.
 */

import { getProjectsList } from '@/components/building-management/building-services';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import {
  buildingOptionsForSpace,
  resolveSpaceProjectId,
  type ScopedBuilding,
  type SpaceBuildingAnchor,
} from '@/lib/spaces/space-building-scope';
import { getBuildingsList } from '@/services/properties.service';

export interface ScopedBuildingOptionsLabels {
  /** Ετικέτα της ομάδας «κτίρια χωρίς έργο» (μεταφρασμένη από τον καλούντα). */
  readonly noProjectGroup: string;
  readonly locale: string;
}

/** Ονόματα έργων μόνο όταν χρειάζονται: το στοιχείο με έργο δεν ομαδοποιεί, άρα δεν πληρώνει δεύτερη ανάγνωση. */
async function projectNamesFor(anchor: SpaceBuildingAnchor, buildings: readonly ScopedBuilding[]): Promise<Map<string, string>> {
  if (resolveSpaceProjectId(anchor, buildings) !== null) return new Map();
  return new Map((await getProjectsList()).map((project) => [project.id, project.name]));
}

export async function loadScopedBuildingOptions(
  anchor: SpaceBuildingAnchor,
  labels: ScopedBuildingOptionsLabels,
): Promise<EntityLinkOption[]> {
  const buildings = await getBuildingsList();
  return buildingOptionsForSpace({
    space: anchor,
    buildings,
    projectNames: await projectNamesFor(anchor, buildings),
    noProjectGroup: labels.noProjectGroup,
    locale: labels.locale,
  });
}
