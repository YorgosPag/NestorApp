/**
 * **Τι επιτρέπεται να γράψει ο πελάτης σε ένα κτίριο** (ADR-829 §7.1) — η μία λευκή λίστα της δημιουργίας και της ενημέρωσης.
 *
 * 🔴 Ο `PATCH /api/buildings` έκανε cast το σώμα και φίλτραρε μόνο το `companyId`, ενώ ο `POST` είχε `.passthrough()`:
 * περνούσε κάθε πεδίο (`createdBy` · `_v` · `status: 'deleted'`, δηλαδή κάδος χωρίς έλεγχο εξαρτήσεων). Το έκρυβε ότι
 * κανένας ρόλος εταιρείας δεν είχε το δικαίωμα. Η πρακτική είναι των API των μεγάλων: **άγνωστο πεδίο = 400**, όχι σιωπή.
 *
 * 🔑 Η λίστα είναι `Record<keyof BuildingUpdatePayload, true>`: νέο πεδίο στο σχήμα καλωδίου χωρίς γραμμή εδώ δεν
 * μεταγλωττίζεται, και γραμμή χωρίς πεδίο επίσης. Ένας ορισμός του «τι είναι κτίριο» (`types/building/mutation-payloads`).
 *
 * @module app/api/buildings/_shared/building-write-fields
 */

import { ApiError } from '@/lib/api/api-error-types';
import { TRASHED_STATUS } from '@/lib/firestore/trashed-status';
import type { BuildingUpdatePayload } from '@/types/building/mutation-payloads';

const BUILDING_WRITABLE_FIELDS = {
  code: true, name: true, description: true, totalArea: true, builtArea: true, floors: true, units: true,
  totalValue: true, startDate: true, completionDate: true, constructionYear: true, completionDeclaration: true,
  address: true, city: true, status: true, projectId: true, linkedCompanyId: true, linkedCompanyName: true,
  company: true, addresses: true, relocateAddressIds: true, category: true, placeRef: true, climateZone: true,
  hasFoundation: true, foundationDepth: true, foundationDepthAuto: true, gradeDropBelowBase: true,
  hasStairPenthouse: true, stairPenthouseHeight: true, structuralSettings: true,
} as const satisfies Record<keyof BuildingUpdatePayload, true>;

/** Το `companyId` ταξιδεύει στη γέννηση και το αγνοεί ο γραφέας: ο ενοικιαστής βγαίνει από τον γονιό ή τον καλούντα. */
const BIRTH_ONLY_FIELDS: ReadonlySet<string> = new Set(['companyId']);

/** Τα πεδία του σώματος που **δεν** γράφονται, με σταθερή σειρά. Καθαρή, για να κρίνεται σε άγκυρα. */
export function unwritableBuildingFields(body: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.keys(body).filter((field) => !(field in BUILDING_WRITABLE_FIELDS) && !BIRTH_ONLY_FIELDS.has(field)).sort();
}

/**
 * @throws {ApiError} 400 σε άγνωστο πεδίο, ή σε `status` κάδου: στον κάδο πηγαίνει **μόνο** το `DELETE`, με τον έλεγχο
 *   εξαρτήσεων και το ίχνος του.
 */
export function assertBuildingFieldsWritable(body: Readonly<Record<string, unknown>>): void {
  const unwritable = unwritableBuildingFields(body);
  if (unwritable.length > 0) throw new ApiError(400, `Fields not writable: ${unwritable.join(', ')}`);
  if (body.status === TRASHED_STATUS) throw new ApiError(400, 'Use DELETE to move a building to trash');
}
