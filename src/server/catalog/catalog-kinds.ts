/**
 * Τα **είδη** οντοτήτων του καταλόγου (ADR-923 §5.9 · §5.10) σε **έναν** πίνακα: συλλογή, τύπος ιστορικού,
 * ταυτότητα, παρακολουθούμενα πεδία, προβολή για το ιστορικό. Η μηχανή αποθήκευσης δεν ξέρει τίποτα άλλο για το
 * καθένα — νέο είδος = νέα γραμμή εδώ, και ο `Record` σπάει τη μεταγλώττιση αν λείψει κάποιο πεδίο.
 *
 * 🔑 **Τρεις τρόποι ταυτότητας**, κλειστό σύνολο:
 *   - `code` — ντετερμινιστικό από `(χώρος, κωδικός)` (σχήμα · μοντέλα · μέσα): η μοναδικότητα του κωδικού είναι δομική.
 *     Ο ίδιος τρόπος δέχεται και **φυσικό κλειδί** (ADR-923 §5.11 «3β» Β4): έκδοση = λίστα + αριθμός · γραμμή = έκδοση +
 *     υποκείμενο · ανάθεση = συμβαλλόμενος (`pricing/pricing-keys.ts`) — ίδια μηχανή, ίδια δομική μοναδικότητα·
 *   - `random` — το **SKU** (Δ3): ο κωδικός του είναι ιδιότητα με κράτηση, όχι ταυτότητα· η **συνθήκη έκπτωσης** (καμία
 *     φυσική ταυτότητα: ίδιο κοινό σε άλλη περίοδο είναι νόμιμο — την επικάλυψη τη φυλά η υποδοχή ασάφειας)·
 *   - `singleton` — οι ρυθμίσεις: **ένα** έγγραφο ανά χώρο.
 * @module server/catalog/catalog-kinds
 */

import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuditEntityType } from '@/config/audit-entity-registry';
import {
  CATALOG_ASSET_TRACKED_FIELDS,
  CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS,
  CATALOG_ATTRIBUTE_TRACKED_FIELDS,
  CATALOG_CATEGORY_TRACKED_FIELDS,
  CATALOG_FAMILY_TRACKED_FIELDS,
  CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS,
  CATALOG_PRODUCT_MODEL_TRACKED_FIELDS,
  CATALOG_PRODUCT_TRACKED_FIELDS,
  CATALOG_SETTINGS_TRACKED_FIELDS,
  CATALOG_PRICE_LIST_TRACKED_FIELDS,
  CATALOG_PRICE_LIST_VERSION_TRACKED_FIELDS,
  CATALOG_PRICE_LIST_LINE_TRACKED_FIELDS,
  CATALOG_DISCOUNT_GROUP_TRACKED_FIELDS,
  CATALOG_CUSTOMER_GROUP_TRACKED_FIELDS,
  CATALOG_CUSTOMER_ASSIGNMENT_TRACKED_FIELDS,
  CATALOG_DISCOUNT_CONDITION_TRACKED_FIELDS,
  CATALOG_VALUES_AUDIT_FIELD,
  catalogValuesAuditRows,
} from '@/config/audit-tracked-fields-catalog';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
  generateCatalogProductId,
  generateDeterministicCatalogAssetId,
  generateDeterministicCatalogAttributeGroupId,
  generateDeterministicCatalogAttributeId,
  generateDeterministicCatalogCategoryId,
  generateDeterministicCatalogFamilyId,
  generateDeterministicCatalogMeasurementFamilyId,
  generateDeterministicCatalogProductModelId,
  generateDeterministicCatalogSettingsId,
  generateDeterministicCatalogPriceListId,
  generateDeterministicCatalogPriceListVersionId,
  generateDeterministicCatalogPriceListLineId,
  generateDeterministicCatalogDiscountGroupId,
  generateDeterministicCatalogCustomerGroupId,
  generateDeterministicCatalogCustomerAssignmentId,
  generateCatalogDiscountConditionId,
} from '@/services/enterprise-id.service';

