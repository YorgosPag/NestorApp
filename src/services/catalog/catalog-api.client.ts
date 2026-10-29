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
 * 🔑 **Οι αναγνώσεις δεν περνούν από εδώ**: η οθόνη ακούει απευθείας τη Firestore (`useCatalogCollection`) — **εκτός** από
 *    τις τιμές, που διαβάζονται μόνο από τις όψεις του διακομιστή (ADR-923 §5.11 «3δ» Ζ, `catalog-pricing-api.client`).
 * 🔑 Οι **ορισμοί** της τιμολόγησης (τιμοκατάλογος · ομάδες · αναθέσεις · συνθήκες) γράφονται όπως κάθε ορισμός, εδώ· οι
 *    **πράξεις** της έκδοσης (γραμμές · σπορά · δημοσίευση) ζουν στο `catalog-pricing-api.client`.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API, EXPECTED_REVISION_PARAM } from '@/subapps/catalog/catalog-routes';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import type { CatalogAttributeDefinition, StoredCatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogAttributeGroupDefinition } from '@/subapps/catalog/types/attribute-group';
import type { CatalogWire } from '@/subapps/catalog/types/catalog-record';
import type { CatalogCategoryDefinition, CatalogCategoryMappings } from '@/subapps/catalog/types/category';
import type { CatalogFamilyDefinition, StoredCatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import type { WorkspaceMeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import type { CatalogAssetInput } from '@/subapps/catalog/schema/zod/asset.schema';
import type { CatalogSettingsDefinition } from '@/subapps/catalog/types/catalog-settings';
import type { CatalogProductDefinition, CatalogProductModelDefinition } from '@/subapps/catalog/types/product';
import type { StoredCatalogProductDefinition, StoredCatalogProductModelDefinition } from '@/subapps/catalog/types/product-derived';
import type {
  RecomputeRequest,
  RecomputeResult,
  VariantBatch,
  VariantBatchResultOf,
} from '@/subapps/catalog/types/product-requests';
import type {
  CustomerAssignmentDefinition,
  CustomerGroupDefinition,
  DiscountConditionDefinition,
  DiscountGroupDefinition,
  PriceListDefinition,
} from '@/subapps/catalog/types/price-list';
import type {
  CustomerAssignmentWire,
  CustomerGroupWire,
  DiscountConditionWire,
  DiscountGroupWire,
  PriceListWire,
} from '@/subapps/catalog/types/pricing-views';
import type { LocalizedText } from '@/i18n/localized-text';

// ── Οι εγγραφές όπως τις δίνει ο γραφέας (σύρμα: χρονοσφραγίδες ISO) ─────────

export type AttributeRecord = CatalogWire<StoredCatalogAttributeDefinition>;
export type AttributeGroupRecord = CatalogWire<CatalogAttributeGroupDefinition>;
export type MeasurementFamilyRecord = CatalogWire<WorkspaceMeasurementFamilyDefinition>;
export type CategoryRecord = CatalogWire<CatalogCategoryDefinition>;
export type FamilyRecord = CatalogWire<StoredCatalogFamilyDefinition>;
export type AssetRecord = CatalogWire<CatalogAssetDefinition>;
/** Μοντέλο / υπο-μοντέλο (ADR-923 §5.10.2) — τα `derived` τα γράφει **μόνο** ο διακομιστής. */
export type ProductModelRecord = CatalogWire<StoredCatalogProductModelDefinition>;
/** SKU ή απλό προϊόν (`modelId: null`). */
export type ProductRecord = CatalogWire<StoredCatalogProductDefinition>;
export type CatalogSettingsRecord = CatalogWire<CatalogSettingsDefinition>;
export type VariantBatchResult = VariantBatchResultOf<ProductModelRecord, ProductRecord>;

/** Τα είδη που γράφονται ως **ολόκληρος ορισμός** (δημιουργία · αντικατάσταση · διαγραφή). */
export interface CatalogDefinitionKinds {
  readonly attribute: { readonly definition: CatalogAttributeDefinition; readonly record: AttributeRecord };
  readonly attributeGroup: { readonly definition: CatalogAttributeGroupDefinition; readonly record: AttributeGroupRecord };
  readonly measurementFamily: { readonly definition: WorkspaceMeasurementFamilyDefinition; readonly record: MeasurementFamilyRecord };
  readonly family: { readonly definition: CatalogFamilyDefinition; readonly record: FamilyRecord };
  /** Μέσο (ADR-923 §5.10 Δ9): ο ορισμός **χωρίς** `fileId` — το αρχείο το δένει **μόνο** η {@link attachCatalogAssetFile}. */
  readonly asset: { readonly definition: CatalogAssetInput; readonly record: AssetRecord };
  /** Μοντέλο: ο ορισμός **χωρίς** `derived` — τα παράγωγα τα υπολογίζει ο γραφέας του συνόλου. */
  readonly productModel: { readonly definition: CatalogProductModelDefinition; readonly record: ProductModelRecord };
  readonly product: { readonly definition: CatalogProductDefinition; readonly record: ProductRecord };
  // ── Τιμολόγηση (ADR-923 §5.11) — οι εγγραφές φτάνουν από τις όψεις του διακομιστή, ποτέ από τη Firestore ──
  readonly priceList: { readonly definition: PriceListDefinition; readonly record: PriceListWire };
  readonly discountGroup: { readonly definition: DiscountGroupDefinition; readonly record: DiscountGroupWire };
  readonly customerGroup: { readonly definition: CustomerGroupDefinition; readonly record: CustomerGroupWire };
  /** Ταυτότητα = ο συμβαλλόμενος (ντετερμινιστικό id στον διακομιστή, `pricingPartyKey`). */
  readonly customerAssignment: { readonly definition: CustomerAssignmentDefinition; readonly record: CustomerAssignmentWire };
  /** Τυχαίο id, προ-γεννημένο στον πελάτη και επαληθευμένο στον διακομιστή (Γ5). */
  readonly discountCondition: { readonly definition: DiscountConditionDefinition; readonly record: DiscountConditionWire };
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
  asset: CATALOG_API.assets,
  productModel: CATALOG_API.productModels,
  product: CATALOG_API.products,
  category: CATALOG_API.categories,
  priceList: CATALOG_API.priceLists,
  discountGroup: CATALOG_API.discountGroups,
  customerGroup: CATALOG_API.customerGroups,
  customerAssignment: CATALOG_API.customerAssignments,
  discountCondition: CATALOG_API.discountConditions,
};

/** `POST` — νέα οντότητα. Ο κωδικός γίνεται ταυτότητα (ντετερμινιστικό id στον διακομιστή). */
/** `id`: **μόνο** για είδη με τυχαίο id (SKU) — προ-γεννημένο στον πελάτη, ο διακομιστής το επαληθεύει (ADR-866 Β). */
export function createCatalogDefinition<K extends CatalogDefinitionKind>(kind: K, definition: DefinitionOf<K>, id?: string): Promise<RecordOf<K>> {
  return apiClient.post<RecordOf<K>>(ROUTES[kind].collection, id === undefined ? { definition } : { definition, id });
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

// ── Μέσα: το αρχείο δένεται με δική του πράξη (ADR-923 §5.10.3) ─────────────

/**
 * `POST …/assets/[id]/file` — δένει ένα **ήδη ανεβασμένο** `FileRecord` αυτού του μέσου (ή νέα έκδοση του αρχείου).
 * Ο διακομιστής μετρά το αντικείμενο, φτιάχνει τις αποδόσεις και κρίνει με το `judgeAssetFile`, την ίδια κρίση με
 * την οθόνη. Ιδεμπότητο: ίδιο `fileId` ⇒ καμία νέα αναθεώρηση.
 */
export function attachCatalogAssetFile(id: string, expectedRevision: number, fileId: string): Promise<AssetRecord> {
  return apiClient.post<AssetRecord>(CATALOG_API.assets.file(id), { expectedRevision, fileId });
}

// ── Προϊόντα: η δέσμη παραλλαγών · ρυθμίσεις · επανυπολογισμός (ADR-923 §5.10.2) ───────────

/** **Μία** συναλλαγή: όλες οι παραλλαγές της δέσμης ή καμία (CAS ανά παραλλαγή). */
export function saveCatalogVariants(modelId: string, batch: VariantBatch): Promise<VariantBatchResult> {
  return apiClient.put<VariantBatchResult>(CATALOG_API.productModels.variants(modelId), batch);
}

/** Ρυθμίσεις (singleton): το **πρώτο** αποθηκευμένο έγγραφο ζητά `expectedRevision: 0`. */
export function saveCatalogSettings(expectedRevision: number, definition: CatalogSettingsDefinition): Promise<CatalogSettingsRecord> {
  return apiClient.put<CatalogSettingsRecord>(CATALOG_API.settings, { expectedRevision, definition });
}

/** **Μία** σελίδα της εργασίας επανυπολογισμού — ο καλών συνεχίζει ως `nextCursor === null`. */
export function recomputeCatalogDerived(request: RecomputeRequest): Promise<RecomputeResult> {
  return apiClient.post<RecomputeResult>(CATALOG_API.recomputeDerived, request);
}
