/**
 * @fileoverview **Ο κριτής περιοχής των γεννητόρων** — τα όρια του ADR-883 διαβασμένα από τον δίσκο.
 * @related ADR-883 · ADR-890 Φ0 (`lib/geo/admin-area-of-point.ts`, ο κριτής) · `services/places/admin-boundaries.reader.ts`
 *   (η ίδια πηγή για τον server) · ADR-889 §10 (πρώτος καταναλωτής: ζώνες αντικειμενικών αξιών)
 *
 * 🔑 **Ίδια αρχεία, ίδιοι αναγνώστες σχήματος, ίδια ιεραρχία** (`adminAreaChildrenIndex`) με τον server — μόνο η
 * μεταφορά διαφέρει (fs αντί `createServerJsonFile`, που είναι `server-only`). Έτσι μια ζώνη και μια αγγελία στο ίδιο
 * σημείο καταλήγουν στην **ίδια** Δημοτική Ενότητα.
 *
 * ⚠️ Απαιτεί **ήδη χτισμένα** όρια (`npm run build:admin-boundaries`)· όριο που λείπει = σφάλμα, όχι «έξω».
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ADMIN_AREA_INDEX_FILE,
  ADMIN_AREA_ROOT_KEY,
  adminAreaChildrenIndex,
  readAdminAreaIndex,
} from '../../../src/lib/geo/admin-area-index-file';
import type { AdminAreaLookup } from '../../../src/lib/geo/admin-area-of-point';
import {
  ADMIN_BOUNDARIES_DIR,
  adminBoundaryFileName,
  adminBoundaryRegion,
  readAdminBoundary,
} from '../../../src/lib/geo/admin-boundary-file';
import type { GeoRegion } from '../../../src/types/geo/coordinates';

/** Όλα τα όρια που ανοίγει η κάθοδος κρατιούνται στη μνήμη: ο γεννήτορας τα ξαναζητά χιλιάδες φορές. */
export function createFsAdminAreaLookup(repoRoot: string): AdminAreaLookup {
  const publicDir = join(repoRoot, 'public');
  const areas = readAdminAreaIndex(JSON.parse(readFileSync(join(publicDir, ADMIN_AREA_INDEX_FILE), 'utf8')));
  const children = adminAreaChildrenIndex(areas);
  const regions = new Map<string, GeoRegion>();

  const regionOf = (adminId: string): GeoRegion => {
    const cached = regions.get(adminId);
    if (cached !== undefined) return cached;
    const path = join(publicDir, ADMIN_BOUNDARIES_DIR, adminBoundaryFileName(adminId));
    const boundary = readAdminBoundary(JSON.parse(readFileSync(path, 'utf8')), adminId);
    if (boundary === null) throw new Error(`όριο ${adminId}: άκυρο αρχείο — τρέξε build:admin-boundaries`);
    const region = adminBoundaryRegion(boundary);
    regions.set(adminId, region);
    return region;
  };

  return {
    childrenOf: (parentId) => children.get(parentId ?? ADMIN_AREA_ROOT_KEY) ?? [],
    regionOf: async (adminId) => regionOf(adminId),
  };
}