export const CATALOG_KINDS = [
  'attribute',
  'attributeGroup',
  'measurementFamily',
  'category',
  'family',
  'productModel',
  'product',
  'asset',
  'settings',
  // ── Φάση 3β (ADR-923 §5.11) ──
  'priceList',
  'priceListVersion',
  'priceListLine',
  'discountGroup',
  'customerGroup',
  'customerAssignment',
  'discountCondition',
] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export type CatalogKindIdentity =
  | { readonly mode: 'code'; readonly idOf: (companyId: string, code: string) => string }
  | { readonly mode: 'random'; readonly prefix: EnterpriseIdPrefix; readonly mint: () => string }
  | { readonly mode: 'singleton'; readonly idOf: (companyId: string) => string };

export interface CatalogKindSpec {
  readonly collection: string;
  readonly entityType: AuditEntityType;
  readonly identity: CatalogKindIdentity;
  readonly trackedFields: Record<string, TrackedFieldDef>;
  /** Προβολή της εγγραφής **πριν** από τη σύγκριση του ιστορικού (π.χ. `values` ανά ιδιότητα). */
  readonly auditView?: (record: Readonly<Record<string, unknown>>) => Record<string, unknown>;
  /** Το όνομα στο ιστορικό για είδη **χωρίς** κωδικό (έκδοση «3», γραμμή = υποκείμενο). Λείπει ⇒ ο κωδικός. */
  readonly auditName?: (record: Readonly<Record<string, unknown>>) => string | null;
}

const byCode = (idOf: (companyId: string, code: string) => string): CatalogKindIdentity => ({ mode: 'code', idOf });

/** Ένα πεδίο κειμένου ή αριθμού (ή παράγωγου) ως όνομα ιστορικού. */
const nameFrom = (read: (record: Readonly<Record<string, unknown>>) => unknown) => (record: Readonly<Record<string, unknown>>) => {
  const value = read(record);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
};
const derivedOf = (record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  record.derived !== null && typeof record.derived === 'object' ? (record.derived as Readonly<Record<string, unknown>>) : {};

/** Ο χάρτης `values` ως συλλογή ανά ιδιότητα — ό,τι συγκρίνει το ιστορικό (ADR-923 §5.10 Θωράκιση 6). */
const valuesPerAttribute = (record: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  ...record,
  [CATALOG_VALUES_AUDIT_FIELD]: catalogValuesAuditRows(record[CATALOG_VALUES_AUDIT_FIELD]),
});

