/**
 * @fileoverview **Οι εγγραφές του σχήματος καταλόγου, όπως τις στέλνει η οθόνη** — μεταφορά, όχι κρίση (ADR-923 §5.9).
 * @related subapps/catalog/catalog-routes.ts (οι διαδρομές) · app/api/catalog/** (ο αυθεντικός γραφέας) ·
 *   services/catalog/catalog-failure.ts (η ερμηνεία της άρνησης)
 * @module services/catalog/catalog-api.client
 *
 * 🔑 **Καμία κρίση εδώ.** Η επικύρωση τρέχει στην οθόνη με τις **ίδιες** συναρτήσεις του πυρήνα (άμεση ανάδραση) και
 *    ξανά στον γραφέα (αυθεντία). Αυτό το αρχείο μόνο **μεταφέρει**: διαδρομή, ρήμα, σώμα — ένα σημείο ανά πράξη.
 * 🔑 **`apiClient`, όχι `fetch`**: στέλνει `Idempotency-Key` (CHECK 3.92), κουβαλά τον χώρο, κρατά το σώμα της
 *    άρνησης (`errorBody`) ώστε τα ευρήματα να φτάσουν δίπλα στο πεδίο τους.
 * 🔑 **Οι αναγνώσεις δεν περνούν από εδώ**: η οθόνη ακούει απευθείας τη Firestore (`useCatalogCollection`).
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API, EXPECTED_REVISION_PARAM } from '@/subapps/catalog/catalog-routes';
import type { CatalogAttributeDefinition, StoredCatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogAttributeGroupDefinition } from '@/subapps/catalog/types/attribute-group';
import type { CatalogWire } from '@/subapps/catalog/types/catalog-record';
import type { CatalogCategoryDefinition, CatalogCategoryMappings } from '@/subapps/catalog/types/category';
import type { CatalogFamilyDefinition, StoredCatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import type { WorkspaceMeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import type { LocalizedText } from '@/i18n/localized-text';

// ── Οι εγγραφές όπως τις δίνει ο γραφέας (σύρμα: χρονοσφραγίδες ISO) ─────────

export type AttributeRecord = CatalogWire<StoredCatalogAttributeDefinition>;
export type AttributeGroupRecord = CatalogWire<CatalogAttributeGroupDefinition>;
export type MeasurementFamilyRecord = CatalogWire<WorkspaceMeasurementFamilyDefinition>;
export type CategoryRecord = CatalogWire<CatalogCategoryDefinition>;
export type FamilyRecord = CatalogWire<StoredCatalogFamilyDefinition>;

/** Τα είδη που γράφονται ως **ολόκληρος ορισμός** (δημιουργία · αντικατάσταση · διαγραφή). */
export interface CatalogDefinitionKinds {
  readonly attribute: { readonly definition: CatalogAttributeDefinition; readonly record: AttributeRecord };
  readonly attributeGroup: { readonly definition: CatalogAttributeGroupDefinition; readonly record: AttributeGroupRecord };
  readonly measurementFamily: { readonly definition: WorkspaceMeasurementFamilyDefinition; readonly record: MeasurementFamilyRecord };
  readonly family: { readonly definition: CatalogFamilyDefinition; readonly record: FamilyRecord };
}

export type CatalogDefinitionKind = keyof CatalogDefinitionKinds;
export type CatalogEntityKind = CatalogDefinitionKind | 'category';

export type DefinitionOf<K extends CatalogDefinitionKind> = CatalogDefinitionKinds[K]['definition'];
export type RecordOf<K extends CatalogDefinitionKind> = CatalogDefinitionKinds[K]['record'];

/** Είδος → διαδρομές. `Record<…>` ⇒ νέο είδος χωρίς διαδρομή δεν μεταγλωττίζεται. */
const ROUTES: Readonly<Record<CatalogEntityKind, { readonly collection: string; readonly item: (id: string) => string }>> = {
  attribute: CATALOG_API.attributes,
  attributeGroup: CATALOG_API.attributeGroups,
  measurementFamily: CATALOG_API.measurementFamilies,
  family: CATALOG_API.families,
  category: CATALOG_API.categories,
};

/** `POST` — νέα οντότητα. Ο κωδικός γίνεται ταυτότητα (ντετερμινιστικό id στον διακομιστή). */
export function createCatalogDefinition<K extends CatalogDefinitionKind>(kind: K, definition: DefinitionOf<K>): Promise<RecordOf<K>> {
  return apiClient.post<RecordOf<K>>(ROUTES[kind].collection, { definition });
}

/** `PUT` — αντικατάσταση ορισμού, με την αναθεώρηση που **διάβασε** ο πελάτης (CAS). */
export function replaceCatalogDefinition<K extends CatalogDefinitionKind>(
  kind: K,
  id: string,
  expectedRevision: number,
  definition: DefinitionOf<K>,
): Promise<RecordOf<K>> {
  return apiClient.put<RecordOf<K>>(ROUTES[kind].item(id), { expectedRevision, definition });
}

/** `DELETE …?expectedRevision=N` — το ένα σημείο που χτίζει τη διεύθυνση της διαγραφής. */
function deleteAt<T>(kind: CatalogEntityKind, id: string, expectedRevision: number): Promise<T> {
  const query = new URLSearchParams({ [EXPECTED_REVISION_PARAM]: String(expectedRevision) });
  return apiClient.delete<T>(`${ROUTES[kind].item(id)}?${query.toString()}`);
}

/**
 * Soft delete ορισμού. Ο γραφέας αρνείται αν η οντότητα χρησιμοποιείται, και επιστρέφει την εγγραφή **όπως έμεινε**
 * (`isDeleted: true`) — η οθόνη τη συμφιλιώνει με το στιγμιότυπο.
 */
export function deleteCatalogDefinition<K extends CatalogDefinitionKind>(kind: K, id: string, expectedRevision: number): Promise<RecordOf<K>> {
  return deleteAt<RecordOf<K>>(kind, id, expectedRevision);
}

// ── Κατηγορίες: δομή δέντρου ⇒ δικές τους πράξεις ────────────────────────────

export interface CreateCategoryInput {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly parentId: string | null;
  readonly orderKey: string;
  readonly mappings: CatalogCategoryMappings;
}

export function createCatalogCategory(input: CreateCategoryInput): Promise<CategoryRecord> {
  return apiClient.post<CategoryRecord>(CATALOG_API.categories.collection, { ...input });
}

/** Μετονομασία / αντιστοιχίσεις — ο γονέας και η θέση αλλάζουν **μόνο** με `moveCatalogCategory`. */
export function updateCatalogCategory(
  id: string,
  expectedRevision: number,
  patch: { readonly labels: LocalizedText; readonly mappings: CatalogCategoryMappings },
): Promise<CategoryRecord> {
  return apiClient.put<CategoryRecord>(CATALOG_API.categories.item(id), { expectedRevision, ...patch });
}

/** Soft delete κατηγορίας — μόνο φύλλου (ο γραφέας αρνείται κατηγορία με παιδιά). */
export function deleteCatalogCategory(id: string, expectedRevision: number): Promise<CategoryRecord> {
  return deleteAt<CategoryRecord>('category', id, expectedRevision);
}

/** Νέος γονέας και/ή θέση — ολόκληρο το υποδέντρο σε **μία** συναλλαγή στον διακομιστή. */
export function moveCatalogCategory(
  id: string,
  expectedRevision: number,
  target: { readonly parentId: string | null; readonly orderKey: string },
): Promise<CategoryRecord> {
  return apiClient.post<CategoryRecord>(CATALOG_API.categories.move(id), { expectedRevision, ...target });
}