export const CATALOG_KIND_SPECS: Readonly<Record<CatalogKind, CatalogKindSpec>> = {
  attribute: {
    collection: COLLECTIONS.CATALOG_ATTRIBUTES,
    entityType: 'catalog_attribute',
    identity: byCode(generateDeterministicCatalogAttributeId),
    trackedFields: CATALOG_ATTRIBUTE_TRACKED_FIELDS,
  },
  attributeGroup: {
    collection: COLLECTIONS.CATALOG_ATTRIBUTE_GROUPS,
    entityType: 'catalog_attribute_group',
    identity: byCode(generateDeterministicCatalogAttributeGroupId),
    trackedFields: CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS,
  },
  measurementFamily: {
    collection: COLLECTIONS.CATALOG_MEASUREMENT_FAMILIES,
    entityType: 'catalog_measurement_family',
    identity: byCode(generateDeterministicCatalogMeasurementFamilyId),
    trackedFields: CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS,
  },
  category: {
    collection: COLLECTIONS.CATALOG_CATEGORIES,
    entityType: 'catalog_category',
    identity: byCode(generateDeterministicCatalogCategoryId),
    trackedFields: CATALOG_CATEGORY_TRACKED_FIELDS,
  },
  family: {
    collection: COLLECTIONS.CATALOG_FAMILIES,
    entityType: 'catalog_family',
    identity: byCode(generateDeterministicCatalogFamilyId),
    trackedFields: CATALOG_FAMILY_TRACKED_FIELDS,
  },
  productModel: {
    collection: COLLECTIONS.CATALOG_PRODUCT_MODELS,
    entityType: 'catalog_product_model',
    identity: byCode(generateDeterministicCatalogProductModelId),
    trackedFields: CATALOG_PRODUCT_MODEL_TRACKED_FIELDS,
    auditView: valuesPerAttribute,
  },
  product: {
    collection: COLLECTIONS.CATALOG_PRODUCTS,
    entityType: 'catalog_product',
    identity: { mode: 'random', prefix: ENTERPRISE_ID_PREFIXES.CATALOG_PRODUCT, mint: generateCatalogProductId },
    trackedFields: CATALOG_PRODUCT_TRACKED_FIELDS,
    auditView: valuesPerAttribute,
  },
  asset: {
    collection: COLLECTIONS.CATALOG_ASSETS,
    entityType: 'catalog_asset',
    identity: byCode(generateDeterministicCatalogAssetId),
    trackedFields: CATALOG_ASSET_TRACKED_FIELDS,
  },
  settings: {
    collection: COLLECTIONS.CATALOG_SETTINGS,
    entityType: 'catalog_settings',
    identity: { mode: 'singleton', idOf: generateDeterministicCatalogSettingsId },
    trackedFields: CATALOG_SETTINGS_TRACKED_FIELDS,
  },
  priceList: {
    collection: COLLECTIONS.CATALOG_PRICE_LISTS,
    entityType: 'catalog_price_list',
    identity: byCode(generateDeterministicCatalogPriceListId),
    trackedFields: CATALOG_PRICE_LIST_TRACKED_FIELDS,
  },
  priceListVersion: {
    collection: COLLECTIONS.CATALOG_PRICE_LIST_VERSIONS,
    entityType: 'catalog_price_list_version',
    identity: byCode(generateDeterministicCatalogPriceListVersionId),
    trackedFields: CATALOG_PRICE_LIST_VERSION_TRACKED_FIELDS,
    auditName: nameFrom((record) => record.number),
  },
  priceListLine: {
    collection: COLLECTIONS.CATALOG_PRICE_LIST_LINES,
    entityType: 'catalog_price_list_line',
    identity: byCode(generateDeterministicCatalogPriceListLineId),
    trackedFields: CATALOG_PRICE_LIST_LINE_TRACKED_FIELDS,
    auditName: nameFrom((record) => derivedOf(record).subjectKey),
  },
  discountGroup: {
    collection: COLLECTIONS.CATALOG_DISCOUNT_GROUPS,
    entityType: 'catalog_discount_group',
    identity: byCode(generateDeterministicCatalogDiscountGroupId),
    trackedFields: CATALOG_DISCOUNT_GROUP_TRACKED_FIELDS,
  },
  customerGroup: {
    collection: COLLECTIONS.CATALOG_CUSTOMER_GROUPS,
    entityType: 'catalog_customer_group',
    identity: byCode(generateDeterministicCatalogCustomerGroupId),
    trackedFields: CATALOG_CUSTOMER_GROUP_TRACKED_FIELDS,
  },
  customerAssignment: {
    collection: COLLECTIONS.CATALOG_CUSTOMER_ASSIGNMENTS,
    entityType: 'catalog_customer_assignment',
    identity: byCode(generateDeterministicCatalogCustomerAssignmentId),
    trackedFields: CATALOG_CUSTOMER_ASSIGNMENT_TRACKED_FIELDS,
  },
  discountCondition: {
    collection: COLLECTIONS.CATALOG_DISCOUNT_CONDITIONS,
    entityType: 'catalog_discount_condition',
    identity: { mode: 'random', prefix: ENTERPRISE_ID_PREFIXES.CATALOG_DISCOUNT_CONDITION, mint: generateCatalogDiscountConditionId },
    trackedFields: CATALOG_DISCOUNT_CONDITION_TRACKED_FIELDS,
  },
};
